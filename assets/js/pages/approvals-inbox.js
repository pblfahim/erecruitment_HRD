/* Approver inbox - the other side of the optional approval steps.
   Switch "Acting as" in the top bar to an approver to act here. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  function requestCard(ap, canAct) {
    var stg = store.stage(ap.stageId);
    var c = store.circular(ap.circularId);
    if (!stg || !c) return '';
    var level = ap.chain[ap.currentSeq];

    var detail = ap.kind === 'APPLICANT'
      ? fmt.plural(store.rosterOf(stg.id).length, 'candidate') + ' on the ' + pipe.typeLabel(stg.type) + ' roster'
      : store.venuesOf(stg.id).map(function (v) {
        return v.name + ' (' + fmt.date(v.examDate) + ', roll ' + v.rollFrom + '–' + v.rollTo + ')';
      }).join(' · ') || 'No venue attached';

    return ui.card({
      title: (ap.kind === 'APPLICANT' ? '<i class="bi bi-person-check"></i> Applicant list approval'
        : '<i class="bi bi-building-check"></i> Venue approval') +
        ' <span class="muted fw-normal">· ' + fmt.esc(c.post) + '</span>',
      hint: fmt.esc(pipe.stageName(stg)) + ' · requested by ' + fmt.esc(ap.createdBy) + ' ' + fmt.ago(ap.createdAt),
      actions: ui.statusPill(ap.status),
      body:
        '<div class="row g-3"><div class="col-md-6">' +
          '<div class="section-title">What is being approved</div>' +
          '<div class="fs-13">' + fmt.esc(detail) + '</div>' +
          '<div class="fs-12 muted mt-2 mono">' + fmt.esc(c.code) + '</div>' +
          '<a class="btn btn-sm btn-light mt-3" href="#/circular/' + c.id + '/stage/' + stg.id + '/' +
            (ap.kind === 'APPLICANT' ? 'approval-applicant' : 'approval-venue') + '">Open in pipeline <i class="bi bi-box-arrow-up-right"></i></a>' +
        '</div><div class="col-md-6">' +
          '<div class="section-title">Approval trail</div>' + ERec.approvals.timeline(ap) +
        '</div></div>',
      foot: canAct
        ? '<button class="btn btn-sm btn-success btn-icon" data-approve="' + ap.id + '"><i class="bi bi-check-lg"></i> Approve</button>' +
          '<button class="btn btn-sm btn-outline-danger btn-icon" data-reject="' + ap.id + '"><i class="bi bi-x-lg"></i> Reject</button>' +
          '<div class="spacer"></div><span class="fs-12 muted">Acting as ' + fmt.esc(level ? level.name : '') + '</span>'
        : (ap.status === 'PENDING'
          ? '<span class="fs-12 muted"><i class="bi bi-hourglass-split"></i> Waiting on ' +
            fmt.esc(level ? level.name : '—') + ' (' + fmt.esc(level ? level.designation : '') + ')</span>'
          : '<span class="fs-12 muted">Closed ' + fmt.ago(ap.chain[ap.chain.length - 1].actedAt || ap.createdAt) + '</span>')
    });
  }

  function render(view) {
    ERec.router.setCrumbs([{ label: 'Approvals' }]);
    var me = store.actingUser();
    var mine = store.pendingApprovalsFor(me.id);
    var allPending = store.where('approvals', function (a) { return a.status === 'PENDING'; });
    var others = allPending.filter(function (a) { return mine.indexOf(a) < 0; });
    var closed = store.where('approvals', function (a) { return a.status !== 'PENDING'; })
      .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })
      .slice(0, 6);

    var html = ui.pageHead({
      title: 'Approval inbox',
      sub: 'Acting as <strong>' + fmt.esc(me.name) + '</strong> · ' + fmt.esc(me.designation)
    });

    html += '<div class="stat-grid">' +
      '<div class="stat"><div class="k">Awaiting you</div><div class="v ' + (mine.length ? 'text-danger' : '') + '">' + mine.length + '</div></div>' +
      '<div class="stat"><div class="k">Pending elsewhere</div><div class="v">' + others.length + '</div></div>' +
      '<div class="stat"><div class="k">Decided</div><div class="v">' +
        store.where('approvals', function (a) { return a.status !== 'PENDING'; }).length + '</div></div>' +
      '</div>';

    if (me.role === 'HR_ADMIN') {
      html += ui.alert('info', '<strong>You are acting as HR Admin.</strong> ' +
        'Approvals are actioned by the approvers configured on each stage — switch the <em>Acting as</em> ' +
        'selector in the top bar to one of them to approve or reject.');
    }

    html += '<div class="section-title">Awaiting your action</div>';
    html += mine.length ? mine.map(function (ap) { return requestCard(ap, true); }).join('')
      : ui.card({ body: ui.empty('Nothing waiting on you', 'Requests routed to ' + me.name + ' will appear here.', 'bi-inbox') });

    if (others.length) {
      html += '<div class="section-title">Pending with other approvers</div>' +
        others.map(function (ap) { return requestCard(ap, false); }).join('');
    }

    if (closed.length) {
      html += '<div class="section-title">Recently decided</div>' +
        closed.map(function (ap) { return requestCard(ap, false); }).join('');
    }

    view.innerHTML = html;

    ui.on(view, '[data-approve]', 'click', function (e, b) {
      ERec.approvals.decisionModal(store.find('approvals', b.dataset.approve), 'APPROVED', function () {
        ERec.app.renderNav(); ERec.router.refresh();
      });
    });
    ui.on(view, '[data-reject]', 'click', function (e, b) {
      ERec.approvals.decisionModal(store.find('approvals', b.dataset.reject), 'REJECTED', function () {
        ERec.app.renderNav(); ERec.router.refresh();
      });
    });
  }

  ERec.pages.approvalsInbox = { render: render };
})(window);
