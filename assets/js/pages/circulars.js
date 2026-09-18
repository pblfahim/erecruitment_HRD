/* Circular list + create. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var DEMO_APPLICANTS = 40;   // generated behind the scenes so a new circular is walkable

  function newCircularForm() {
    ERec.router.go('#/circulars/new');
  }

  /* Metric tile for the row of summary cards above the circular table. */
  function statCard(opts) {
    return '<div class="col-12 col-sm-6 col-xl-3">' +
      '<div class="stat-card-modern shadow-sm h-100" style="background-color: ' + opts.bg + ';">' +
        '<div class="d-flex align-items-center justify-content-between">' +
          '<div>' +
            '<span class="text-secondary fw-semibold small">' + fmt.esc(opts.label) + '</span>' +
            '<h3 class="fw-bold mb-0 mt-1" style="color: ' + opts.valueColor + ';">' + opts.value + '</h3>' +
          '</div>' +
          '<div class="stat-icon-badge bg-white shadow-sm ' + (opts.iconClass || '') + '"' +
            (opts.iconColor ? ' style="color:' + opts.iconColor + ';"' : '') + '>' +
            '<i class="bi ' + opts.icon + '"></i>' +
          '</div>' +
        '</div>' +
        '<div class="mt-3 pt-2 border-top border-light d-flex align-items-center justify-content-between">' +
          '<span class="small text-muted">' + fmt.esc(opts.foot) + '</span>' +
          '<span class="badge ' + opts.badgeClass + ' fw-semibold">' + fmt.esc(opts.badge) + '</span>' +
        '</div>' +
      '</div></div>';
  }

  function render(view) {
    ERec.router.setCrumbs([{ label: 'Job Circulars' }]);
    var list = store.all('circulars');
    var me = store.actingUser();
    var minePending = store.pendingApprovalsFor(me.id).length;

    var rows = list.map(function (c) {
      var n = store.applicantsOf(c.id).length;
      var rules = c.eligibilityRules || [];
      return '<tr class="clickable" data-cid="' + c.id + '">' +
        '<td>' +
          '<div class="table-post-title">' + fmt.esc(c.post) + '</div>' +
          '<div class="table-ref-code">' + fmt.esc(c.code) + '</div>' +
        '</td>' +
        '<td>' + (rules.length
          ? '<div class="table-rule-count">' + fmt.plural(rules.length, 'rule') + '</div>' +
            '<div class="table-rule-desc text-truncate" title="' + fmt.esc(rules.map(function (r) { return ERec.seed.ruleTypeLabel(r.type); }).join(', ')) + '">' +
            fmt.esc(rules.map(function (r) { return ERec.seed.ruleTypeLabel(r.type); }).join(', ')) + '</div>'
          : '<span class="text-muted fs-12">No rules set</span>') + '</td>' +
        '<td class="text-center"><span class="table-vacancies">' + c.vacancies + '</span></td>' +
        '<td class="text-center"><span class="table-applied">' + n + '</span></td>' +
        '<td class="nowrap">' +
          '<div class="table-close-date">' + fmt.date(c.applyEnd) + '</div>' +
          (c.applyEndTime ? '<div class="table-close-time">' + fmt.time12(c.applyEndTime) + '</div>' : '') +
        '</td>' +
        '<td class="nowrap table-pipeline-stages">' + fmt.esc(pipe.chainLabel(c.id)) + '</td>' +
        '<td class="text-center">' + ui.statusPill(c.status) + '</td>' +
        '<td class="text-center">' +
          '<div class="table-actions-cell">' +
            '<a class="btn-table-action" href="#/circular/' + c.id + '" title="View Workspace"><i class="bi bi-eye"></i></a>' +
            '<a class="btn-table-action" href="#/circular/' + c.id + '" title="Configure Circular"><i class="bi bi-pencil-square"></i></a>' +
          '</div>' +
        '</td>' +
        '</tr>';
    }).join('');

    var html = ui.pageHead({
      title: 'Active Recruitment Circulars',
      sub: 'Pubali Bank PLC &middot; Oversee job circulars and recruitment pipelines.',
      actions: '<button class="btn btn-sm btn-green-solid btn-icon shadow-sm" id="btn-new">' +
        '<i class="bi bi-plus-lg"></i> Post New Circular</button>'
    });

    html += '<div class="row g-3 mb-4">' +
      statCard({
        label: 'Active Circulars', value: list.length, bg: '#eef5fc', valueColor: '#1e293b',
        icon: 'bi-briefcase-fill', iconClass: 'text-primary',
        foot: 'Recruitment drives', badge: 'Live', badgeClass: 'badge-soft-blue'
      }) +
      statCard({
        label: 'Total Applicants', value: store.all('applicants').length, bg: '#ecfdf5', valueColor: '#047857',
        icon: 'bi-people-fill', iconClass: 'text-success',
        foot: 'Across active jobs', badge: 'Registered', badgeClass: 'badge-soft-green'
      }) +
      statCard({
        label: 'Pending Approvals', value: minePending, bg: '#fff8ec', valueColor: '#b45309',
        icon: 'bi-shield-check', iconClass: 'text-warning',
        foot: 'Waiting on sign-off',
        badge: minePending > 0 ? 'Action required' : 'Clear',
        badgeClass: minePending > 0 ? 'bg-danger text-white' : 'badge-soft-green'
      }) +
      statCard({
        label: 'SMS & Mails Dispatched', value: store.all('notifications').length, bg: '#f5f3ff', valueColor: '#6d28d9',
        icon: 'bi-envelope-check-fill', iconColor: '#8b5cf6',
        foot: 'Applicant notifications', badge: 'Dispatched', badgeClass: 'badge-soft-purple'
      }) +
      '</div>';

    html += ui.card({
      cls: 'card-circulars shadow-sm border-0',
      tight: true,
      body: list.length ? '<div class="table-responsive"><table class="table table-circulars align-middle mb-0"><thead><tr>' +
        '<th>POST / REFERENCE NO.</th>' +
        '<th>ELIGIBILITY</th>' +
        '<th class="text-center">VACANCIES</th>' +
        '<th class="text-center">APPLIED</th>' +
        '<th>CLOSES</th>' +
        '<th>PIPELINE STAGES</th>' +
        '<th class="text-center">STATUS</th>' +
        '<th class="text-center">ACTION</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        : ui.empty('No circulars yet', 'Create one to start the recruitment pipeline.', 'bi-megaphone')
    });

    view.innerHTML = html;

    view.querySelector('#btn-new').addEventListener('click', newCircularForm);
    ui.on(view, 'tr[data-cid]', 'click', function (e, tr) {
      if (e.target.closest('a') || e.target.closest('button')) return;
      ERec.router.go('#/circular/' + tr.dataset.cid);
    });
  }

  ERec.pages.circulars = { render: render, newCircularForm: newCircularForm };
})(window);
