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
          '<div class="circ-phase-label">Circular Phase</div>' +
          '<div class="circ-phase-chain">' + chips + '</div>' +
        '</div>' +
        nextBoxHtml +
      '</div>' +
    '</div>';
  }

  function render(view) {
    ERec.router.setCrumbs([{ label: 'Dashboard' }]);

    var circulars = store.all('circulars');
    var me = store.actingUser();

    var html = '<div class="dashboard-page-wrap">' +
      '<div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-4">' +
        '<div>' +
          '<h4 class="fw-bold text-dark mb-1" style="font-size: 1.35rem; letter-spacing: -0.01em;">Human Resources Division Dashboard</h4>' +
          '<div class="text-muted" style="font-size: 12.5px;">Pubali Bank PLC &middot; Acting as ' + fmt.esc(me.name) + ' (' + fmt.esc(me.designation) + ')</div>' +
        '</div>' +
        '<button class="btn btn-sm btn-green-solid btn-icon shadow-sm" id="btn-new">' +
          '<i class="bi bi-plus-lg"></i> Post New Circular</button>' +
      '</div>';

    html += '<div class="d-flex align-items-center justify-content-between mb-3">' +
      '<h5 class="fw-bold text-dark mb-0 d-flex align-items-center gap-2" style="font-size: 20px;">' +
        '<i class="bi bi-briefcase-fill theme-green" style="color: var(--primary-green);"></i> Active Recruitment Pipelines' +
      '</h5>' +
      '<span class="text-secondary" style="font-size: 12px; font-weight: 500;">' +
        circulars.length + ' Positions Active' +
      '</span>' +
    '</div>';

    html += circulars.length
      ? '<div class="row g-3 mb-4">' + circulars.map(circularCard).join('') + '</div>'
      : ui.card({ body: ui.empty('No circular yet', 'Create one to start a recruitment.', 'bi-megaphone') });

    var log = store.all('auditLog').slice(0, 8);
    html += '<div class="activity-card">' +
      '<div class="activity-card-title">Recent activity</div>' +
      (log.length
        ? '<div class="activity-timeline">' + log.map(function (l) {
            return '<div class="activity-item">' +
              '<span class="activity-dot"></span>' +
              '<div class="activity-body">' +
                '<div class="activity-note">' + fmt.esc(l.note || l.action) + '</div>' +
                '<div class="activity-meta">' + fmt.esc(l.userName) + ' &middot; ' + fmt.date(l.at) + '</div>' +
              '</div>' +
            '</div>';
          }).join('') + '</div>'
        : ui.empty('No activity yet', 'Actions you take in the demo show up here.', 'bi-clock-history')) +
    '</div>';

    html += '</div>';

    view.innerHTML = html;
    view.querySelector('#btn-new').addEventListener('click', function () {
      ERec.router.go('#/circulars/new');
    });
  }

  ERec.pages.dashboard = { render: render };
})(window);
