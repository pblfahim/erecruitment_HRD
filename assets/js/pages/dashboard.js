/* Dashboard - Pubali Bank PLC E-Recruitment HRD Admin Portal.
   High-fidelity overview with metrics, live notice sheen, circular progress cards,
   and recent activity timeline matching the erecruitment portal theme. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  function circularCard(c) {
    var stages = store.stagesOf(c.id);
    var applicants = store.applicantsOf(c.id);
    var prog = pipe.circularProgress(c.id);
    var active = pipe.activeStage(c.id);
    var cur = active ? pipe.currentStep(active) : null;

    var chips = stages.map(function (s) {
      var p = pipe.progress(s);
      var roster = store.rosterOf(s.id);
      var complete = p.done === p.total && !p.pending;
      var cls = complete ? 'done' : (active && s.id === active.id ? 'cur' : '');
      return '<span class="stage-chip ' + cls + '" title="' +
        fmt.esc(pipe.typeLabel(s.type) + ' · ' +
          (roster.length ? fmt.plural(roster.length, 'candidate') : 'no candidates yet')) + '">' +
        (complete ? '<i class="bi bi-check-circle-fill text-success"></i>' : '') +
        fmt.esc(pipe.typeLabel(s.type)) +
        (roster.length ? ' <span class="cnt">' + roster.length + '</span>' : '') +
        (p.pending ? ' <span class="wait">' + p.pending + '</span>' : '') +
        '</span>';
    }).join('<span class="arrow text-secondary"><i class="bi bi-chevron-right"></i></span>');

    return '<div class="col-xl-4 col-md-6">' + ui.card({
      cls: 'circ-card h-100 shadow-sm border',
      body:
        '<div class="d-flex align-items-start justify-content-between gap-2 mb-2">' +
          '<div class="flex-grow-1 min-w-0">' +
            '<div class="fw-bold text-dark text-truncate" style="font-size:1.05rem">' + fmt.esc(c.post) + '</div>' +
            '<div class="fs-12 text-muted mono mt-1"><i class="bi bi-upc-scan me-1 text-success"></i>' + fmt.esc(c.code) + '</div>' +
          '</div>' + ui.statusPill(c.status) +
        '</div>' +
        '<div class="chain mb-3 pb-2 border-bottom">' + chips + '</div>' +
        '<div class="d-flex gap-3 fs-12 text-secondary mb-3 flex-wrap bg-light p-2 rounded-2">' +
          '<span><i class="bi bi-people-fill text-success me-1"></i><strong>' + applicants.length + '</strong> applied</span>' +
          '<span><i class="bi bi-briefcase text-primary me-1"></i><strong>' + c.vacancies + '</strong> posts</span>' +
          '<span><i class="bi bi-calendar-event text-danger me-1"></i>Last date: ' + fmt.date(c.applyEnd) + '</span>' +
        '</div>' +
        ui.progressBar(prog.pct) +
        '<div class="d-flex justify-content-between fs-12 text-muted mt-1">' +
          '<span><i class="bi bi-check2 me-1 text-success"></i>' + prog.done + ' / ' + prog.total + ' steps done</span>' +
          '<span class="fw-bold text-success">' + prog.pct + '% completed</span>' +
        '</div>' +
        (cur
          ? '<div class="alert-x ' + (cur.pending ? 'warn' : 'info') + ' mt-3 mb-0">' +
            '<i class="bi ' + (cur.pending ? 'bi-people' : 'bi-signpost-2') + '"></i><div>' +
            '<div class="fw-bold">Next Stage: ' + fmt.esc(cur.label) + '</div>' +
            '<div class="fs-12">' + fmt.esc(pipe.stageName(active)) +
            (cur.pending ? ' &middot; <strong class="text-danger">' + fmt.plural(cur.pending, 'candidate') + ' waiting</strong>' : '') +
            '</div></div></div>'
          : ''),
      foot:
        (cur
          ? '<a class="btn btn-sm btn-green-solid btn-icon" href="' + cur.route + '">' +
            '<i class="bi bi-play-circle-fill"></i> Proceed to ' + fmt.esc(cur.label) + '</a>'
          : '<span class="pill green"><i class="bi bi-check-lg"></i> Completed</span>') +
        '<a class="btn btn-sm btn-outline-secondary ms-auto" href="#/circular/' + c.id + '"><i class="bi bi-sliders me-1"></i>Configure Stages</a>'
    }) + '</div>';
  }

  function render(view) {
    ERec.router.setCrumbs([{ label: 'Dashboard' }]);

    var circulars = store.all('circulars');
    var allApplicants = store.all('applicants');
    var me = store.actingUser();
    var minePending = store.pendingApprovalsFor(me.id).length;
    var notificationsCount = store.all('notifications').length;

    var html = ui.pageHead({
      title: 'Human Resources Division Dashboard',
      sub: 'Pubali Bank PLC &middot; Acting as ' + fmt.esc(me.name) + ' (' + fmt.esc(me.designation) + ')',
      actions: '<button class="btn btn-sm btn-green-solid btn-icon shadow-sm" id="btn-new"><i class="bi bi-plus-lg"></i> Post New Circular</button>' +
        '<a class="btn btn-sm btn-outline-secondary btn-icon ms-2" href="#/outbox"><i class="bi bi-envelope-paper"></i> Dispatch Outbox</a>'
    });

    // Live Notice Sheen Banner (Matching erecruitment portal design)
    html +=
      '<div class="alert alert-orange-notice p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3 border shadow-sm">' +
        '<div class="d-flex align-items-center gap-3">' +
          '<div class="notice-bell-box">' +
            '<i class="bi bi-bell-fill notice-bell-icon"></i>' +
            '<span class="notice-bell-ping"></span>' +
          '</div>' +
          '<div>' +
            '<div class="d-flex align-items-center gap-2 mb-1">' +
              '<h6 class="fw-bold mb-0 notice-title">Pubali Bank PLC &middot; HRD Recruitment Portal</h6>' +
              '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1" style="font-size:0.7rem;font-weight:600">' +
                '<span class="spinner-grow spinner-grow-sm text-success me-1" style="width:0.5rem;height:0.5rem"></span> Active Portal' +
              '</span>' +
            '</div>' +
            '<p class="mb-0 notice-desc">Manage circular pipelines, roll number generation, venues, scrutiny, mark evaluations, and appointment offers.</p>' +
          '</div>' +
        '</div>' +
        (minePending > 0
          ? '<a href="#/approvals" class="btn btn-sm btn-outline-danger fw-semibold px-3">' +
              '<i class="bi bi-shield-exclamation me-1"></i> ' + minePending + ' Pending Approvals</a>'
          : '<a href="#/circulars" class="btn btn-sm btn-outline-success fw-semibold px-3">' +
              '<i class="bi bi-briefcase me-1"></i> Explore Circulars</a>') +
      '</div>';

    // Metric Stat Cards Grid
    html +=
      '<div class="row g-3 mb-4">' +
        '<div class="col-12 col-sm-6 col-xl-3">' +
          '<div class="stat-card-modern shadow-sm h-100" style="background-color: #eef5fc;">' +
            '<div class="d-flex align-items-center justify-content-between">' +
              '<div>' +
                '<span class="text-secondary fw-semibold small">Active Circulars</span>' +
                '<h3 class="fw-bold mb-0 mt-1" style="color: #1e293b;">' + circulars.length + '</h3>' +
              '</div>' +
              '<div class="stat-icon-badge bg-white text-primary shadow-sm">' +
                '<i class="bi bi-briefcase-fill"></i>' +
              '</div>' +
            '</div>' +
            '<div class="mt-3 pt-2 border-top border-light d-flex align-items-center justify-content-between">' +
              '<span class="small text-muted">Recruitment drives</span>' +
              '<span class="badge badge-soft-blue fw-semibold">Live</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="col-12 col-sm-6 col-xl-3">' +
          '<div class="stat-card-modern shadow-sm h-100" style="background-color: #ecfdf5;">' +
            '<div class="d-flex align-items-center justify-content-between">' +
              '<div>' +
                '<span class="text-secondary fw-semibold small">Total Applicants</span>' +
                '<h3 class="fw-bold mb-0 mt-1" style="color: #047857;">' + allApplicants.length + '</h3>' +
              '</div>' +
              '<div class="stat-icon-badge bg-white text-success shadow-sm">' +
                '<i class="bi bi-people-fill"></i>' +
              '</div>' +
            '</div>' +
            '<div class="mt-3 pt-2 border-top border-light d-flex align-items-center justify-content-between">' +
              '<span class="small text-muted">Across active jobs</span>' +
              '<span class="badge badge-soft-green fw-semibold">Registered</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="col-12 col-sm-6 col-xl-3">' +
          '<div class="stat-card-modern shadow-sm h-100" style="background-color: #fff8ec;">' +
            '<div class="d-flex align-items-center justify-content-between">' +
              '<div>' +
                '<span class="text-secondary fw-semibold small">Pending Approvals</span>' +
                '<h3 class="fw-bold mb-0 mt-1" style="color: #b45309;">' + minePending + '</h3>' +
              '</div>' +
              '<div class="stat-icon-badge bg-white text-warning shadow-sm">' +
                '<i class="bi bi-shield-check"></i>' +
              '</div>' +
            '</div>' +
            '<div class="mt-3 pt-2 border-top border-light d-flex align-items-center justify-content-between">' +
              '<span class="small text-muted">Waiting on sign-off</span>' +
              '<span class="badge ' + (minePending > 0 ? 'bg-danger text-white' : 'badge-soft-green') + ' fw-semibold">' +
                (minePending > 0 ? 'Action required' : 'Clear') + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="col-12 col-sm-6 col-xl-3">' +
          '<div class="stat-card-modern shadow-sm h-100" style="background-color: #f5f3ff;">' +
            '<div class="d-flex align-items-center justify-content-between">' +
              '<div>' +
                '<span class="text-secondary fw-semibold small">SMS & Mails Dispatched</span>' +
                '<h3 class="fw-bold mb-0 mt-1" style="color: #6d28d9;">' + notificationsCount + '</h3>' +
              '</div>' +
              '<div class="stat-icon-badge bg-white text-purple shadow-sm" style="color:#8b5cf6;">' +
                '<i class="bi bi-envelope-check-fill"></i>' +
              '</div>' +
            '</div>' +
            '<div class="mt-3 pt-2 border-top border-light d-flex align-items-center justify-content-between">' +
              '<span class="small text-muted">Applicant notifications</span>' +
              '<span class="badge badge-soft-purple fw-semibold">Dispatched</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Active Circulars Section
    html += '<div class="d-flex align-items-center justify-content-between mb-3">' +
      '<h5 class="fw-bold text-dark mb-0"><i class="bi bi-briefcase-fill text-success me-2"></i>Active Recruitment Pipelines</h5>' +
      '<span class="badge bg-light text-secondary border px-2 py-1">' + circulars.length + ' Positions Active</span>' +
    '</div>';

    html += circulars.length
      ? '<div class="row g-3 mb-4">' + circulars.map(circularCard).join('') + '</div>'
      : ui.card({ body: ui.empty('No circular yet', 'Create one to start a recruitment.', 'bi-megaphone') });

    // Recent Activity Card
    var log = store.all('auditLog').slice(0, 8);
    html += ui.card({
      title: '<i class="bi bi-clock-history text-success me-2"></i>Recent Operational Audit Trail',
      body: log.length ? '<div class="timeline">' + log.map(function (l) {
        return '<div class="tl-item ok"><span class="tl-dot"><i class="bi bi-dot"></i></span>' +
          '<div class="tl-title">' + fmt.esc(l.note || l.action) + '</div>' +
          '<div class="tl-meta">' + fmt.esc(l.userName) + ' &middot; ' + fmt.ago(l.at) + '</div></div>';
      }).join('') + '</div>' : ui.empty('No activity yet', 'Actions you take in the demo show up here.', 'bi-clock-history')
    });

    view.innerHTML = html;
    view.querySelector('#btn-new').addEventListener('click', function () {
      ERec.pages.circulars.newCircularForm();
    });
  }

  ERec.pages.dashboard = { render: render };
})(window);
