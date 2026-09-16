/* Optional approval steps (applicant list + venue).
   Always visible so the user knows the option exists; skippable when the
   stage does not require it. Decisions are taken from the approver inbox
   after switching role in the top bar. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var KIND = { 'approval-applicant': 'APPLICANT', 'approval-venue': 'VENUE' };

  function stepKeyFor(kind) { return kind === 'APPLICANT' ? 'approval-applicant' : 'approval-venue'; }

  /* ---------- shared approval mechanics (also used by the inbox) ---------- */

  function send(stg, kind, summary) {
    var field = kind === 'APPLICANT' ? 'applicantApprovers' : 'venueApprovers';
    var ids = stg[field] || [];
    var ap = store.insert('approvals', {
      id: fmt.uid('apr'),
      circularId: stg.circularId, stageId: stg.id, kind: kind,
      summary: summary, status: 'PENDING', currentSeq: 0,
      createdAt: new Date().toISOString(), createdBy: store.actingUser().name,
      chain: ids.map(function (uid, i) {
        var u = store.find('users', uid);
        return {
          seq: i, userId: uid, name: u.name, designation: u.designation,
          status: 'PENDING', remarks: '', actedAt: null
        };
      })
    });
    store.audit('SEND_APPROVAL', 'approval', ap.id,
      (kind === 'APPLICANT' ? 'Applicant list' : 'Venue') + ' sent for approval · ' + pipe.typeLabel(stg.type));
    return ap;
  }

  function act(approvalId, decision, remarks) {
    var ap = store.find('approvals', approvalId);
    if (!ap || ap.status !== 'PENDING') return null;
    var level = ap.chain[ap.currentSeq];
    if (!level) return null;

    level.status = decision;
    level.remarks = remarks || '';
    level.actedAt = new Date().toISOString();

    if (decision === 'REJECTED') {
      ap.status = 'REJECTED';
      store.clearStep(ap.stageId, stepKeyFor(ap.kind));
    } else {
      ap.currentSeq += 1;
      if (ap.currentSeq >= ap.chain.length) {
        ap.status = 'APPROVED';
        store.markStep(ap.stageId, stepKeyFor(ap.kind), { approvalId: ap.id });
      }
    }
    var stg = store.stage(ap.stageId);
    store.audit(decision === 'REJECTED' ? 'REJECT' : 'APPROVE', 'approval', ap.id,
      (ap.kind === 'APPLICANT' ? 'Applicant list' : 'Venue') + ' ' + decision.toLowerCase() +
      ' · ' + pipe.typeLabel(stg.type));
    store.save();
    return ap;
  }

  function decisionModal(ap, decision, after) {
    var isApprove = decision === 'APPROVED';
    ui.modal({
      title: (isApprove ? 'Approve' : 'Reject') + ' — ' + (ap.kind === 'APPLICANT' ? 'applicant list' : 'venue'),
      body: '<div class="fs-13 mb-3">' + fmt.esc(ap.summary) + '</div>' +
        '<label class="form-label">Remarks' + (isApprove ? ' (optional)' : '') + '</label>' +
        '<textarea class="form-control" id="f-rem" rows="3" placeholder="' +
        (isApprove ? 'Verified and approved.' : 'State the reason for rejection.') + '"></textarea>',
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-' + (isApprove ? 'success' : 'danger') + '" data-act="go">' +
        (isApprove ? 'Approve' : 'Reject') + '</button>',
      onShow: function (api) {
        api.find('[data-act="go"]').addEventListener('click', function () {
          var rem = api.find('#f-rem').value.trim();
          if (!isApprove && !rem) { ui.toast('Remarks are required when rejecting', 'warning'); return; }
          act(ap.id, decision, rem);
          api.close();
          ui.toast(isApprove ? 'Approved' : 'Rejected', isApprove ? 'success' : 'danger');
          if (after) after();
        });
      }
    });
  }

  /* Full payload behind an approval request - the approver needs to see the
     whole list, not the first handful of rows. */
  function detailsModal(stg, kind) {
    var c = store.circular(stg.circularId);
    var roster = store.rosterOf(stg.id);
    var venues = store.venuesOf(stg.id);

    var body = kind === 'APPLICANT'
      ? '<div class="verify-summary">' +
          '<div><b>' + roster.length + '</b>candidates</div>' +
          '<div><b>' + roster.filter(function (r) { return r.rollNo; }).length + '</b>with roll numbers</div>' +
          '<div><b>' + c.vacancies + '</b>vacancies</div>' +
        '</div>' +
        (roster.length
          ? '<div class="table-scroll" style="max-height:60vh"><table class="table-x"><thead><tr>' +
            '<th>#</th><th>Roll</th><th>Application no.</th><th>Candidate</th><th>Father\'s name</th>' +
            '<th>Degree</th><th>Mobile</th></tr></thead><tbody>' +
            roster.map(function (r, i) {
              var a = store.applicant(r.applicantId);
              return '<tr><td class="num muted">' + (i + 1) + '</td>' +
                '<td class="mono nowrap">' + fmt.esc(r.rollNo || '—') + '</td>' +
                '<td class="mono fs-12">' + fmt.esc(a.appNo) + '</td>' +
                '<td>' + fmt.esc(a.name) + '</td>' +
                '<td class="fs-12">' + fmt.esc(a.fatherName) + '</td>' +
                '<td class="fs-12">' + fmt.esc(ERec.pages.applicants.highestEdu(a)) + '</td>' +
                '<td class="mono fs-12">' + fmt.esc(a.mobile) + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : ui.empty('No candidate on this list'))
      : (venues.length
        ? venues.map(function (v) {
          var seated = roster.filter(function (r) {
            return r.rollNo && String(r.rollNo) >= String(v.rollFrom) && String(r.rollNo) <= String(v.rollTo);
          });
          return '<div class="card"><div class="card-body">' +
            '<div class="fw-semibold">' + fmt.esc(v.name) + '</div>' +
            '<div class="fs-12 muted mb-2">' + fmt.esc(v.address || 'Address not set') + '</div>' +
            '<dl class="kv">' +
              '<dt>Examination date</dt><dd>' + fmt.date(v.examDate) + '</dd>' +
              '<dt>Reporting time</dt><dd>' + fmt.time12(v.reportingTime || fmt.shiftTime(v.startTime, -30)) + '</dd>' +
              '<dt>Examination time</dt><dd>' + fmt.time12(v.startTime) + ' – ' + fmt.time12(v.endTime) + '</dd>' +
              '<dt>Roll range</dt><dd class="mono">' + fmt.esc(v.rollFrom) + ' – ' + fmt.esc(v.rollTo) + '</dd>' +
              '<dt>Seats</dt><dd>' + seated.length + ' allocated of ' + v.capacity + '</dd>' +
            '</dl></div></div>';
        }).join('')
        : ui.empty('No venue set up'));

    ui.modal({
      title: (kind === 'APPLICANT' ? 'Candidate list' : 'Venue plan') + ' · ' + fmt.esc(pipe.typeLabel(stg.type)) +
        ' · ' + fmt.esc(c.post),
      size: 'xl',
      body: body,
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Close</button>' +
        (kind === 'APPLICANT'
          ? '<button class="btn btn-sm btn-primary" data-act="print"><i class="bi bi-printer"></i> Print list</button>'
          : ''),
      onShow: function (api) {
        var p = api.find('[data-act="print"]');
        if (p) p.addEventListener('click', function () {
          api.close();
          ERec.exp.printDoc('applicant-list', stg.id);
        });
      }
    });
  }

  /* ---------- timeline ---------- */

  function timeline(ap) {
    if (!ap.chain.length) {
      return ui.alert('warn', 'No approver was configured, so this request has nothing to route to.');
    }
    return '<div class="timeline">' + ap.chain.map(function (l, i) {
      var cls = l.status === 'APPROVED' ? 'ok' : l.status === 'REJECTED' ? 'no'
        : (ap.status === 'PENDING' && i === ap.currentSeq ? 'now' : '');
      var icon = l.status === 'APPROVED' ? 'bi-check-lg' : l.status === 'REJECTED' ? 'bi-x-lg'
        : (cls === 'now' ? 'bi-hourglass-split' : 'bi-dot');
      return '<div class="tl-item ' + cls + '"><span class="tl-dot"><i class="bi ' + icon + '"></i></span>' +
        '<div class="tl-title">L' + (i + 1) + ' · ' + fmt.esc(l.name) + ' ' +
          (l.status === 'PENDING' && cls === 'now' ? ui.pill('Awaiting action', 'amber') :
            l.status === 'PENDING' ? ui.pill('Queued', 'grey') : ui.statusPill(l.status)) + '</div>' +
        '<div class="tl-meta">' + fmt.esc(l.designation) +
          (l.actedAt ? ' · ' + fmt.dateTime(l.actedAt) : '') + '</div>' +
        (l.remarks ? '<div class="fs-12 mt-1 fst-italic">“' + fmt.esc(l.remarks) + '”</div>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  /* ---------- page ---------- */

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var kind = KIND[params.step];
    var stepKey = params.step;
    var c = store.circular(stg.circularId);
    var required = kind === 'APPLICANT' ? stg.requireApplicantApproval : stg.requireVenueApproval;
    var approverField = kind === 'APPLICANT' ? 'applicantApprovers' : 'venueApprovers';
    var approvers = stg[approverField] || [];
    var ap = store.approvalFor(stg.id, kind);
    var state = store.stepState(stg, stepKey);
    var me = store.actingUser();

    var roster = store.rosterOf(stg.id);
    var venues = store.venuesOf(stg.id);
    var summary = kind === 'APPLICANT'
      ? fmt.plural(roster.length, 'candidate') + ' for ' + pipe.typeLabel(stg.type) + ' — ' + c.post
      : fmt.plural(venues.length, 'venue') + ' for ' + pipe.typeLabel(stg.type) + ' — ' + c.post;

    var body = ui.lockedNotice(stg, stepKey);

    /* what is being sent */
    var payload = kind === 'APPLICANT'
      ? (roster.length
        ? '<table class="table-x"><thead><tr><th>Roll</th><th>Candidate</th><th>Mobile</th></tr></thead><tbody>' +
          roster.slice(0, 8).map(function (r) {
            var a = store.applicant(r.applicantId);
            return '<tr><td class="mono">' + fmt.esc(r.rollNo || '—') + '</td><td>' + fmt.esc(a.name) +
              '</td><td class="mono fs-12">' + fmt.esc(a.mobile) + '</td></tr>';
          }).join('') + '</tbody></table>' +
          (roster.length > 8 ? '<div class="fs-12 muted mt-2">and ' + (roster.length - 8) + ' more…</div>' : '')
        : ui.empty('No candidate list yet', 'Confirm the applicant list first.', 'bi-people'))
      : (venues.length
        ? '<table class="table-x"><thead><tr><th>Venue</th><th>Date</th><th>Time</th><th>Roll range</th></tr></thead><tbody>' +
          venues.map(function (v) {
            return '<tr><td><div class="fw-semibold">' + fmt.esc(v.name) + '</div><div class="fs-12 muted">' +
              fmt.esc(v.address) + '</div></td><td class="nowrap">' + fmt.date(v.examDate) + '</td>' +
              '<td class="nowrap">' + fmt.time12(v.startTime) + ' – ' + fmt.time12(v.endTime) + '</td>' +
              '<td class="mono nowrap">' + fmt.esc(v.rollFrom) + ' – ' + fmt.esc(v.rollTo) + '</td></tr>';
          }).join('') + '</tbody></table>'
        : ui.empty('No venue set up yet', 'Add a venue before sending it for approval.', 'bi-geo-alt'));

    /* status banner */
    if (state && state.skipped) {
      body += ui.alert('ok', '<strong>This approval was skipped.</strong> It is optional for this stage.' +
        ' <button class="btn btn-sm btn-link p-0 align-baseline" id="btn-unskip">Undo skip</button>');
    } else if (ap && ap.status === 'PENDING') {
      var lvl = ap.chain[ap.currentSeq];
      body += ui.alert('warn', '<strong>Awaiting approval from ' + fmt.esc(lvl ? lvl.name : '—') + '.</strong> ' +
        'Switch the <em>Acting as</em> selector in the top bar to that approver to act on it' +
        (lvl && lvl.userId === me.id ? ' — you are that approver right now.' : '.'));
    } else if (ap && ap.status === 'APPROVED') {
      body += ui.alert('ok', '<strong>Approved.</strong> Sent ' + fmt.ago(ap.createdAt) +
        ', cleared by ' + fmt.plural(ap.chain.length, 'level') + '.');
    } else if (ap && ap.status === 'REJECTED') {
      var rej = ap.chain.filter(function (l) { return l.status === 'REJECTED'; })[0];
      body += ui.alert('err', '<strong>Rejected by ' + fmt.esc(rej ? rej.name : '') + '.</strong> ' +
        (rej && rej.remarks ? '“' + fmt.esc(rej.remarks) + '”' : '') +
        ' Fix the underlying data and send a fresh request.');
    } else if (!required) {
      body += ui.alert('info', '<strong>Approval is not required for this stage.</strong> ' +
        'You can still send it, or skip straight to the next step.');
    } else {
      body += ui.alert('warn', '<strong>Approval is required for this stage.</strong> ' +
        'The steps after this one stay locked until every approver has approved.');
    }

    /* approver chain card */
    var chainHtml = approvers.length
      ? '<div class="chain mb-2">' + approvers.map(function (id, i) {
        var u = store.find('users', id);
        return (i ? '<span class="arrow"><i class="bi bi-chevron-right"></i></span>' : '') +
          '<span class="pill blue">L' + (i + 1) + ' · ' + fmt.esc(u.name) + '</span>';
      }).join('') + '</div>' +
      '<div class="fs-12 muted">Each level must approve in sequence before the step is marked complete.</div>'
      : ui.alert('warn', 'No approver configured for this stage. Set the approval sequence before sending.');

    body += '<div class="row g-3"><div class="col-lg-5">' +
      ui.card({
        title: 'Approval sequence',
        hint: 'Configured per circular and per stage.',
        actions: '<button class="btn btn-sm btn-light" id="btn-edit-approvers"><i class="bi bi-pencil"></i> Edit</button>',
        body: chainHtml +
          '<hr class="hr-soft">' +
          '<div class="form-check form-switch">' +
            '<input class="form-check-input" type="checkbox" id="f-required"' + (required ? ' checked' : '') + '>' +
            '<label class="form-check-label fs-13" for="f-required">Approval required at this stage</label>' +
          '</div>'
      }) +
      (ap ? ui.card({
        title: 'Approval trail',
        hint: 'Requested by ' + fmt.esc(ap.createdBy) + ' · ' + fmt.dateTime(ap.createdAt),
        body: timeline(ap)
      }) : '') +
      '</div><div class="col-lg-7">' +
      ui.card({
        title: kind === 'APPLICANT' ? 'Candidate list being sent' : 'Venue plan being sent',
        hint: summary,
        body: payload
      }) +
      '</div></div>';

    /* footer actions */
    var action = { secondary: [{ id: 'btn-details', label: kind === 'APPLICANT' ? 'View full list' : 'View venue details', icon: 'bi-list-ul' }] };
    var canSend = (kind === 'APPLICANT' ? roster.length : venues.length) && approvers.length;
    var myTurn = ap && ap.status === 'PENDING' && ap.chain[ap.currentSeq] &&
      ap.chain[ap.currentSeq].userId === me.id;

    if (!state || !state.done) {
      if (!ap || ap.status === 'REJECTED') {
        action.primary = {
          id: 'btn-send', icon: 'bi-send',
          label: ap ? 'Send revised request' : 'Send for approval', disabled: !canSend
        };
      }
      /* A required approval is not skippable - that is the whole point of
         marking it required. */
      if (!required) action.secondary.push({ id: 'btn-skip', label: 'Skip — not needed' });
    } else {
      action.note = state.skipped ? 'This step was skipped' : 'Approved';
    }

    /* If it is this user's turn, approving is the obvious thing to do here. */
    if (myTurn) {
      if (action.primary) action.secondary.push({ id: action.primary.id, label: action.primary.label });
      action.primary = {
        id: 'btn-approve', tone: 'success', icon: 'bi-check-lg',
        label: 'Approve as ' + me.name.split(' ')[0]
      };
      action.secondary.push({ id: 'btn-reject', label: 'Reject', tone: 'outline-danger' });
    }

    ui.stagePage(view, stg, stepKey, { body: body, action: action });

    /* ---- wiring ---- */
    var editBtn = view.querySelector('#btn-edit-approvers');
    if (editBtn) editBtn.addEventListener('click', function () {
      ERec.pages.circular.editApprovers(stg, kind);
    });

    var reqCb = view.querySelector('#f-required');
    if (reqCb) reqCb.addEventListener('change', function () {
      var patch = {};
      patch[kind === 'APPLICANT' ? 'requireApplicantApproval' : 'requireVenueApproval'] = reqCb.checked;
      store.update('stages', stg.id, patch);
      ui.toast('Requirement updated');
      ERec.router.refresh();
    });

    var detBtn = view.querySelector('#btn-details');
    if (detBtn) detBtn.addEventListener('click', function () { detailsModal(stg, kind); });

    var sendBtn = view.querySelector('#btn-send');
    if (sendBtn) sendBtn.addEventListener('click', function () {
      send(stg, kind, summary);
      ui.toast('Sent for approval to ' + store.find('users', approvers[0]).name);
      ERec.app.renderNav();
      ERec.router.refresh();
    });

    var skipBtn = view.querySelector('#btn-skip');
    if (skipBtn) skipBtn.addEventListener('click', function () {
      ui.confirm({
        title: 'Skip approval',
        body: 'This optional approval will be marked as skipped and the pipeline will move on.',
        okText: 'Skip step'
      }).then(function (ok) {
        if (!ok) return;
        store.markStep(stg.id, stepKey, { skipped: true });
        store.audit('SKIP_APPROVAL', 'stage', stg.id, (kind === 'APPLICANT' ? 'Applicant' : 'Venue') + ' approval skipped');
        ui.toast('Step skipped');
        var next = pipe.step(stg, stepKey);
        ERec.router.refresh();
      });
    });

    var unskip = view.querySelector('#btn-unskip');
    if (unskip) unskip.addEventListener('click', function () {
      store.clearStep(stg.id, stepKey);
      ui.toast('Skip undone');
      ERec.router.refresh();
    });

    var apr = view.querySelector('#btn-approve');
    if (apr) apr.addEventListener('click', function () {
      decisionModal(ap, 'APPROVED', function () { ERec.app.renderNav(); ERec.router.refresh(); });
    });
    var rej2 = view.querySelector('#btn-reject');
    if (rej2) rej2.addEventListener('click', function () {
      decisionModal(ap, 'REJECTED', function () { ERec.app.renderNav(); ERec.router.refresh(); });
    });
  }

  ERec.pages.approval = { render: render };
  ERec.approvals = { send: send, act: act, timeline: timeline, decisionModal: decisionModal, detailsModal: detailsModal };
})(window);
