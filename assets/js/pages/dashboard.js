/* Dashboard - Pubali Bank PLC E-Recruitment HRD Admin Portal.
   Active circular recruitment pipelines overview matching the erecruitment portal theme. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  function circularCard(c) {
    var stages = store.stagesOf(c.id);
    var applicants = store.applicantsOf(c.id);
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
        '</div>' + ui.statusPill(c.status) +
        '</div>' +
        '<div class="chain mb-3 pb-2 border-bottom">' + chips + '</div>' +
        '<div class="d-flex gap-3 fs-12 text-secondary mb-3 flex-wrap bg-light p-2 rounded-2">' +
        '<span><i class="bi bi-people-fill text-success me-1"></i><strong>' + applicants.length + '</strong> applied</span>' +
        '<span><i class="bi bi-briefcase text-primary me-1"></i><strong>' + c.vacancies + '</strong> posts</span>' +
        '<span><i class="bi bi-calendar-event text-danger me-1"></i>Last date: ' + fmt.date(c.applyEnd) + '</span>' +
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
        '<a class="btn btn-sm btn-outline-secondary ms-auto" href="circular.html?cid=' + c.id + '"><i class="bi bi-sliders me-1"></i>Configure Stages</a>'
    }) + '</div>';
  }

  function render(view) {
    ERec.router.setCrumbs([{ label: 'Dashboard' }]);

    var circulars = store.all('circulars');
    var me = store.actingUser();

    var html = ui.pageHead({
      title: 'Human Resources Division Dashboard',
      sub: 'Pubali Bank PLC &middot; Acting as ' + fmt.esc(me.name) + ' (' + fmt.esc(me.designation) + ')',
      actions: '<button class="btn btn-sm btn-green-solid btn-icon shadow-sm" id="btn-new"><i class="bi bi-plus-lg"></i> Post New Circular</button>' +
        '<a class="btn btn-sm btn-outline-secondary btn-icon ms-2" href="outbox.html"><i class="bi bi-envelope-paper"></i> Dispatch Outbox</a>'
    });

    // Active Circulars Section
    html += '<div class="d-flex align-items-center justify-content-between mb-3">' +
      '<h5 class="fw-bold text-dark mb-0"><i class="bi bi-briefcase-fill text-success me-2"></i>Active Recruitment Pipelines</h5>' +
      '<span class="badge bg-light text-secondary border px-2 py-1">' + circulars.length + ' Positions Active</span>' +
      '</div>';

    html += circulars.length
      ? '<div class="row g-3 mb-4">' + circulars.map(circularCard).join('') + '</div>'
      : ui.card({ body: ui.empty('No circular yet', 'Create one to start a recruitment.', 'bi-megaphone') });


    view.innerHTML = html;
    view.querySelector('#btn-new').addEventListener('click', function () {
      ERec.pages.circulars.newCircularForm();
    });
  }

  ERec.pages.dashboard = { render: render };
})(window);
