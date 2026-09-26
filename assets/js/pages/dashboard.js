/* Dashboard - one compact card per circular.
   No cross-circular totals on purpose: "105 applicants" across three
   unrelated recruitments tells an HR officer nothing they can act on.
   Every figure on a card belongs to that circular and its stages. */
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
      var isCur = active && s.id === active.id;
      var cls = complete ? 'done' : (isCur ? 'cur' : 'upcoming');
      var countBadge = (complete || isCur) && roster.length
        ? '<span class="phase-chip-count">' + roster.length + '</span>'
        : '';
      return '<span class="phase-chip ' + cls + '" title="' +
        fmt.esc(pipe.typeLabel(s.type) + ' · ' +
          (roster.length ? fmt.plural(roster.length, 'candidate') : 'no candidates yet')) + '">' +
        (complete ? '<i class="bi bi-check-circle-fill"></i>' : '') +
        fmt.esc(pipe.typeLabel(s.type)) +
        countBadge +
        '</span>';
    }).join('<i class="bi bi-chevron-right phase-arrow"></i>');

    var nextBoxHtml = '';
    if (cur) {
      nextBoxHtml =
        '<div class="next-stage-box">' +
        '<div class="d-flex align-items-center gap-3 min-w-0">' +
        '<i class="bi bi-sliders2 next-stage-icon"></i>' +
        '<div class="min-w-0">' +
        '<div class="next-stage-title text-truncate">Next Stage: ' + fmt.esc(cur.label) + '</div>' +
        '<div class="next-stage-sub text-truncate">' + fmt.esc(pipe.stageName(active)) + '</div>' +
        '</div>' +
        '</div>' +
        '<a class="btn-proceed" href="' + cur.route + '">' +
        '<i class="bi bi-play-circle-fill"></i> Proceed' +
        '</a>' +
        '</div>';
    } else {
      nextBoxHtml =
        '<div class="next-stage-box bg-light border-0">' +
        '<div class="d-flex align-items-center gap-3">' +
        '<i class="bi bi-check-circle-fill text-success fs-5"></i>' +
        '<div>' +
        '<div class="next-stage-title text-dark">Completed</div>' +
        '<div class="next-stage-sub text-muted">All stages finalized</div>' +
        '</div>' +
        '</div>' +
        '<span class="badge bg-success-subtle text-success px-3 py-1 rounded-pill">Completed</span>' +
        '</div>';
    }

    return '<div class="col-xl-4 col-md-6">' +
      '<div class="circ-card">' +
      '<div class="d-flex align-items-start justify-content-between gap-2">' +
      '<div class="circ-card-title text-truncate" title="' + fmt.esc(c.post) + '">' + fmt.esc(c.post) + '</div>' +
      '<span class="badge-active">Active</span>' +
      '</div>' +
      '<div class="circ-code">' + fmt.esc(c.code) + '</div>' +
      '<div class="circ-stats-bar">' +
      '<span class="stat-item"><i class="bi bi-people-fill text-success"></i><strong>' + applicants.length + '</strong> applied</span>' +
      '<span class="stat-item"><i class="bi bi-briefcase text-primary"></i><strong>' + (c.vacancies < 10 ? '0' + c.vacancies : c.vacancies) + '</strong> posts</span>' +
      '<span class="stat-item"><i class="bi bi-calendar-event text-danger"></i>Last date: <strong>' + fmt.date(c.applyEnd) + '</strong></span>' +
      '</div>' +
      '<div class="circ-divider"></div>' +
      '<div class="circ-phase-section">' +
      '<div class="circ-phase-label">Recruitment Phase</div>' +
      '<div class="circ-phase-chain">' + chips + '</div>' +
      '</div>' +
      nextBoxHtml +
      '</div>' +
      '</div>';
  }

  function render(view) {
    ERec.router.setCrumbs([{ label: 'Dashboard' }]);

    var circulars = store.all('circulars').slice().sort(function (a, b) {
      var dateA = a.applyEnd || a.applyStart || '';
      var dateB = b.applyEnd || b.applyStart || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      var startA = a.applyStart || '';
      var startB = b.applyStart || '';
      if (startA !== startB) return startB.localeCompare(startA);
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
    var me = store.actingUser();

    var html = '<div class="dashboard-page-wrap">' +
      '<div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-4">' +
      '<div>' +
      '<h4 class="fw-bold text-dark mb-1" style="font-size: 1.35rem; letter-spacing: -0.01em;">Human Resources Division Dashboard</h4>' +
      '<div class="text-muted" style="font-size: 12.5px;">Pubali Bank PLC &middot; Acting as ' + fmt.esc(me.name) + ' (' + fmt.esc(me.designation) + ')</div>' +
      '</div>' +
      '<button class="btn btn-sm btn-green-solid btn-icon shadow-sm" id="btn-new">' +
      '<i class="bi bi-plus-lg"></i> Create Circular</button>' +
      '</div>';

    html += '<div class="d-flex align-items-center justify-content-between mb-3">' +
      '<h5 class="fw-bold text-dark mb-0 d-flex align-items-center gap-2" style="font-size: 20px;">' +
      '<i class="bi bi-briefcase-fill theme-green" style="color: var(--primary-green);"></i> Active Job Circulars' +
      '</h5>' +
      '<span class="text-secondary" style="font-size: 12px; font-weight: 500;">' +
      circulars.length + ' Positions Active' +
      '</span>' +
      '</div>';

    var emptyDashboardHtml =
      '<div class="card p-4 p-md-5 text-center mb-4 border-0 shadow-sm rounded-3 bg-white">' +
        '<div class="avatar xl mx-auto mb-3 bg-success-subtle text-success border border-success-subtle">' +
          '<i class="bi bi-briefcase fs-1"></i>' +
        '</div>' +
        '<h4 class="fw-bold text-dark mb-2">No Active Job Circulars in Pipeline</h4>' +
        '<p class="text-muted fs-13 mb-4 mx-auto" style="max-width: 540px; line-height: 1.6;">' +
          'The Pubali Bank HRD e-Recruitment system is active and ready for official recruitment notices. ' +
          'Launch a new job posting through the 4-step wizard, or load a standard practice circular to test candidate screening, approval workflows, and exam scoring.' +
        '</p>' +
        '<div class="d-flex align-items-center justify-content-center gap-2 flex-wrap mb-4">' +
          '<button class="btn btn-green-solid shadow-sm px-4 py-2" id="btn-empty-new">' +
            '<i class="bi bi-plus-lg me-1"></i> Create Job Circular' +
          '</button>' +
          '<button class="btn btn-outline-success shadow-sm px-4 py-2" id="btn-load-sample">' +
            '<i class="bi bi-box-arrow-in-down me-1"></i> Load Sample Bank Circular' +
          '</button>' +
        '</div>' +
        '<div class="row g-3 text-start mt-2 pt-4 border-top">' +
          '<div class="col-md-4">' +
            '<div class="p-3 bg-light rounded-3 border h-100">' +
              '<div class="d-flex align-items-center gap-2 mb-2">' +
                '<i class="bi bi-shield-check text-success fs-5"></i>' +
                '<h6 class="fw-bold text-dark mb-0 fs-13">Approval Hierarchy Active</h6>' +
              '</div>' +
              '<div class="text-muted fs-12">Multi-level authorization sequence configured (GM HRD &rarr; DMD &rarr; Managing Director).</div>' +
            '</div>' +
          '</div>' +
          '<div class="col-md-4">' +
            '<div class="p-3 bg-light rounded-3 border h-100">' +
              '<div class="d-flex align-items-center gap-2 mb-2">' +
                '<i class="bi bi-send text-primary fs-5"></i>' +
                '<h6 class="fw-bold text-dark mb-0 fs-13">Communication Gateway</h6>' +
              '</div>' +
              '<div class="text-muted fs-12">Live Email &amp; SMS notification engine for admit cards, examination schedules, and appointment letters.</div>' +
            '</div>' +
          '</div>' +
          '<div class="col-md-4">' +
            '<div class="p-3 bg-light rounded-3 border h-100">' +
              '<div class="d-flex align-items-center gap-2 mb-2">' +
                '<i class="bi bi-diagram-3 text-warning fs-5"></i>' +
                '<h6 class="fw-bold text-dark mb-0 fs-13">Full Exam Lifecycle</h6>' +
              '</div>' +
              '<div class="text-muted fs-12">Supports MCQ, Written, Viva-Voce, Document Scrutiny, Merit Selection, Offer Letters, and Official Joining.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    html += circulars.length
      ? '<div class="row g-3 mb-4">' + circulars.map(circularCard).join('') + '</div>'
      : emptyDashboardHtml;

    view.innerHTML = html;

    var newBtn = view.querySelector('#btn-new');
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        if (ERec.app && ERec.app.addCreateCircularSubmenu) {
          ERec.app.addCreateCircularSubmenu();
        }
        ERec.router.go('#/circulars/new');
      });
    }

    var emptyNewBtn = view.querySelector('#btn-empty-new');
    if (emptyNewBtn) {
      emptyNewBtn.addEventListener('click', function () {
        if (ERec.app && ERec.app.addCreateCircularSubmenu) {
          ERec.app.addCreateCircularSubmenu();
        }
        ERec.router.go('#/circulars/new');
      });
    }

    var loadSampleBtn = view.querySelector('#btn-load-sample');
    if (loadSampleBtn) {
      loadSampleBtn.addEventListener('click', function () {
        if (ERec.seed && ERec.seed.loadPracticeCircular) {
          var circ = ERec.seed.loadPracticeCircular({ count: 35 });
          ui.toast('Sample practice circular ' + circ.post + ' loaded with 35 candidates!', 'success');
          render(view);
        }
      });
    }
  }

  ERec.pages.dashboard = { render: render };
})(window);
