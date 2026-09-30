/* Stage Approval Step: Candidate List (approvecandidate.js).
   Dedicated approval workflow for authorizing the verified candidate roster.
   Displays the confirmed candidate roster, modern hierarchical timeline,
   acting officer switching, and authorization actions. */
(function (global) {
  'use strict';

  var ERec = global.ERec = global.ERec || {};
  ERec.pages = ERec.pages || {};
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var STEP_KEY = 'approval-applicant';
  var KIND = 'APPLICANT';

  function isHrAdminUser(u) {
    u = u || store.actingUser();
    return !!(u && (u.role === 'HR_ADMIN' || u.id === 'u-hr'));
  }

  /* ---------- Approval Workflow Mechanics ---------- */

  function send(stg, summary) {
    var me = store.actingUser();
    if (!isHrAdminUser(me)) {
      ui.toast('Only HR Admin · Senior Officer can send approval requests.', 'warning');
      return null;
    }
    var ids = stg.applicantApprovers || [];
    if (!ids.length) {
      ids = ['u-gm', 'u-dmd', 'u-md'].filter(function (uid) { return !!store.find('users', uid); });
    }
    var ap = store.insert('approvals', {
      id: fmt.uid('apr'),
      circularId: stg.circularId,
      stageId: stg.id,
      kind: KIND,
      summary: summary,
      status: 'PENDING',
      currentSeq: 0,
      createdAt: new Date().toISOString(),
      createdBy: store.actingUser().name,
      chain: ids.map(function (uid, i) {
        var u = store.find('users', uid) || { name: uid, designation: 'Approver' };
        return {
          seq: i,
          userId: uid,
          name: u.name,
          designation: u.designation,
          status: 'PENDING',
          remarks: '',
          actedAt: null
        };
      })
    });
    store.audit('SEND_APPROVAL', 'approval', ap.id,
      'Candidate roster sent for approval · ' + pipe.typeLabel(stg.type));
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
      store.clearStep(ap.stageId, STEP_KEY);
    } else {
      ap.currentSeq += 1;
      if (ap.currentSeq >= ap.chain.length) {
        ap.status = 'APPROVED';
        store.markStep(ap.stageId, STEP_KEY, { approvalId: ap.id });
      }
    }
    var stg = store.stage(ap.stageId);
    store.audit(decision === 'REJECTED' ? 'REJECT' : 'APPROVE', 'approval', ap.id,
      'Candidate roster ' + decision.toLowerCase() + ' · ' + (stg ? pipe.typeLabel(stg.type) : ''));
    store.save();
    return ap;
  }

  function decisionModal(ap, decision, onDone) {
    var isApprove = decision === 'APPROVED';
    ui.modal({
      title: (isApprove ? 'Approve' : 'Reject') + ' — Candidate Roster',
      body: '<div class="fs-13 mb-3 text-muted">' + fmt.esc(ap.summary) + '</div>' +
        '<label class="form-label fw-semibold">Remarks' + (isApprove ? ' (optional)' : ' <span class="text-danger">*</span>') + '</label>' +
        '<textarea class="form-control" id="f-decision-rem" rows="3" placeholder="' +
        (isApprove ? 'Verified and approved.' : 'State the reason for rejection.') + '"></textarea>',
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-' + (isApprove ? 'success' : 'danger') + '" data-act="submit-decision">' +
        (isApprove ? '<i class="bi bi-check2-circle me-1"></i> Confirm Approval' : '<i class="bi bi-x-circle me-1"></i> Reject Request') + '</button>',
      onShow: function (api) {
        api.find('[data-act="submit-decision"]').addEventListener('click', function () {
          var rem = api.find('#f-decision-rem').value.trim();
          if (!isApprove && !rem) { ui.toast('Remarks are required when rejecting', 'warning'); return; }
          act(ap.id, decision, rem);
          api.close();
          ui.toast(isApprove ? 'Approval granted successfully' : 'Request rejected', isApprove ? 'success' : 'danger');
          if (onDone) onDone();
        });
      }
    });
  }

  /* Candidate Roster Details Modal */
  function detailsModal(stg) {
    var c = store.circular(stg.circularId);
    var roster = store.rosterOf(stg.id);

    var body =
      '<div class="verify-summary mb-3 p-3 bg-light rounded border d-flex gap-4 justify-content-around text-center">' +
      '<div><div class="fs-4 fw-bold text-success">' + roster.length + '</div><div class="fs-12 text-muted">Total Selected Candidates</div></div>' +
      '<div><div class="fs-4 fw-bold text-dark">' + roster.filter(function (r) { return r.rollNo; }).length + '</div><div class="fs-12 text-muted">Roll Numbers Allocated</div></div>' +
      '<div><div class="fs-4 fw-bold text-primary">' + (c ? c.vacancies : '—') + '</div><div class="fs-12 text-muted">Approved Vacancies</div></div>' +
      '</div>' +
      '<div class="table-scroll" style="max-height: 58vh">' +
      '<table class="table-x"><thead><tr><th>#</th><th>Roll</th><th>Application no.</th><th>Candidate</th><th>Father\'s name</th><th>Degree</th><th>District</th><th>Mobile</th><th>Status</th></tr></thead><tbody>' +
      (roster.length ? roster.map(function (r, i) {
        var a = store.applicant(r.applicantId) || {};
        return '<tr><td class="num muted">' + (i + 1) + '</td>' +
          '<td class="mono nowrap fw-semibold">' + fmt.esc(r.rollNo || a.rollNo || '—') + '</td>' +
          '<td class="mono fs-12">' + fmt.esc(a.appNo || '—') + '</td>' +
          '<td><div class="fw-semibold">' + fmt.esc(a.name || '—') + '</div></td>' +
          '<td class="fs-12 text-muted">' + fmt.esc(a.fatherName || '—') + '</td>' +
          '<td class="fs-12">' + fmt.esc(ERec.pages.applicants ? ERec.pages.applicants.highestEdu(a) : (a.highestDegree || '—')) + '</td>' +
          '<td class="fs-12">' + fmt.esc(a.district || '—') + '</td>' +
          '<td class="mono fs-12">' + fmt.esc(a.mobile || '—') + '</td>' +
          '<td><span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5 fs-11"><i class="bi bi-check2 me-1"></i>Selected</span></td></tr>';
      }).join('') : '<tr><td colspan="9" class="text-center py-4 text-muted">No candidates currently on this roster.</td></tr>') +
      '</tbody></table></div>';

    ui.modal({
      title: 'Selected Candidate Roster · ' + fmt.esc(pipe.typeLabel(stg.type)) + ' · ' + fmt.esc(c ? c.post : ''),
      size: 'xl',
      body: body,
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Close</button>' +
        '<button class="btn btn-sm btn-primary" data-act="print"><i class="bi bi-printer me-1"></i> Print Roster</button>',
      onShow: function (api) {
        var p = api.find('[data-act="print"]');
        if (p) {
          p.addEventListener('click', function () {
            api.close();
            if (ERec.exp && ERec.exp.printDoc) ERec.exp.printDoc('applicant-list', stg.id);
          });
        }
      }
    });
  }

  /* ---------- Modern Minimal Timelines ---------- */

  function renderActiveTimeline(ap, me) {
    if (!ap.chain || !ap.chain.length) {
      return '<div class="p-3 bg-light rounded text-center text-muted fs-12 border border-dashed">No approvers configured for this request.</div>';
    }
    me = me || store.actingUser();
    return '<div class="modern-trail-list">' + ap.chain.map(function (l, i) {
      var isCur = ap.status === 'PENDING' && i === ap.currentSeq;
      var isPassed = l.status === 'APPROVED';
      var isRej = l.status === 'REJECTED';
      var stepCls = isPassed ? 'is-passed' : isRej ? 'is-rejected' : (isCur ? 'is-current' : 'is-queued');
      var discContent = isPassed ? '<i class="bi bi-check-lg"></i>' : isRej ? '<i class="bi bi-x-lg"></i>' : (isCur ? '<i class="bi bi-hourglass-split"></i>' : '<span class="font-monospace fs-11">' + (i + 1) + '</span>');
      var isMyTurn = isCur && l.userId === me.id;

      var statusBadge = '';
      if (isPassed) {
        statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5 fs-11"><i class="bi bi-check2 me-1"></i>Approved</span>';
      } else if (isRej) {
        statusBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2 py-0.5 fs-11"><i class="bi bi-x me-1"></i>Rejected</span>';
      } else if (isMyTurn) {
        statusBadge = '<span class="badge bg-success text-white rounded-pill px-2 py-0.5 fs-11"><i class="bi bi-person-check me-1"></i>Your turn</span>';
      } else if (isCur) {
        statusBadge = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-2 py-0.5 fs-11"><i class="bi bi-hourglass-split me-1"></i>Awaiting</span>';
      } else {
        statusBadge = '<span class="badge bg-light text-muted border rounded-pill px-2 py-0.5 fs-10">Queued</span>';
      }

      var switchBtn = '';
      if (isCur && !isMyTurn) {
        switchBtn = '<button type="button" class="btn btn-xs btn-outline-success py-0 px-2 fs-11 rounded-pill" data-switch-user="' + l.userId + '" title="Switch Acting Personnel to ' + fmt.esc(l.name) + '">' +
          '<i class="bi bi-person-switch me-1"></i>Switch to ' + fmt.esc(l.name.split(' ')[0]) + '</button>';
      }

      return '<div class="modern-trail-step ' + stepCls + '">' +
        '<div class="modern-trail-disc">' + discContent + '</div>' +
        '<div class="modern-trail-card">' +
        '<div class="d-flex align-items-center justify-content-between flex-wrap gap-2">' +
        '<div class="d-flex align-items-center gap-2">' +
        '<span class="badge bg-light text-secondary border fs-10 font-monospace">L' + (i + 1) + '</span>' +
        '<span class="modern-trail-name">' + fmt.esc(l.name) + '</span>' +
        '</div>' +
        '<div class="d-flex align-items-center gap-1.5">' + statusBadge + switchBtn + '</div>' +
        '</div>' +
        '<div class="modern-trail-meta">' + fmt.esc(l.designation) +
        (l.actedAt ? ' &middot; <span class="text-secondary"><i class="bi bi-clock me-0.5"></i>' + fmt.dateTime(l.actedAt) + '</span>' : '') +
        '</div>' +
        (l.remarks ? '<div class="modern-trail-remarks">“' + fmt.esc(l.remarks) + '”</div>' : '') +
        '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function renderDraftTimeline(approvers) {
    if (!approvers || !approvers.length) {
      return '<div class="p-3 bg-light rounded text-center text-muted fs-12 border border-dashed"><i class="bi bi-diagram-3 me-1"></i>No approvers configured for this stage.</div>';
    }
    return '<div class="modern-trail-list">' + approvers.map(function (uid, i) {
      var u = store.find('users', uid) || { name: uid, designation: 'Approver' };
      return '<div class="modern-trail-step is-draft">' +
        '<div class="modern-trail-disc font-monospace fs-11 fw-bold">' + (i + 1) + '</div>' +
        '<div class="modern-trail-card">' +
        '<div class="d-flex align-items-center justify-content-between flex-wrap gap-2">' +
        '<div class="d-flex align-items-center gap-2">' +
        '<span class="badge bg-light text-secondary border fs-10 font-monospace">L' + (i + 1) + '</span>' +
        '<span class="modern-trail-name">' + fmt.esc(u.name) + '</span>' +
        '</div>' +
        '<span class="badge bg-light text-muted border rounded-pill px-2 py-0.5 fs-10">Queued</span>' +
        '</div>' +
        '<div class="modern-trail-meta">' + fmt.esc(u.designation) + '</div>' +
        '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  /* ---------- Page Render ---------- */

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var c = store.circular(stg.circularId);
    if (!c) { ERec.router.go('#/circulars'); return; }

    var required = !!stg.requireApplicantApproval;
    var approvers = stg.applicantApprovers || [];
    if (!approvers.length) {
      approvers = ['u-gm', 'u-dmd', 'u-md'].filter(function (uid) { return !!store.find('users', uid); });
    }

    var ap = store.approvalFor(stg.id, KIND);
    var state = store.stepState(stg, STEP_KEY);
    var me = store.actingUser();
    var isHrAdmin = isHrAdminUser(me);

    /* Selected Candidates: exclusively rows confirmed in this stage's roster */
    var roster = store.rosterOf(stg.id).filter(function (r) {
      return r && store.applicant(r.applicantId);
    });

    var curLevel = (ap && ap.chain) ? ap.chain[ap.currentSeq] : null;
    var isApproverTurn = !!(ap && ap.status === 'PENDING' && curLevel && curLevel.userId === me.id);
    var canSend = roster.length && approvers.length;
    var summary = fmt.plural(roster.length, 'candidate') + ' for ' + pipe.typeLabel(stg.type) + ' — ' + c.post;

    /* Candidate Roster Rows */
    var candidateRowsHtml = roster.length ? roster.map(function (r, i) {
      var a = store.applicant(r.applicantId) || {};
      return '<tr>' +
        '<td class="text-center num text-muted fs-12" style="width: 44px;">' + (i + 1) + '</td>' +
        '<td class="mono fw-bold fs-13 text-dark">' + fmt.esc(r.rollNo || a.rollNo || '—') + '</td>' +
        '<td class="mono fs-12 text-secondary">' + fmt.esc(a.appNo || '—') + '</td>' +
        '<td>' +
        '<div class="d-flex align-items-center gap-2">' +
        ui.avatar(a.name || 'Candidate', 'sm') +
        '<div>' +
        '<div class="fw-semibold fs-13 text-dark">' + fmt.esc(a.name || '—') + '</div>' +
        '<div class="fs-11 text-muted">' + fmt.esc(a.fatherName || 'Father: —') + '</div>' +
        '</div>' +
        '</div>' +
        '</td>' +
        '<td class="fs-12 text-secondary">' + fmt.esc(ERec.pages.applicants ? ERec.pages.applicants.highestEdu(a) : (a.highestDegree || '—')) + '</td>' +
        '<td class="fs-12 text-secondary">' + fmt.esc(a.district || '—') + '</td>' +
        '<td class="mono fs-12 text-secondary">' + fmt.esc(a.mobile || '—') + '</td>' +
        '<td><span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5 fs-11"><i class="bi bi-check2 me-1"></i>Selected</span></td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="8" class="text-center py-4 text-muted fs-13">No candidates selected for this stage roster yet. Confirm candidates in Candidate List step.</td></tr>';

    var payload =
      '<div class="row g-2 mb-3">' +
      '<div class="col-sm-4 col-6"><div class="p-2 border rounded bg-light text-center">' +
      '<div class="fs-11 text-muted text-uppercase fw-bold">Selected Candidates</div>' +
      '<div class="fs-5 fw-bold text-success">' + roster.length + '</div>' +
      '</div></div>' +
      '<div class="col-sm-4 col-6"><div class="p-2 border rounded bg-light text-center">' +
      '<div class="fs-11 text-muted text-uppercase fw-bold">Roll Allocated</div>' +
      '<div class="fs-5 fw-bold text-dark">' + roster.filter(function (r) { return r.rollNo; }).length + '</div>' +
      '</div></div>' +
      '<div class="col-sm-4 col-12"><div class="p-2 border rounded bg-light text-center">' +
      '<div class="fs-11 text-muted text-uppercase fw-bold">Approved Vacancies</div>' +
      '<div class="fs-5 fw-bold text-primary">' + c.vacancies + '</div>' +
      '</div></div>' +
      '</div>' +
      (roster.length
        ? '<div class="table-responsive rounded border mb-2" style="max-height: 52vh; overflow-y: auto;">' +
        '<table class="table table-hover align-middle mb-0 table-x" id="table-selected-candidates">' +
        '<thead style="background: #0f4c3a; color: #ffffff; position: sticky; top: 0; z-index: 2;">' +
        '<tr>' +
        '<th class="text-center" style="width: 44px;">#</th>' +
        '<th>ROLL</th>' +
        '<th>APPLICATION NO.</th>' +
        '<th>CANDIDATE</th>' +
        '<th>HIGHEST DEGREE</th>' +
        '<th>DISTRICT</th>' +
        '<th>MOBILE</th>' +
        '<th>STATUS</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' + candidateRowsHtml + '</tbody>' +
        '</table>' +
        '</div>' +
        '<div class="d-flex align-items-center justify-content-between text-muted fs-12 px-1">' +
        '<span>Showing strictly the <strong>' + roster.length + ' selected candidate' + (roster.length === 1 ? '' : 's') + '</strong> for this stage.</span>' +
        '<span class="badge bg-light text-secondary border font-monospace">Candidate Roster</span>' +
        '</div>'
        : '<div class="p-4 text-center rounded border bg-light">' +
        '<div class="avatar xl mx-auto mb-2 bg-white text-muted border"><i class="bi bi-people fs-3"></i></div>' +
        '<h6 class="fw-bold text-dark mb-1">No Candidates Selected</h6>' +
        '<p class="fs-12 text-muted mb-3">Please return to the Candidate List step to select and confirm candidates for this stage.</p>' +
        '<a href="#/circular/' + c.id + '/stage/' + stg.id + '/search" class="btn btn-sm btn-green-solid px-3 py-1.5"><i class="bi bi-people me-1"></i> Open Candidate List</a>' +
        '</div>');

    /* Trail Card Action Buttons */
    var trailActionsHtml = '';
    if (!ap || ap.status === 'REJECTED') {
      if (isHrAdmin) {
        var isSendDisabled = !canSend;
        var btnTitle = approvers.length === 0
          ? 'Add approvers to send'
          : (!roster.length ? 'Confirm candidates to send' : 'Send for approval');

        trailActionsHtml =
          '<div class="pt-3 border-top mt-3">' +
          '<button type="button" class="btn btn-green-solid w-100 py-2.5 fw-semibold shadow-xs d-flex align-items-center justify-content-center gap-2" id="btn-card-send"' +
          (isSendDisabled ? ' disabled="disabled" aria-disabled="true"' : '') +
          ' title="' + fmt.esc(btnTitle) + '">' +
          '<i class="bi bi-send-fill"></i> ' + (ap ? 'Send Revised Request' : 'Send for Approval') +
          '</button>' +
          '</div>';
      } else {
        trailActionsHtml =
          '<div class="pt-3 border-top mt-3">' +
          '<button type="button" class="btn btn-secondary opacity-60 w-100 py-2.5 fw-semibold d-flex align-items-center justify-content-center gap-2" id="btn-card-send" disabled title="Only HR Admin · Senior Officer can send for approval">' +
          '<i class="bi bi-shield-lock"></i> Send for Approval (HR Admin only)' +
          '</button>' +
          '<div class="text-center text-muted fs-11 mt-1.5"><i class="bi bi-info-circle me-1"></i>Only <strong>HR Admin · Senior Officer</strong> can initiate approval requests.</div>' +
          '</div>';
      }
    } else if (isApproverTurn) {
      trailActionsHtml =
        '<div class="pt-3 border-top mt-3 d-flex gap-2">' +
        '<button type="button" class="btn btn-success flex-fill py-2.5 shadow-xs fw-semibold d-flex align-items-center justify-content-center gap-1.5" id="btn-card-approve">' +
        '<i class="bi bi-check2-circle"></i> Confirm Approval as ' + fmt.esc(me.name.split(' ')[0]) +
        '</button>' +
        '<button type="button" class="btn btn-outline-danger flex-fill py-2.5 fw-semibold d-flex align-items-center justify-content-center gap-1.5" id="btn-card-reject">' +
        '<i class="bi bi-x-circle"></i> Reject Request' +
        '</button>' +
        '</div>';
    }

    /* Main Grid: Clean two-column layout without redundant Approval sequence card */
    var body =
      '<div class="row g-3">' +
      '<!-- Left Column: Unified Approval Trail -->' +
      '<div class="col-lg-5">' +
      ui.card({
        title: 'Approval trail',
        hint: ap
          ? ('Requested by ' + fmt.esc(ap.createdBy) + ' · ' + fmt.dateTime(ap.createdAt))
          : ('Configured in Approval Channel: ' + approvers.length + ' level(s)'),
        body: (ap ? renderActiveTimeline(ap, me) : renderDraftTimeline(approvers)) +
          trailActionsHtml +
          '<div class="mt-3 pt-2 border-top d-flex align-items-center justify-content-between text-muted fs-12">' +
          '<span>Acting as: <strong>' + fmt.esc(me.name) + '</strong> (' + fmt.esc(me.designation) + ')</span>' +
          '<span class="badge bg-light text-secondary border font-monospace">' + fmt.esc(me.role) + '</span>' +
          '</div>'
      }) +
      '</div>' +

      '<!-- Right Column: Candidate Roster Selected -->' +
      '<div class="col-lg-7">' +
      ui.card({
        title: 'Candidate roster being authorized',
        hint: summary,
        actions: '<button class="btn btn-sm btn-outline-primary" id="btn-details"><i class="bi bi-eye me-1"></i> View Full List / Print</button>',
        body: payload
      }) +
      '</div>' +
      '</div>';

    /* Bottom Action Bar */
    var action = {
      secondary: []
    };

    if (!state || !state.done) {
      if (!ap || ap.status === 'REJECTED') {
        action.primary = {
          id: 'btn-send',
          icon: 'bi-send',
          label: ap ? 'Send revised request' : 'Send for approval',
          disabled: !canSend || !isHrAdmin
        };
      }
      if (!required) action.secondary.push({ id: 'btn-skip', label: 'Skip — not needed' });
    } else {
      action.note = state.skipped ? 'This step was skipped' : 'Authorized';
    }

    if (isApproverTurn) {
      if (action.primary) action.secondary.push({ id: action.primary.id, label: action.primary.label });
      action.primary = {
        id: 'btn-approve',
        tone: 'success',
        icon: 'bi-check-lg',
        label: 'Approve as ' + me.name.split(' ')[0]
      };
      action.secondary.push({ id: 'btn-reject', label: 'Reject', tone: 'outline-danger' });
    }

    ui.stagePage(view, stg, STEP_KEY, { body: body, action: action });

    /* ---------- Event Bindings ---------- */

    // Switch Acting Personnel button handlers
    ui.on(view, '[data-switch-user]', 'click', function (e, b) {
      var uid = b.dataset.switchUser;
      if (!uid) return;
      store.setActingUser(uid);
      var nu = store.find('users', uid);
      ui.toast('Acting as ' + (nu ? nu.name : uid) + (nu ? ' (' + nu.designation + ')' : ''), 'info');
      ERec.app.renderAll();
    });

    var detBtn = view.querySelector('#btn-details');
    if (detBtn) detBtn.addEventListener('click', function () { detailsModal(stg); });

    function doSend() {
      if (!canSend) {
        ui.toast('Cannot send: please ensure candidates are selected and approvers configured.', 'warning');
        return;
      }
      send(stg, summary);
      ui.toast('Sent for approval to ' + (store.find('users', approvers[0]) || {}).name, 'success');
      ERec.app.renderAll();
    }

    var sendBtn = view.querySelector('#btn-send');
    if (sendBtn) sendBtn.addEventListener('click', doSend);
    var cardSendBtn = view.querySelector('#btn-card-send');
    if (cardSendBtn) cardSendBtn.addEventListener('click', doSend);

    var skipBtn = view.querySelector('#btn-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', function () {
        ui.confirm({
          title: 'Skip approval',
          body: 'This optional approval will be marked as skipped and the pipeline will move on.',
          okText: 'Skip step'
        }).then(function (ok) {
          if (!ok) return;
          store.markStep(stg.id, STEP_KEY, { skipped: true });
          store.audit('SKIP_APPROVAL', 'stage', stg.id, 'Applicant approval skipped');
          ui.toast('Step skipped');
          ERec.router.refresh();
        });
      });
    }

    function doApprove() {
      decisionModal(ap, 'APPROVED', function () { ERec.app.renderAll(); });
    }
    function doReject() {
      decisionModal(ap, 'REJECTED', function () { ERec.app.renderAll(); });
    }

    var apr = view.querySelector('#btn-approve');
    if (apr) apr.addEventListener('click', doApprove);
    var cardApr = view.querySelector('#btn-card-approve');
    if (cardApr) cardApr.addEventListener('click', doApprove);

    var rej = view.querySelector('#btn-reject');
    if (rej) rej.addEventListener('click', doReject);
    var cardRej = view.querySelector('#btn-card-reject');
    if (cardRej) cardRej.addEventListener('click', doReject);
  }

  // Register Candidate Approval Page
  ERec.pages.approvecandidate = { render: render };
  ERec.pages.approveCandidate = ERec.pages.approvecandidate;

  // Candidate Approval API
  ERec.candidateApproval = {
    send: send,
    act: act,
    decisionModal: decisionModal,
    detailsModal: detailsModal,
    renderActiveTimeline: renderActiveTimeline,
    renderDraftTimeline: renderDraftTimeline
  };

  // Augment ERec.approvals for backward compatibility
  ERec.approvals = ERec.approvals || {};
  var prevSend = ERec.approvals.send;
  ERec.approvals.send = function (stg, kind, summary) {
    if (kind === KIND) return send(stg, summary);
    if (prevSend) return prevSend(stg, kind, summary);
    return null;
  };
  var prevDetails = ERec.approvals.detailsModal;
  ERec.approvals.detailsModal = function (stg, kind) {
    if (kind === KIND) return detailsModal(stg);
    if (prevDetails) return prevDetails(stg, kind);
    return null;
  };
  if (!ERec.approvals.decisionModal) ERec.approvals.decisionModal = decisionModal;
  if (!ERec.approvals.act) ERec.approvals.act = act;
})(window);
