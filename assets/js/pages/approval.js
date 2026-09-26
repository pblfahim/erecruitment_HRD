/* Optional approval steps (applicant list + venue).
   Always visible so the user knows the option exists; skippable when the
   stage does not require it. Decisions are taken from the approver inbox
   or directly on this page after switching role. */
(function (global) {
  'use strict';

  var ERec = global.ERec = global.ERec || {};
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var KIND = { 'approval-applicant': 'APPLICANT', 'approval-venue': 'VENUE' };

  function stepKeyFor(kind) { return kind === 'APPLICANT' ? 'approval-applicant' : 'approval-venue'; }

  /* ---------- shared approval mechanics (also used by the inbox & venue) ---------- */

  function send(stg, kind, summary) {
    var field = kind === 'APPLICANT' ? 'applicantApprovers' : 'venueApprovers';
    var ids = stg[field] || [];
    var ap = store.insert('approvals', {
      id: fmt.uid('apr'),
      circularId: stg.circularId, stageId: stg.id, kind: kind,
      summary: summary, status: 'PENDING', currentSeq: 0,
      createdAt: new Date().toISOString(), createdBy: store.actingUser().name,
      chain: ids.map(function (uid, i) {
        var u = store.find('users', uid) || { name: uid, designation: 'Approver' };
        return {
          seq: i, userId: uid, name: u.name, designation: u.designation,
          status: 'PENDING', remarks: '', actedAt: null
        };
      })
    });
    store.audit('SEND_APPROVAL', 'approval', ap.id,
      (kind === 'APPLICANT' ? 'Candidate roster' : 'Venue plan') + ' sent for approval · ' + pipe.typeLabel(stg.type));
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
      (ap.kind === 'APPLICANT' ? 'Candidate roster' : 'Venue plan') + ' ' + decision.toLowerCase() +
      ' · ' + (stg ? pipe.typeLabel(stg.type) : ''));
    store.save();
    return ap;
  }

  function decisionModal(ap, decision, after) {
    var isApprove = decision === 'APPROVED';
    ui.modal({
      title: (isApprove ? 'Approve' : 'Reject') + ' — ' + (ap.kind === 'APPLICANT' ? 'Candidate Roster' : 'Exam Venue Plan'),
      body: '<div class="fs-13 mb-3 text-muted">' + fmt.esc(ap.summary) + '</div>' +
        '<label class="form-label fw-semibold">Remarks' + (isApprove ? ' (optional)' : ' <span class="text-danger">*</span>') + '</label>' +
        '<textarea class="form-control" id="f-rem" rows="3" placeholder="' +
        (isApprove ? 'Verified and approved.' : 'State the reason for rejection.') + '"></textarea>',
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-' + (isApprove ? 'success' : 'danger') + '" data-act="go">' +
        (isApprove ? '<i class="bi bi-check2-circle me-1"></i> Confirm Approval' : '<i class="bi bi-x-circle me-1"></i> Reject Request') + '</button>',
      onShow: function (api) {
        api.find('[data-act="go"]').addEventListener('click', function () {
          var rem = api.find('#f-rem').value.trim();
          if (!isApprove && !rem) { ui.toast('Remarks are required when rejecting', 'warning'); return; }
          act(ap.id, decision, rem);
          api.close();
          ui.toast(isApprove ? 'Approval granted successfully' : 'Request rejected', isApprove ? 'success' : 'danger');
          if (after) after();
        });
      }
    });
  }

  /* Full payload behind an approval request */
  function detailsModal(stg, kind) {
    var c = store.circular(stg.circularId);
    var roster = store.rosterOf(stg.id);
    var venues = store.venuesOf(stg.id);

    var body = kind === 'APPLICANT'
      ? '<div class="verify-summary mb-3 p-3 bg-light rounded border d-flex gap-4 justify-content-around text-center">' +
          '<div><div class="fs-4 fw-bold text-success">' + roster.length + '</div><div class="fs-12 text-muted">Total Candidates</div></div>' +
          '<div><div class="fs-4 fw-bold text-dark">' + roster.filter(function (r) { return r.rollNo; }).length + '</div><div class="fs-12 text-muted">Roll Numbers Allocated</div></div>' +
          '<div><div class="fs-4 fw-bold text-primary">' + c.vacancies + '</div><div class="fs-12 text-muted">Approved Vacancies</div></div>' +
        '</div>' +
        (roster.length
          ? '<div class="table-responsive" style="max-height:60vh"><table class="table table-striped table-hover align-middle table-x" id="table-approval-roster"><thead><tr>' +
            '<th>#</th><th>Roll</th><th>Application no.</th><th>Candidate</th><th>Father\'s name</th>' +
            '<th>Degree</th><th>Mobile</th></tr></thead><tbody>' +
            roster.map(function (r, i) {
              var a = store.applicant(r.applicantId) || {};
              return '<tr><td class="num muted">' + (i + 1) + '</td>' +
                '<td class="mono nowrap">' + fmt.esc(r.rollNo || '—') + '</td>' +
                '<td class="mono fs-12">' + fmt.esc(a.appNo || '—') + '</td>' +
                '<td class="fw-semibold">' + fmt.esc(a.name || '—') + '</td>' +
                '<td class="fs-12">' + fmt.esc(a.fatherName || '—') + '</td>' +
                '<td class="fs-12">' + fmt.esc(ERec.pages.applicants ? ERec.pages.applicants.highestEdu(a) : (a.highestDegree || '—')) + '</td>' +
                '<td class="mono fs-12">' + fmt.esc(a.mobile || '—') + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : ui.empty('No candidate on this list'))
      : (venues.length
        ? venues.map(function (v) {
          var seated = roster.filter(function (r) {
            return r.rollNo && String(r.rollNo) >= String(v.rollFrom) && String(r.rollTo) && String(r.rollNo) <= String(v.rollTo);
          });
          return '<div class="card mb-3 shadow-sm border"><div class="card-body">' +
            '<div class="fw-bold fs-14 text-dark">' + fmt.esc(v.name) + '</div>' +
            '<div class="fs-12 text-muted mb-2">' + fmt.esc(v.address || 'Address not set') + '</div>' +
            '<div class="row g-2 fs-12">' +
              '<div class="col-sm-6"><strong>Exam date:</strong> ' + fmt.date(v.examDate) + '</div>' +
              '<div class="col-sm-6"><strong>Reporting time:</strong> ' + fmt.time12(v.reportingTime || fmt.shiftTime(v.startTime, -30)) + '</div>' +
              '<div class="col-sm-6"><strong>Exam time:</strong> ' + fmt.time12(v.startTime) + ' – ' + fmt.time12(v.endTime) + '</div>' +
              '<div class="col-sm-6"><strong>Roll range:</strong> <span class="mono fw-semibold">' + fmt.esc(v.rollFrom || '—') + ' – ' + fmt.esc(v.rollTo || '—') + '</span></div>' +
              '<div class="col-12"><strong>Seats:</strong> ' + seated.length + ' allocated of ' + v.capacity + ' total capacity</div>' +
            '</div></div></div>';
        }).join('')
        : ui.empty('No venue set up'));

    ui.modal({
      title: (kind === 'APPLICANT' ? 'Candidate Roster List' : 'Exam Venue Allocation Plan') + ' · ' + fmt.esc(pipe.typeLabel(stg.type)) +
        ' · ' + fmt.esc(c.post),
      size: 'xl',
      body: body,
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Close</button>' +
        (kind === 'APPLICANT'
          ? '<button class="btn btn-sm btn-primary" data-act="print"><i class="bi bi-printer me-1"></i> Print list</button>'
          : ''),
      onShow: function (api) {
        var p = api.find('[data-act="print"]');
        if (p) p.addEventListener('click', function () {
          api.close();
          if (ERec.exp && ERec.exp.printDoc) ERec.exp.printDoc('applicant-list', stg.id);
        });
      }
    });
  }

  /* Edit Approvers Modal */
  function editApproversModal(stg, kind, onSave) {
    var field = kind === 'APPLICANT' ? 'applicantApprovers' : 'venueApprovers';
    var chosen = (stg[field] || []).slice();
    var approvers = store.where('users', function (u) { return u.role === 'APPROVER'; });

    function listHtml() {
      var picked = chosen.map(function (id, i) {
        var u = store.find('users', id) || { name: id, designation: 'Approver' };
        return '<div class="d-flex align-items-center gap-2 border rounded p-2 mb-2 bg-white shadow-sm">' +
          '<span class="pill green">Level ' + (i + 1) + '</span>' +
          '<div class="flex-grow-1 min-w-0">' +
          '<div class="fw-semibold fs-13 text-dark text-truncate">' + fmt.esc(u.name) + '</div>' +
          '<div class="fs-12 text-muted text-truncate">' + fmt.esc(u.designation) + '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-sm btn-light border" data-up="' + id + '"' + (i === 0 ? ' disabled' : '') + ' title="Move Up"><i class="bi bi-arrow-up"></i></button>' +
          '<button type="button" class="btn btn-sm btn-light border" data-down="' + id + '"' + (i === chosen.length - 1 ? ' disabled' : '') + ' title="Move Down"><i class="bi bi-arrow-down"></i></button>' +
          '<button type="button" class="btn btn-sm btn-outline-danger" data-rm="' + id + '" title="Remove"><i class="bi bi-x-lg"></i></button>' +
          '</div>';
      }).join('');

      var avail = approvers.filter(function (u) { return chosen.indexOf(u.id) < 0; });
      return '<div class="fw-bold fs-13 text-dark mb-2"><i class="bi bi-diagram-3 me-1 text-success"></i> Configured Sequence (Approves in order)</div>' +
        (picked || '<div class="fs-13 text-muted mb-3 p-3 bg-light rounded border text-center">No approver selected. This approval step will be optional.</div>') +
        '<div class="fw-bold fs-13 text-dark mt-3 mb-2"><i class="bi bi-person-plus me-1 text-success"></i> Add Available Approvers</div>' +
        (avail.length ? avail.map(function (u) {
          return '<button type="button" class="btn btn-sm btn-light d-flex align-items-center gap-2 w-100 mb-2 text-start p-2 border" data-add="' + u.id + '">' +
            ui.avatar(u.name, 'sm') +
            '<span class="flex-grow-1 min-w-0">' +
            '<span class="d-block fw-semibold fs-13 text-dark text-truncate">' + fmt.esc(u.name) + '</span>' +
            '<span class="d-block fs-12 text-muted text-truncate">' + fmt.esc(u.designation) + '</span>' +
            '</span>' +
            '<i class="bi bi-plus-lg text-success ms-auto fs-14"></i></button>';
        }).join('') : '<div class="fs-12 text-muted p-2 bg-light rounded text-center">All available bank approvers have been added to this sequence.</div>');
    }

    ui.modal({
      title: 'Configure Approver Sequence · ' + pipe.typeLabel(stg.type) + ' · ' + (kind === 'APPLICANT' ? 'Candidate Roster' : 'Exam Venues'),
      body: '<div id="ap-edit-body">' + listHtml() + '</div>',
      footer: '<button class="btn btn-sm btn-outline-secondary px-3" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-success px-4" data-act="save"><i class="bi bi-check2-circle me-1"></i> Save Routing Sequence</button>',
      onShow: function (api) {
        function rebind() {
          var body = api.find('#ap-edit-body');
          body.innerHTML = listHtml();
          body.querySelectorAll('[data-add]').forEach(function (b) {
            b.addEventListener('click', function () { chosen.push(b.dataset.add); rebind(); });
          });
          body.querySelectorAll('[data-rm]').forEach(function (b) {
            b.addEventListener('click', function () {
              chosen = chosen.filter(function (x) { return x !== b.dataset.rm; });
              rebind();
            });
          });
          body.querySelectorAll('[data-up]').forEach(function (b) {
            b.addEventListener('click', function () {
              var i = chosen.indexOf(b.dataset.up);
              if (i > 0) { chosen.splice(i - 1, 0, chosen.splice(i, 1)[0]); rebind(); }
            });
          });
          body.querySelectorAll('[data-down]').forEach(function (b) {
            b.addEventListener('click', function () {
              var i = chosen.indexOf(b.dataset.down);
              if (i < chosen.length - 1) { chosen.splice(i + 1, 0, chosen.splice(i, 1)[0]); rebind(); }
            });
          });
        }
        rebind();
        api.find('[data-act="save"]').addEventListener('click', function () {
          var patch = {};
          patch[field] = chosen;
          store.update('stages', stg.id, patch);
          store.audit('SET_APPROVERS', 'stage', stg.id, kind + ' approvers updated for ' + pipe.typeLabel(stg.type));
          api.close();
          ui.toast('Approval sequence saved successfully');
          if (onSave) onSave();
          else ERec.router.refresh();
        });
      }
    });
  }

  /* ---------- timelines ---------- */

  function renderDraftTimeline(approvers) {
    if (!approvers || !approvers.length) {
      return ui.alert('warn', 'No approver sequence configured. Click <strong>Edit</strong> above to assign bank officers.');
    }
    return '<div class="timeline">' + approvers.map(function (uid, i) {
      var u = store.find('users', uid) || { name: uid, designation: 'Approver' };
      var isFirst = i === 0;
      return '<div class="tl-item' + (isFirst ? ' now' : '') + '">' +
        '<span class="tl-dot"><i class="bi ' + (isFirst ? 'bi-hourglass-split' : 'bi-dot') + '"></i></span>' +
        '<div class="tl-title">Level ' + (i + 1) + ' · ' + fmt.esc(u.name) + ' ' +
        (isFirst ? ui.pill('First in line', 'amber') : ui.pill('Queued', 'grey')) + '</div>' +
        '<div class="tl-meta">' + fmt.esc(u.designation) + ' · Pending workflow initiation</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function timeline(ap, me) {
    if (!ap.chain || !ap.chain.length) {
      return ui.alert('warn', 'No approver was configured, so this request has nothing to route to.');
    }
    me = me || store.actingUser();
    return '<div class="timeline">' + ap.chain.map(function (l, i) {
      var isCur = ap.status === 'PENDING' && i === ap.currentSeq;
      var cls = l.status === 'APPROVED' ? 'ok' : l.status === 'REJECTED' ? 'no' : (isCur ? 'now' : '');
      var icon = l.status === 'APPROVED' ? 'bi-check-lg' : l.status === 'REJECTED' ? 'bi-x-lg'
        : (cls === 'now' ? 'bi-hourglass-split' : 'bi-dot');
      var isMyTurn = isCur && l.userId === me.id;

      var pillHtml = '';
      if (l.status === 'APPROVED' || l.status === 'REJECTED') {
        pillHtml = ui.statusPill(l.status);
      } else if (isMyTurn) {
        pillHtml = '<span class="pill green fw-bold"><i class="bi bi-person-check me-1"></i>Your turn to act</span>';
      } else if (isCur) {
        pillHtml = '<span class="pill amber"><i class="bi bi-hourglass-split me-1"></i>Awaiting sign-off</span>';
      } else {
        pillHtml = ui.pill('Queued', 'grey');
      }

      var switchBtn = '';
      if (isCur && !isMyTurn) {
        switchBtn = ' <button type="button" class="btn btn-xs btn-outline-success py-0 px-2 ms-2 fs-11" data-switch-user="' + l.userId + '" title="Switch Acting Personnel to ' + fmt.esc(l.name) + '">' +
          '<i class="bi bi-person-switch me-1"></i>Switch to ' + fmt.esc(l.name.split(' ')[0]) + '</button>';
      }

      return '<div class="tl-item ' + cls + '"><span class="tl-dot"><i class="bi ' + icon + '"></i></span>' +
        '<div class="tl-title d-flex align-items-center flex-wrap gap-1">Level ' + (i + 1) + ' · ' + fmt.esc(l.name) + ' ' +
          pillHtml + switchBtn + '</div>' +
        '<div class="tl-meta">' + fmt.esc(l.designation) +
          (l.actedAt ? ' · ' + fmt.dateTime(l.actedAt) : '') + '</div>' +
        (l.remarks ? '<div class="fs-12 mt-1 fst-italic text-secondary bg-light p-2 rounded border">“' + fmt.esc(l.remarks) + '”</div>' : '') +
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
      ? ('<div class="row g-2 mb-3">' +
          '<div class="col-sm-4 col-6"><div class="p-2 border rounded bg-light text-center">' +
            '<div class="fs-11 text-muted text-uppercase fw-bold">Candidates</div>' +
            '<div class="fs-5 fw-bold text-success">' + roster.length + '</div>' +
          '</div></div>' +
          '<div class="col-sm-4 col-6"><div class="p-2 border rounded bg-light text-center">' +
            '<div class="fs-11 text-muted text-uppercase fw-bold">Roll Allocated</div>' +
            '<div class="fs-5 fw-bold text-dark">' + roster.filter(function (r) { return r.rollNo; }).length + '</div>' +
          '</div></div>' +
          '<div class="col-sm-4 col-12"><div class="p-2 border rounded bg-light text-center">' +
            '<div class="fs-11 text-muted text-uppercase fw-bold">Vacancies</div>' +
            '<div class="fs-5 fw-bold text-primary">' + c.vacancies + '</div>' +
          '</div></div>' +
        '</div>' +
        (roster.length
          ? '<div class="table-responsive" style="max-height:55vh"><table class="table table-striped table-hover align-middle table-x mb-0"><thead><tr>' +
            '<th>#</th><th>Roll</th><th>Application no.</th><th>Candidate</th><th>Degree</th><th>Mobile</th></tr></thead><tbody>' +
            roster.slice(0, 15).map(function (r, i) {
              var a = store.applicant(r.applicantId) || {};
              return '<tr><td class="num muted">' + (i + 1) + '</td>' +
                '<td class="mono nowrap">' + fmt.esc(r.rollNo || '—') + '</td>' +
                '<td class="mono fs-12">' + fmt.esc(a.appNo || '—') + '</td>' +
                '<td class="fw-semibold">' + fmt.esc(a.name || '—') + '</td>' +
                '<td class="fs-12">' + fmt.esc(ERec.pages.applicants ? ERec.pages.applicants.highestEdu(a) : (a.highestDegree || '—')) + '</td>' +
                '<td class="mono fs-12">' + fmt.esc(a.mobile || '—') + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            (roster.length > 15 ? '<div class="fs-12 text-muted mt-2 text-center">Showing first 15 of ' + roster.length + ' candidates. Use "View full list" to review all.</div>' : '')
          : ui.empty('No candidate list yet', 'Confirm the applicant list first in stage setup.', 'bi-people')))
      : ('<div class="row g-2 mb-3">' +
          '<div class="col-sm-4 col-6"><div class="p-2 border rounded bg-light text-center">' +
            '<div class="fs-11 text-muted text-uppercase fw-bold">Venues</div>' +
            '<div class="fs-5 fw-bold text-dark">' + venues.length + '</div>' +
          '</div></div>' +
          '<div class="col-sm-4 col-6"><div class="p-2 border rounded bg-light text-center">' +
            '<div class="fs-11 text-muted text-uppercase fw-bold">Total Capacity</div>' +
            '<div class="fs-5 fw-bold text-primary">' + venues.reduce(function (s, v) { return s + (v.capacity || 0); }, 0) + '</div>' +
          '</div></div>' +
          '<div class="col-sm-4 col-12"><div class="p-2 border rounded bg-light text-center">' +
            '<div class="fs-11 text-muted text-uppercase fw-bold">Seated Candidates</div>' +
            '<div class="fs-5 fw-bold text-success">' + roster.filter(function (r) { return r.venueId; }).length + '</div>' +
          '</div></div>' +
        '</div>' +
        (venues.length
          ? '<div class="table-responsive"><table class="table table-striped table-hover align-middle table-x mb-0"><thead><tr><th>Venue</th><th>Date</th><th>Time</th><th>Roll range</th></tr></thead><tbody>' +
            venues.map(function (v) {
              return '<tr><td><div class="fw-semibold">' + fmt.esc(v.name) + '</div><div class="fs-12 text-muted">' +
                fmt.esc(v.address || '') + '</div></td><td class="nowrap">' + fmt.date(v.examDate) + '</td>' +
                '<td class="nowrap">' + fmt.time12(v.startTime) + ' – ' + fmt.time12(v.endTime) + '</td>' +
                '<td class="mono nowrap">' + fmt.esc(v.rollFrom) + ' – ' + fmt.esc(v.rollTo) + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : ui.empty('No venue set up yet', 'Add a venue before sending it for approval.', 'bi-geo-alt')));

    /* status banner */
    if (state && state.skipped) {
      body += ui.alert('ok', '<strong>This approval was skipped.</strong> It is optional for this stage.' +
        ' <button class="btn btn-sm btn-link p-0 align-baseline" id="btn-unskip">Undo skip</button>');
    } else if (ap && ap.status === 'PENDING') {
      var lvl = ap.chain[ap.currentSeq];
      if (lvl && lvl.userId === me.id) {
        body += ui.alert('warn', '<strong>Action Required: ' + (kind === 'APPLICANT' ? 'Candidate roster' : 'Venue plan') +
          ' is awaiting your sign-off as ' + fmt.esc(me.name) + ' (' + fmt.esc(me.designation) + ').</strong> ' +
          'Review the trail and approve or reject below.');
      } else {
        body += ui.alert('warn', '<strong>Awaiting approval from ' + fmt.esc(lvl ? lvl.name : '—') + ' (' + fmt.esc(lvl ? lvl.designation : '') + ').</strong> ' +
          'Switch role to act on this request: ' +
          (lvl ? '<button type="button" class="btn btn-sm btn-outline-warning ms-2" data-switch-user="' + lvl.userId + '"><i class="bi bi-person-switch me-1"></i> Switch to ' + fmt.esc(lvl.name) + '</button>' : ''));
      }
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
        'You can still send it for sign-off, or skip straight to the next step.');
    } else {
      body += ui.alert('warn', '<strong>Approval is required for this stage.</strong> ' +
        'The steps after this one stay locked until every approver has approved.');
    }

    /* approver chain card */
    var chainHtml = approvers.length
      ? '<div class="chain mb-2 d-flex flex-wrap align-items-center gap-1">' + approvers.map(function (id, i) {
        var u = store.find('users', id) || { name: id, designation: 'Approver' };
        return (i ? '<span class="arrow text-muted mx-1"><i class="bi bi-chevron-right fs-12"></i></span>' : '') +
          '<span class="pill blue py-1 px-2"><i class="bi bi-person-badge me-1"></i>L' + (i + 1) + ' · ' + fmt.esc(u.name) + '</span>';
      }).join('') + '</div>' +
      '<div class="fs-12 text-muted">Each level must approve in sequence before this step is marked complete.</div>'
      : ui.alert('warn', 'No approver configured for this stage. Set the approval sequence before sending.');

    var canSend = (kind === 'APPLICANT' ? roster.length : venues.length) && approvers.length;
    var myTurn = ap && ap.status === 'PENDING' && ap.chain[ap.currentSeq] &&
      ap.chain[ap.currentSeq].userId === me.id;

    body += '<div class="row g-3"><div class="col-lg-5">' +
      ui.card({
        title: 'Approval sequence',
        hint: 'Configured in Job Circular Approval Channel.',
        actions: '<button class="btn btn-sm btn-light" id="btn-edit-approvers"><i class="bi bi-pencil me-1"></i> Edit</button>',
        body: chainHtml +
          '<hr class="hr-soft my-3">' +
          '<div class="form-check form-switch">' +
            '<input class="form-check-input" type="checkbox" id="f-required"' + (required ? ' checked' : '') + '>' +
            '<label class="form-check-label fs-13 fw-semibold text-dark" for="f-required">Approval required at this stage</label>' +
          '</div>' +
          '<div class="fs-11 text-muted mt-1">When active, the pipeline cannot proceed until all approvers have signed off.</div>'
      }) +
      ui.card({
        title: 'Approval trail',
        hint: ap
          ? ('Requested by ' + fmt.esc(ap.createdBy) + ' · ' + fmt.dateTime(ap.createdAt))
          : ('Configured in Approval Channel: ' + approvers.length + ' level(s)'),
        actions: (!ap || ap.status === 'REJECTED'
          ? '<button type="button" class="btn btn-sm btn-outline-success" id="btn-card-send"' + (canSend ? '' : ' disabled') + '>' +
            '<i class="bi bi-send me-1"></i> ' + (ap ? 'Send revised request' : 'Send for approval') + '</button>'
          : ''),
        body: (ap ? timeline(ap, me) : renderDraftTimeline(approvers)) +
          (myTurn
            ? '<div class="mt-3 pt-3 border-top d-flex gap-2">' +
              '<button type="button" class="btn btn-sm btn-success flex-fill" id="btn-card-approve"><i class="bi bi-check2-circle me-1"></i> Approve ' + (kind === 'APPLICANT' ? 'Candidate List' : 'Venue Plan') + ' as ' + fmt.esc(me.name.split(' ')[0]) + '</button>' +
              '<button type="button" class="btn btn-sm btn-outline-danger flex-fill" id="btn-card-reject"><i class="bi bi-x-circle me-1"></i> Reject</button>' +
              '</div>'
            : '') +
          '<div class="mt-3 pt-2 border-top d-flex align-items-center justify-content-between text-muted fs-12">' +
            '<span>Acting as: <strong>' + fmt.esc(me.name) + '</strong> (' + fmt.esc(me.designation) + ')</span>' +
            '<span class="badge bg-light text-secondary border">' + fmt.esc(me.role) + '</span>' +
          '</div>'
      }) +
      '</div><div class="col-lg-7">' +
      ui.card({
        title: kind === 'APPLICANT' ? 'Candidate list being sent' : 'Venue plan being sent',
        hint: summary,
        actions: '<button class="btn btn-sm btn-light" id="btn-details"><i class="bi bi-eye me-1"></i> View Full List</button>',
        body: payload
      }) +
      '</div></div>';

    /* footer actions */
    var action = { secondary: [{ id: 'btn-details-bottom', label: kind === 'APPLICANT' ? 'View full list' : 'View venue details', icon: 'bi-list-ul' }] };

    if (!state || !state.done) {
      if (!ap || ap.status === 'REJECTED') {
        action.primary = {
          id: 'btn-send', icon: 'bi-send',
          label: ap ? 'Send revised request' : 'Send for approval', disabled: !canSend
        };
      }
      if (!required) action.secondary.push({ id: 'btn-skip', label: 'Skip — not needed' });
    } else {
      action.note = state.skipped ? 'This step was skipped' : 'Approved';
    }

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
    // Switch Acting Personnel button handlers
    ui.on(view, '[data-switch-user]', 'click', function (e, b) {
      var uid = b.dataset.switchUser;
      if (!uid) return;
      store.setActingUser(uid);
      var nu = store.find('users', uid);
      ui.toast('Acting as ' + (nu ? nu.name : uid) + (nu ? ' (' + nu.designation + ')' : ''), 'info');
      ERec.app.renderAll();
    });

    var editBtn = view.querySelector('#btn-edit-approvers');
    if (editBtn) editBtn.addEventListener('click', function () {
      editApproversModal(stg, kind, function () { ERec.router.refresh(); });
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
    var detBtnBot = view.querySelector('#btn-details-bottom');
    if (detBtnBot) detBtnBot.addEventListener('click', function () { detailsModal(stg, kind); });

    function doSend() {
      send(stg, kind, summary);
      ui.toast('Sent for approval to ' + (store.find('users', approvers[0]) || {}).name);
      ERec.app.renderAll();
    }

    var sendBtn = view.querySelector('#btn-send');
    if (sendBtn) sendBtn.addEventListener('click', doSend);
    var cardSendBtn = view.querySelector('#btn-card-send');
    if (cardSendBtn) cardSendBtn.addEventListener('click', doSend);

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
        ERec.router.refresh();
      });
    });

    var unskip = view.querySelector('#btn-unskip');
    if (unskip) unskip.addEventListener('click', function () {
      store.clearStep(stg.id, stepKey);
      ui.toast('Skip undone');
      ERec.router.refresh();
    });

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

  // Also expose editApprovers on ERec.pages.circular if missing
  if (ERec.pages && ERec.pages.circular) {
    ERec.pages.circular.editApprovers = editApproversModal;
  }

  ERec.pages.approval = { render: render };
  ERec.approvals = {
    send: send,
    act: act,
    timeline: timeline,
    renderDraftTimeline: renderDraftTimeline,
    editApproversModal: editApproversModal,
    decisionModal: decisionModal,
    detailsModal: detailsModal
  };
})(window);
