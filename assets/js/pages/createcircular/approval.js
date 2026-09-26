/* Create Job Posting - Step 3: Approval Channel.
   Configures approval sequences and displays the approval trail for
   both Candidate List Approval (APPLICANT) and Exam Venue Approval (VENUE) phases.
   Supports live switching of Acting Personnel to test or execute approvals. */
(function (global) {
  'use strict';

  var ERec = global.ERec = global.ERec || {};
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var PHASES = [
    {
      key: 'APPLICANT',
      stepKey: 'approval-applicant',
      label: 'Approval for Candidate List',
      shortLabel: 'Candidate List',
      icon: 'bi-person-check',
      badgeText: 'Applicant Roster',
      desc: 'Hierarchical review & authorization of the verified candidate roster prior to roll number assignment and admit card issuance.'
    },
    {
      key: 'VENUE',
      stepKey: 'approval-venue',
      label: 'Approval for Exam Venue',
      shortLabel: 'Exam Venue',
      icon: 'bi-building-check',
      badgeText: 'Venue & Seating',
      desc: 'Hierarchical review & authorization of examination venues, hall capacities, reporting times, and seating arrangements.'
    }
  ];

  /* ---------- Approval Actions & Modals ---------- */

  function sendApprovalRequest(stg, kind, summary) {
    var field = kind === 'APPLICANT' ? 'applicantApprovers' : 'venueApprovers';
    var ids = stg[field] || [];
    var ap = store.insert('approvals', {
      id: fmt.uid('apr'),
      circularId: stg.circularId,
      stageId: stg.id,
      kind: kind,
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
      (kind === 'APPLICANT' ? 'Candidate roster' : 'Venue plan') + ' sent for approval · ' + pipe.typeLabel(stg.type));
    return ap;
  }

  function actOnApproval(approvalId, decision, remarks) {
    var ap = store.find('approvals', approvalId);
    if (!ap || ap.status !== 'PENDING') return null;
    var level = ap.chain[ap.currentSeq];
    if (!level) return null;

    level.status = decision;
    level.remarks = remarks || '';
    level.actedAt = new Date().toISOString();

    var stepKey = ap.kind === 'APPLICANT' ? 'approval-applicant' : 'approval-venue';
    if (decision === 'REJECTED') {
      ap.status = 'REJECTED';
      store.clearStep(ap.stageId, stepKey);
    } else {
      ap.currentSeq += 1;
      if (ap.currentSeq >= ap.chain.length) {
        ap.status = 'APPROVED';
        store.markStep(ap.stageId, stepKey, { approvalId: ap.id });
      }
    }
    var stg = store.stage(ap.stageId);
    store.audit(decision === 'REJECTED' ? 'REJECT' : 'APPROVE', 'approval', ap.id,
      (ap.kind === 'APPLICANT' ? 'Candidate roster' : 'Venue plan') + ' ' + decision.toLowerCase() +
      ' · ' + (stg ? pipe.typeLabel(stg.type) : ''));
    store.save();
    return ap;
  }

  function decisionModal(ap, decision, onDone) {
    var isApprove = decision === 'APPROVED';
    ui.modal({
      title: (isApprove ? 'Approve' : 'Reject') + ' — ' + (ap.kind === 'APPLICANT' ? 'Candidate Roster' : 'Exam Venue Plan'),
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
          if (!isApprove && !rem) {
            ui.toast('Remarks are required when rejecting', 'warning');
            return;
          }
          actOnApproval(ap.id, decision, rem);
          api.close();
          ui.toast(isApprove ? 'Approval granted successfully' : 'Request rejected', isApprove ? 'success' : 'danger');
          if (onDone) onDone();
        });
      }
    });
  }

  /* Edit Approvers Modal */
  function editApproversModal(stg, kind, c, onSave) {
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
      body: '<div id="ap-body">' + listHtml() + '</div>',
      footer: '<button class="btn btn-sm btn-outline-secondary px-3" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-success px-4" data-act="save"><i class="bi bi-check2-circle me-1"></i> Save Routing Sequence</button>',
      onShow: function (api) {
        function rebind() {
          var body = api.find('#ap-body');
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
          patch._approversConfigured = true;
          stg[field] = chosen;
          stg._approversConfigured = true;
          store.update('stages', stg.id, patch);

          // If working on draft circular, ensure draft memory reflects it
          if (c && (c.id === 'draft' || c.isDraft) && c.stages) {
            for (var si = 0; si < c.stages.length; si++) {
              if (c.stages[si].id === stg.id) {
                c.stages[si][field] = chosen;
                c.stages[si]._approversConfigured = true;
              }
            }
            if (store.saveDraftCircular) store.saveDraftCircular(c);
          }

          store.audit('SET_APPROVERS', 'stage', stg.id, kind + ' approvers updated for ' + pipe.typeLabel(stg.type));
          api.close();
          ui.toast('Approval sequence saved successfully');
          if (onSave) onSave();
        });
      }
    });
  }

  /* Details Modal (Candidate List or Venue Plan) */
  function detailsModal(stg, kind) {
    var c = store.circular(stg.circularId);
    var roster = store.rosterOf(stg.id);
    var venues = store.venuesOf(stg.id);

    var body = kind === 'APPLICANT'
      ? '<div class="verify-summary mb-3 p-3 bg-light rounded border d-flex gap-4 justify-content-around text-center">' +
      '<div><div class="fs-4 fw-bold text-success">' + roster.length + '</div><div class="fs-12 text-muted">Total Candidates</div></div>' +
      '<div><div class="fs-4 fw-bold text-dark">' + roster.filter(function (r) { return r.rollNo; }).length + '</div><div class="fs-12 text-muted">Roll Numbers Allocated</div></div>' +
      '<div><div class="fs-4 fw-bold text-primary">' + (c ? c.vacancies : '—') + '</div><div class="fs-12 text-muted">Approved Vacancies</div></div>' +
      '</div>' +
      (roster.length
        ? '<div class="table-responsive" style="max-height:60vh"><table class="table table-striped table-hover align-middle table-x mb-0" id="table-approval-roster"><thead><tr>' +
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
        : ui.empty('No candidates assigned to this stage roster yet'))
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
        : ui.empty('No examination venue currently scheduled', 'Venues can be configured in the stage workspace.', 'bi-geo-alt'));

    ui.modal({
      title: (kind === 'APPLICANT' ? 'Candidate Roster List' : 'Exam Venue Allocation Plan') + ' · ' +
        fmt.esc(pipe.typeLabel(stg.type)) + ' · ' + fmt.esc(c ? c.post : ''),
      size: 'xl',
      body: body,
      footer: '<button class="btn btn-sm btn-light px-3" data-bs-dismiss="modal">Close</button>' +
        (kind === 'APPLICANT'
          ? '<button class="btn btn-sm btn-primary px-3" data-act="print"><i class="bi bi-printer me-1"></i> Print Roster</button>'
          : ''),
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

  /* ---------- Modern Minimal Timeline Renderers ---------- */

  function renderActiveTimeline(ap, me) {
    if (!ap.chain || !ap.chain.length) {
      return '<div class="p-3 bg-light rounded text-center text-muted fs-12 border border-dashed">No approver sequence configured for this request.</div>';
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
      return '<div class="p-3 bg-light rounded text-center text-muted fs-12 border border-dashed"><i class="bi bi-diagram-3 me-1"></i>No approvers configured. Add officers via <strong>Edit Sequence</strong>.</div>';
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

  /* ---------- Main Page Render ---------- */

  function render(view, params) {
    var cid = (params && params.cid) || '';
    var c = store.circular(cid);
    if (!c && store.getDraftCircular) {
      c = store.getDraftCircular();
    }
    if (!c) {
      ERec.router.go('#/circulars');
      return;
    }

    var stages = store.stagesOf(c.id);
    if (!stages.length) {
      var defaultStgId = c.id + '-S1';
      store.insert('stages', {
        id: defaultStgId,
        circularId: c.id,
        type: 'MCQ',
        seq: 1,
        name: 'MCQ Examination',
        requireApplicantApproval: true,
        requireVenueApproval: false,
        applicantApprovers: [],
        venueApprovers: [],
        instructions: '',
        examDate: null,
        fullMarks: 100,
        passMarks: 50,
        status: 'NOT_STARTED',
        steps: {}
      });
      stages = store.stagesOf(c.id);
    }

    // Ensure draft stages initially start with no approvers selected unless explicitly configured
    if (c && (c.id === 'draft' || c.isDraft) && c.stages) {
      var modified = false;
      c.stages.forEach(function (s) {
        if (!s._approversConfigured && Array.isArray(s.applicantApprovers) && s.applicantApprovers.length > 0 && s.applicantApprovers[0] === 'u-gm') {
          s.applicantApprovers = [];
          s.venueApprovers = [];
          modified = true;
        }
      });
      if (modified && store.saveDraftCircular) {
        store.saveDraftCircular(c);
      }
    }

    ERec.router.setCrumbs([
      { label: 'Job Circulars', href: '#/circulars' },
      { label: c.title || c.post, href: '#/circular/' + c.id },
      { label: 'Approval Channel' }
    ]);

    var activeStageId = stages[0].id;
    var activePhaseKey = 'APPLICANT';

    function buildViewHtml() {
      var stg = store.stage(activeStageId) || stages[0];
      var currentPhase = PHASES.find(function (p) { return p.key === activePhaseKey; }) || PHASES[0];

      var required = activePhaseKey === 'APPLICANT' ? stg.requireApplicantApproval : stg.requireVenueApproval;
      var approverField = activePhaseKey === 'APPLICANT' ? 'applicantApprovers' : 'venueApprovers';
      var approvers = stg[approverField] || [];
      var ap = store.approvalFor(stg.id, activePhaseKey);
      var me = store.actingUser();
      var roster = store.rosterOf(stg.id);
      var venues = store.venuesOf(stg.id);

      /* Multi-stage selector pills (only rendered if multiple examination stages exist) */
      var stageSelectorHtml = stages.length > 1 ? (
        '<div class="d-inline-flex align-items-center gap-1 p-1 bg-light rounded-pill border mb-3">' +
        stages.map(function (s) {
          var isSel = s.id === stg.id;
          return '<button type="button" class="btn btn-xs rounded-pill px-2.5 py-1 ' +
            (isSel ? 'btn-success text-white fw-bold shadow-xs' : 'btn-light border-0 text-secondary') +
            '" data-select-stage="' + s.id + '">' +
            'Stage ' + s.seq + ': ' + fmt.esc(pipe.typeLabel(s.type)) +
            '</button>';
        }).join('') +
        '</div>'
      ) : '';

      /* Phase Navigation matching stage-nav-bar toggle UI */
      var phaseNavHtml =
        '<div class="stage-nav-bar approval-stage-nav-bar">' +
        '<div class="stage-nav-tabs">' +
        PHASES.map(function (p) {
          var isCurrent = p.key === activePhaseKey;
          var phaseAp = store.approvalFor(stg.id, p.key);
          var isApproved = phaseAp && phaseAp.status === 'APPROVED';
          var isPending = phaseAp && phaseAp.status === 'PENDING';
          var isReq = p.key === 'APPLICANT' ? stg.requireApplicantApproval : stg.requireVenueApproval;
          var statusCls = isCurrent ? 'is-active' : (isApproved ? 'is-completed' : '');

          var iconHtml = isCurrent
            ? '<i class="bi ' + (isApproved ? 'bi-check-circle-fill' : p.icon) + ' text-white"></i>'
            : (isApproved
              ? '<i class="bi bi-check-circle-fill" style="color:#059669;"></i>'
              : '<i class="bi ' + p.icon + ' text-secondary"></i>');

          var badgeHtml = '';
          if (isApproved) {
            badgeHtml = '<span class="badge ' + (isCurrent ? 'bg-white text-success' : 'bg-success-subtle text-success') + ' rounded-pill px-2 py-0.5 fs-11 ms-2">Approved</span>';
          } else if (isPending) {
            badgeHtml = '<span class="badge ' + (isCurrent ? 'bg-warning text-dark' : 'bg-warning-subtle text-warning-emphasis') + ' rounded-pill px-2 py-0.5 fs-11 ms-2">Pending</span>';
          } else if (isReq) {
            badgeHtml = '<span class="badge ' + (isCurrent ? 'bg-white text-dark' : 'bg-light text-muted border') + ' rounded-pill px-2 py-0.5 fs-11 ms-2">Required</span>';
          } else {
            badgeHtml = '<span class="badge ' + (isCurrent ? 'bg-white text-secondary opacity-75' : 'bg-light text-muted border') + ' rounded-pill px-2 py-0.5 fs-11 ms-2">Optional</span>';
          }

          return '<button type="button" class="stage-nav-tab ' + statusCls + '" data-select-phase="' + p.key + '">' +
            iconHtml + ' <span>' + fmt.esc(p.label) + '</span>' + badgeHtml +
            '</button>';
        }).join('') +
        '</div>' +
        '</div>';

      /* Contextual Status Strip */
      var statusStripHtml = '';
      if (ap && ap.status === 'PENDING') {
        var lvl = ap.chain[ap.currentSeq];
        var isMyTurn = lvl && lvl.userId === me.id;
        if (isMyTurn) {
          statusStripHtml = '<div class="approval-status-strip is-action">' +
            '<i class="bi bi-bell-fill fs-5"></i>' +
            '<div class="flex-grow-1"><strong>Action Required:</strong> This ' + fmt.esc(currentPhase.shortLabel) +
            ' request is currently awaiting your sign-off as <strong>' + fmt.esc(me.name) + '</strong> (' + fmt.esc(me.designation) + ').</div>' +
            '</div>';
        } else {
          statusStripHtml = '<div class="approval-status-strip is-waiting">' +
            '<i class="bi bi-hourglass-split fs-5"></i>' +
            '<div class="flex-grow-1"><strong>Pending Sign-off:</strong> Currently awaiting Level ' + (ap.currentSeq + 1) + ' approval from <strong>' +
            fmt.esc(lvl ? lvl.name : '—') + '</strong> (' + fmt.esc(lvl ? lvl.designation : '') + ').</div>' +
            (lvl ? '<button type="button" class="btn btn-xs btn-outline-warning rounded-pill px-2.5" data-switch-user="' + lvl.userId + '"><i class="bi bi-person-switch me-1"></i>Switch to ' + fmt.esc(lvl.name.split(' ')[0]) + '</button>' : '') +
            '</div>';
        }
      } else if (ap && ap.status === 'APPROVED') {
        statusStripHtml = '<div class="approval-status-strip is-approved">' +
          '<i class="bi bi-check-circle-fill fs-5 text-success"></i>' +
          '<div class="flex-grow-1"><strong>Authorization Complete:</strong> All ' + fmt.plural(ap.chain.length, 'level') +
          ' have reviewed and authorized this ' + fmt.esc(currentPhase.shortLabel) + ' request (' + fmt.ago(ap.createdAt) + ').</div>' +
          '</div>';
      } else if (ap && ap.status === 'REJECTED') {
        var rej = ap.chain.filter(function (l) { return l.status === 'REJECTED'; })[0];
        statusStripHtml = '<div class="approval-status-strip is-rejected">' +
          '<i class="bi bi-exclamation-triangle-fill fs-5 text-danger"></i>' +
          '<div class="flex-grow-1"><strong>Request Rejected by ' + fmt.esc(rej ? rej.name : '') + ':</strong> ' +
          (rej && rej.remarks ? '“' + fmt.esc(rej.remarks) + '”' : 'Revision required.') + '</div>' +
          '</div>';
      }

      /* Stepper List of Approvers */
      var approverStepperHtml = approvers.length
        ? '<div class="approval-seq-list mb-3">' + approvers.map(function (id, i) {
          var u = store.find('users', id) || { name: id, designation: 'Approver' };
          return '<div class="approval-seq-item">' +
            '<span class="seq-level-badge">' + (i + 1) + '</span>' +
            ui.avatar(u.name, 'sm') +
            '<div class="flex-grow-1 min-w-0">' +
            '<div class="seq-user-name text-truncate">' + fmt.esc(u.name) + '</div>' +
            '<div class="seq-user-role text-truncate">' + fmt.esc(u.designation) + '</div>' +
            '</div>' +
            '<span class="badge bg-light text-secondary border fs-10 font-monospace">Level ' + (i + 1) + '</span>' +
            '</div>';
        }).join('') + '</div>'
        : '<div class="empty-seq-box text-center p-4 rounded-3 mb-3 bg-white">' +
        '<div class="empty-icon-wrap mx-auto mb-2.5">' +
        '<i class="bi bi-person-plus text-success fs-3"></i>' +
        '</div>' +
        '<div class="fw-bold fs-13 text-dark mb-1">No Approvers Selected</div>' +
        '<div class="fs-12 text-muted mb-3 mx-auto" style="max-width: 250px;">' +
        'No approvers added yet. Add executives to define the sequential review hierarchy.' +
        '</div>' +
        '<button type="button" class="btn btn-sm btn-outline-success rounded-pill px-3 py-1.5 fw-semibold shadow-2xs" id="btn-add-approvers-empty">' +
        '<i class="bi bi-plus-lg me-1"></i> Add Approvers' +
        '</button>' +
        '</div>';

      /* Inspect phase count */
      var countDisplay = activePhaseKey === 'APPLICANT' ? (roster.length + ' Candidates') : (venues.length + ' Venues');

      /* Is it acting user's turn? */
      var isApproverTurn = ap && ap.status === 'PENDING' && ap.chain[ap.currentSeq] && ap.chain[ap.currentSeq].userId === me.id;

      /* Header status badge for Approval Trail */
      var statusBadgeHeader = '';
      if (ap && ap.status === 'APPROVED') {
        statusBadgeHeader = '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1 fs-11 font-monospace"><i class="bi bi-check-all me-1"></i>Authorized</span>';
      } else if (ap && ap.status === 'PENDING') {
        statusBadgeHeader = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-2.5 py-1 fs-11 font-monospace"><i class="bi bi-hourglass-split me-1"></i>In Progress</span>';
      } else if (ap && ap.status === 'REJECTED') {
        statusBadgeHeader = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2.5 py-1 fs-11 font-monospace"><i class="bi bi-x-circle me-1"></i>Rejected</span>';
      } else if (approvers.length) {
        statusBadgeHeader = '<span class="badge bg-light text-secondary border rounded-pill px-2.5 py-1 fs-11 font-monospace"><i class="bi bi-diagram-3 me-1"></i>' + approvers.length + ' Level Sequence</span>';
      } else {
        statusBadgeHeader = '<span class="badge bg-light text-muted border rounded-pill px-2.5 py-1 fs-11 font-monospace"><i class="bi bi-dash-circle me-1"></i>Standby</span>';
      }

      /* Trail Body Content */
      var trailBodyHtml = '';
      if (ap) {
        trailBodyHtml = renderActiveTimeline(ap, me);
      } else if (approvers.length) {
        trailBodyHtml = renderDraftTimeline(approvers);
      } else {
        trailBodyHtml =
          '<div class="empty-trail-box text-center py-5 px-3">' +
          '<div class="empty-icon-wrap mx-auto mb-3 bg-light text-muted">' +
          '<i class="bi bi-shield-slash text-muted fs-2"></i>' +
          '</div>' +
          '<div class="fw-bold fs-14 text-dark mb-1">Approval Trail Standby</div>' +
          '<div class="fs-12 text-muted mx-auto" style="max-width: 310px; line-height: 1.45;">' +
          'Once officers are added to the routing sequence on the left, the live hierarchical approval trail will be generated here.' +
          '</div>' +
          '</div>';
      }

      /* Trail Action Buttons */
      var trailActionsHtml = '';
      if (!ap || ap.status === 'REJECTED') {
        var isSendDisabled = !required || approvers.length === 0;
        var btnTitle = isSendDisabled
          ? (!required ? 'Mandatory sign-off is disabled' : 'Add approvers to send')
          : 'Send for approval';

        trailActionsHtml =
          '<div class="pt-3 border-top mt-auto">' +
          '<button type="button" class="btn btn-green-solid w-100 py-2.5 fw-semibold shadow-xs d-flex align-items-center justify-content-center gap-2" id="btn-send-approval"' +
          (isSendDisabled ? ' disabled="disabled" aria-disabled="true"' : '') +
          ' title="' + fmt.esc(btnTitle) + '">' +
          '<i class="bi bi-send-fill"></i> Send for Approval' +
          '</button>' +
          '</div>';
      } else if (isApproverTurn) {
        trailActionsHtml =
          '<div class="pt-3 border-top mt-auto d-flex gap-2">' +
          '<button type="button" class="btn btn-success flex-fill py-2.5 shadow-xs fw-semibold d-flex align-items-center justify-content-center gap-1.5" id="btn-act-approve">' +
          '<i class="bi bi-check2-circle"></i> Confirm Approval as ' + fmt.esc(me.name.split(' ')[0]) +
          '</button>' +
          '<button type="button" class="btn btn-outline-danger flex-fill py-2.5 fw-semibold d-flex align-items-center justify-content-center gap-1.5" id="btn-act-reject">' +
          '<i class="bi bi-x-circle"></i> Reject Request' +
          '</button>' +
          '</div>';
      }

      /* Mandatory Sign-off in Sequential Routing */
      var mandatorySignoffHtml =
        '<div class="pt-3 border-top mt-auto">' +
        '<div class="approval-mandatory-box ' + (required ? 'is-active' : '') + ' d-flex align-items-center justify-content-between">' +
        '<div class="d-flex align-items-center gap-2 min-w-0">' +
        '<div class="header-icon-box ' + (required ? 'bg-success-subtle text-success' : 'bg-light text-muted') + '">' +
        '<i class="bi ' + (required ? 'bi-shield-check' : 'bi-shield') + '"></i>' +
        '</div>' +
        '<div class="min-w-0">' +
        '<label class="fw-semibold text-dark fs-12 mb-0 d-block cursor-pointer" for="f-required">Mandatory Sign-off</label>' +
        '<div class="fs-11 text-muted text-truncate">' +
        (required ? 'Requires authorization from all levels before next step' : 'Sign-off is optional for this stage') +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="form-check form-switch m-0 d-flex align-items-center">' +
        '<input class="form-check-input m-0 cursor-pointer" type="checkbox" id="f-required"' + (required ? ' checked' : '') + ' role="switch" style="width: 34px; height: 18px;">' +
        '</div>' +
        '</div>' +
        '</div>';

      /* Main Workspace: 2-column layout */
      var mainSectionsHtml =
        '<div class="row g-3">' +
        '<!-- Column 1: Routing Configuration -->' +
        '<div class="col-lg-5">' +
        '<div class="card shadow-2xs border h-100 rounded-3">' +
        '<div class="card-header bg-white border-bottom py-2.5 px-3.5 d-flex align-items-center justify-content-between">' +
        '<div class="d-flex align-items-center gap-2">' +
        '<div class="header-icon-box bg-success-subtle text-success">' +
        '<i class="bi bi-diagram-3"></i>' +
        '</div>' +
        '<div>' +
        '<div class="fw-bold fs-13 text-dark lh-sm">Sequential Routing</div>' +
        '<div class="fs-11 text-muted">Hierarchical review order</div>' +
        '</div>' +
        '</div>' +
        (approvers.length
          ? '<button type="button" class="btn btn-sm btn-outline-secondary" id="btn-edit-approvers">' +
          '<i class="bi bi-pencil me-1 text-success"></i>Edit Approvers' +
          '</button>'
          : '') +
        '</div>' +
        '<div class="card-body p-3.5 d-flex flex-column justify-content-between">' +
        '<div>' +
        approverStepperHtml +
        '</div>' +
        mandatorySignoffHtml +
        '</div>' +
        '</div>' +
        '</div>' +

        '<!-- Column 2: Live Approval Trail & Action -->' +
        '<div class="col-lg-7">' +
        '<div class="card shadow-2xs border h-100 rounded-3">' +
        '<div class="card-header bg-white border-bottom py-2.5 px-3.5 d-flex align-items-center justify-content-between">' +
        '<div class="d-flex align-items-center gap-2">' +
        '<div class="header-icon-box bg-primary-subtle text-primary">' +
        '<i class="bi bi-clock-history"></i>' +
        '</div>' +
        '<div>' +
        '<div class="fw-bold fs-13 text-dark lh-sm">Approval Trail</div>' +
        '<div class="fs-11 text-muted">Sequential review history & audit trail</div>' +
        '</div>' +
        '</div>' +
        statusBadgeHeader +
        '</div>' +
        '<div class="card-body p-3.5 d-flex flex-column justify-content-between">' +
        '<div>' +
        trailBodyHtml +
        '</div>' +
        trailActionsHtml +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>';

      return '<div class="create-job-posting-container">' +
        ui.postingWizard(3, c.id) +
        stageSelectorHtml +
        phaseNavHtml +
        statusStripHtml +
        mainSectionsHtml +

        '<!-- Bottom Actions Row -->' +
        '<div class="circular-action-bar d-flex align-items-center justify-content-between flex-wrap gap-2 mt-4">' +
        '<button type="button" class="btn btn-outline-secondary btn-cancel-posting" id="btn-prev-step">' +
        '<i class="bi bi-arrow-left me-1"></i> Previous (Eligibility Rules)' +
        '</button>' +
        '<div class="d-flex align-items-center gap-2">' +
        '<button type="button" class="btn btn-save-next" id="btn-save-next">' +
        'Save &amp; Continue to Preview <i class="bi bi-arrow-right ms-1"></i>' +
        '</button>' +
        '</div>' +
        '</div>' +
        '</div>';
    }

    function renderView() {
      view.innerHTML = buildViewHtml();
      ui.bindPostingWizard(view);
      bindViewEvents();
    }

    function bindViewEvents() {
      var stg = store.stage(activeStageId) || stages[0];
      var currentPhase = PHASES.find(function (p) { return p.key === activePhaseKey; }) || PHASES[0];

      // Switch acting personnel button clicks
      ui.on(view, '[data-switch-user]', 'click', function (e, b) {
        var uid = b.dataset.switchUser;
        if (!uid) return;
        store.setActingUser(uid);
        var nu = store.find('users', uid);
        ui.toast('Acting as ' + (nu ? nu.name : uid) + (nu ? ' (' + nu.designation + ')' : ''), 'info');
        ERec.app.renderAll();
      });

      // Stage selector tabs
      view.querySelectorAll('[data-select-stage]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          activeStageId = btn.dataset.selectStage;
          renderView();
        });
      });

      // Phase selector cards
      view.querySelectorAll('[data-select-phase]').forEach(function (el) {
        el.addEventListener('click', function () {
          activePhaseKey = el.dataset.selectPhase;
          renderView();
        });
      });

      // Edit Sequence Button & Empty State Add Button
      var editBtn = view.querySelector('#btn-edit-approvers');
      if (editBtn) {
        editBtn.addEventListener('click', function () {
          editApproversModal(stg, activePhaseKey, c, function () {
            renderView();
          });
        });
      }
      var addEmptyBtn = view.querySelector('#btn-add-approvers-empty');
      if (addEmptyBtn) {
        addEmptyBtn.addEventListener('click', function () {
          editApproversModal(stg, activePhaseKey, c, function () {
            renderView();
          });
        });
      }

      // Required toggle switch
      var reqSwitch = view.querySelector('#f-required');
      if (reqSwitch) {
        reqSwitch.addEventListener('change', function () {
          var isChecked = reqSwitch.checked;
          var patch = {};
          if (activePhaseKey === 'APPLICANT') {
            patch.requireApplicantApproval = isChecked;
          } else {
            patch.requireVenueApproval = isChecked;
          }
          store.update('stages', stg.id, patch);

          if (c && (c.id === 'draft' || c.isDraft) && c.stages) {
            for (var si = 0; si < c.stages.length; si++) {
              if (c.stages[si].id === stg.id) {
                if (activePhaseKey === 'APPLICANT') {
                  c.stages[si].requireApplicantApproval = isChecked;
                } else {
                  c.stages[si].requireVenueApproval = isChecked;
                }
              }
            }
            if (store.saveDraftCircular) store.saveDraftCircular(c);
          }

          store.audit('SET_APPROVAL_REQUIREMENT', 'stage', stg.id,
            activePhaseKey + ' approval required flag set to ' + isChecked + ' for ' + pipe.typeLabel(stg.type));
          ui.toast('Mandatory sign-off ' + (isChecked ? 'enabled' : 'disabled') + ' for ' + currentPhase.shortLabel);
          renderView();
        });
      }

      // Details Modal Button
      var detailsBtn = view.querySelector('#btn-view-details');
      if (detailsBtn) {
        detailsBtn.addEventListener('click', function () {
          detailsModal(stg, activePhaseKey);
        });
      }

      // Send Approval Request Now
      var sendBtn = view.querySelector('#btn-send-approval');
      if (sendBtn) {
        sendBtn.addEventListener('click', function (e) {
          if (sendBtn.disabled || sendBtn.hasAttribute('disabled')) {
            e.preventDefault();
            return;
          }
          var isReq = activePhaseKey === 'APPLICANT' ? stg.requireApplicantApproval : stg.requireVenueApproval;
          if (!isReq) {
            ui.toast('Cannot send for approval: Mandatory sign-off is disabled for ' + currentPhase.shortLabel, 'warning');
            return;
          }
          var curApprovers = activePhaseKey === 'APPLICANT' ? (stg.applicantApprovers || []) : (stg.venueApprovers || []);
          if (!curApprovers.length) {
            ui.toast('Please configure at least one approver in the sequence first', 'warning');
            return;
          }
          var roster = store.rosterOf(stg.id);
          var venues = store.venuesOf(stg.id);
          var summary = activePhaseKey === 'APPLICANT'
            ? fmt.plural(roster.length, 'candidate') + ' for ' + pipe.typeLabel(stg.type) + ' — ' + (c.post || 'Job Circular')
            : fmt.plural(venues.length, 'venue') + ' for ' + pipe.typeLabel(stg.type) + ' — ' + (c.post || 'Job Circular');
          sendApprovalRequest(stg, activePhaseKey, summary);
          ui.toast('Approval request initiated successfully');
          renderView();
        });
      }

      // Approver action buttons if my turn
      var ap = store.approvalFor(stg.id, activePhaseKey);
      var approveBtn = view.querySelector('#btn-act-approve');
      if (approveBtn && ap) {
        approveBtn.addEventListener('click', function () {
          decisionModal(ap, 'APPROVED', function () {
            renderView();
          });
        });
      }
      var rejectBtn = view.querySelector('#btn-act-reject');
      if (rejectBtn && ap) {
        rejectBtn.addEventListener('click', function () {
          decisionModal(ap, 'REJECTED', function () {
            renderView();
          });
        });
      }

      // Header Back button
      var backBtn = view.querySelector('#btn-back');
      if (backBtn) {
        backBtn.addEventListener('click', function () {
          ERec.router.go('#/circulars');
        });
      }

      // Previous Step button
      var prevBtn = view.querySelector('#btn-prev-step');
      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          ERec.router.go('#/circulars/new-eligibility/' + (c.isDraft || c.id === 'draft' ? 'draft' : c.id));
        });
      }

      // Save & Next (Preview) button
      var saveNextBtn = view.querySelector('#btn-save-next');
      if (saveNextBtn) {
        saveNextBtn.addEventListener('click', function () {
          ERec.router.go('#/circulars/new-preview/' + (c.isDraft || c.id === 'draft' ? 'draft' : c.id));
        });
      }
    }

    renderView();
  }

  ERec.pages.newcircularApproval = { render: render, editApproversModal: editApproversModal, detailsModal: detailsModal };
  ERec.pages.createcircularApproval = ERec.pages.newcircularApproval;
})(window);