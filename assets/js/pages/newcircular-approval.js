/* Create Job Posting - Step 3: Approval Channel.
   Configures approval sequences and displays the approval trail for
   both Candidate List Approval (APPLICANT) and Exam Venue Approval (VENUE) phases. */
(function (global) {
  'use strict';

  var ERec = global.ERec = global.ERec || {};
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var PHASES = [
    {
      key: 'APPLICANT',
      stepKey: 'approval-applicant',
      label: 'Candidate List Approval Phase',
      shortLabel: 'Candidate List',
      icon: 'bi-person-check',
      badgeText: 'Applicant Roster',
      desc: 'Hierarchical review & authorization of the verified candidate roster prior to roll number assignment and admit card issuance.'
    },
    {
      key: 'VENUE',
      stepKey: 'approval-venue',
      label: 'Exam Venue Approval Phase',
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

    var m = ui.modal({
      title: 'Configure Approver Sequence &middot; ' + pipe.typeLabel(stg.type) + ' &middot; ' + (kind === 'APPLICANT' ? 'Candidate Roster' : 'Exam Venues'),
      body: '<div id="ap-body">' + listHtml() + '</div>',
      footer: '<button class="btn btn-sm btn-outline-secondary px-3" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-green-solid px-4" data-act="save"><i class="bi bi-check2-circle me-1"></i> Save Routing Sequence</button>',
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
          store.update('stages', stg.id, patch);
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
          '<div><div class="fs-4 fw-bold text-primary">' + c.vacancies + '</div><div class="fs-12 text-muted">Approved Vacancies</div></div>' +
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
          : ui.empty('No candidates assigned to this stage roster'))
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
        : ui.empty('No examination venue currently scheduled', 'Venues can also be set up directly in the stage workspace.', 'bi-geo-alt'));

    ui.modal({
      title: (kind === 'APPLICANT' ? 'Candidate Roster List' : 'Exam Venue Allocation Plan') + ' &middot; ' +
        fmt.esc(pipe.typeLabel(stg.type)) + ' &middot; ' + fmt.esc(c.post),
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

  /* ---------- Timeline Renderers ---------- */

  function renderActiveTimeline(ap) {
    if (!ap.chain || !ap.chain.length) {
      return ui.alert('warn', 'No approver sequence was configured, so this request has no designated routing.');
    }
    return '<div class="timeline">' + ap.chain.map(function (l, i) {
      var cls = l.status === 'APPROVED' ? 'ok' : l.status === 'REJECTED' ? 'no'
        : (ap.status === 'PENDING' && i === ap.currentSeq ? 'now' : '');
      var icon = l.status === 'APPROVED' ? 'bi-check-lg' : l.status === 'REJECTED' ? 'bi-x-lg'
        : (cls === 'now' ? 'bi-hourglass-split' : 'bi-dot');
      return '<div class="tl-item ' + cls + '"><span class="tl-dot"><i class="bi ' + icon + '"></i></span>' +
        '<div class="tl-title">Level ' + (i + 1) + ' &middot; ' + fmt.esc(l.name) + ' ' +
          (l.status === 'PENDING' && cls === 'now' ? ui.pill('Awaiting action', 'amber') :
            l.status === 'PENDING' ? ui.pill('Queued', 'grey') : ui.statusPill(l.status)) + '</div>' +
        '<div class="tl-meta">' + fmt.esc(l.designation) +
          (l.actedAt ? ' &middot; ' + fmt.dateTime(l.actedAt) : '') + '</div>' +
        (l.remarks ? '<div class="fs-12 mt-1 fst-italic text-secondary bg-light p-2 rounded border">“' + fmt.esc(l.remarks) + '”</div>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  function renderDraftTimeline(approvers) {
    if (!approvers || !approvers.length) {
      return ui.alert('warn', 'No approvers configured for this phase. Click <strong>Edit Sequence</strong> above to add bank officers.');
    }
    return '<div class="timeline">' + approvers.map(function (uid, i) {
      var u = store.find('users', uid) || { name: uid, designation: 'Approver' };
      var isFirst = i === 0;
      return '<div class="tl-item' + (isFirst ? ' now' : '') + '">' +
        '<span class="tl-dot"><i class="bi ' + (isFirst ? 'bi-hourglass-split' : 'bi-dot') + '"></i></span>' +
        '<div class="tl-title">Level ' + (i + 1) + ' &middot; ' + fmt.esc(u.name) + ' ' +
          (isFirst ? ui.pill('First in line', 'amber') : ui.pill('Queued', 'grey')) + '</div>' +
        '<div class="tl-meta">' + fmt.esc(u.designation) + ' &middot; Pending workflow initiation</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  /* ---------- Main Page Render ---------- */

  function render(view, params) {
    var cid = params.cid;
    var c = store.circular(cid);
    if (!c) {
      ERec.router.go('#/circulars');
      return;
    }

    var stages = store.stagesOf(c.id);
    if (!stages.length) {
      // Create a default stage if somehow missing
      var defaultStgId = c.id + '-S1';
      store.insert('stages', {
        id: defaultStgId,
        circularId: c.id,
        type: 'MCQ',
        seq: 1,
        name: 'MCQ Examination',
        requireApplicantApproval: true,
        requireVenueApproval: false,
        applicantApprovers: ['u-gm', 'u-dmd', 'u-md'],
        venueApprovers: ['u-gm'],
        instructions: '',
        examDate: null,
        fullMarks: 100,
        passMarks: 50,
        status: 'NOT_STARTED',
        steps: {}
      });
      stages = store.stagesOf(c.id);
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
      var summaryText = activePhaseKey === 'APPLICANT'
        ? fmt.plural(roster.length, 'candidate') + ' for ' + pipe.typeLabel(stg.type) + ' — ' + c.post
        : fmt.plural(venues.length, 'venue') + ' for ' + pipe.typeLabel(stg.type) + ' — ' + c.post;

      /* Status alert banner matching approval.js */
      var statusAlertHtml = '';
      if (ap && ap.status === 'PENDING') {
        var lvl = ap.chain[ap.currentSeq];
        statusAlertHtml = ui.alert('warn', '<strong>Awaiting approval from ' + fmt.esc(lvl ? lvl.name : '—') + '.</strong> ' +
          'Switch the <em>Acting as</em> role switcher in the top bar to that approver to act on it' +
          (lvl && lvl.userId === me.id ? ' — you are that approver right now.' : '.'));
      } else if (ap && ap.status === 'APPROVED') {
        statusAlertHtml = ui.alert('ok', '<strong>Approved.</strong> Request was sent ' + fmt.ago(ap.createdAt) +
          ' and cleared by ' + fmt.plural(ap.chain.length, 'level') + '.');
      } else if (ap && ap.status === 'REJECTED') {
        var rej = ap.chain.filter(function (l) { return l.status === 'REJECTED'; })[0];
        statusAlertHtml = ui.alert('err', '<strong>Rejected by ' + fmt.esc(rej ? rej.name : '') + '.</strong> ' +
          (rej && rej.remarks ? '“' + fmt.esc(rej.remarks) + '”' : '') +
          ' Revise settings and send a fresh request.');
      } else if (!required) {
        statusAlertHtml = ui.alert('info', '<strong>Approval is optional for this phase.</strong> ' +
          'You can configure the sequential approver list and send for authorization, or proceed without blocking the pipeline.');
      } else {
        statusAlertHtml = ui.alert('warn', '<strong>Approval is required for this phase.</strong> ' +
          'Subsequent examination steps (Roll generation, venue setup or admit cards) will stay locked until every approver has signed off.');
      }

      /* Stage navigation tabs (if multiple stages exist) */
      var stageTabsHtml = '';
      if (stages.length > 1) {
        stageTabsHtml = '<div class="d-flex align-items-center gap-2 mb-3 overflow-x-auto pb-1">' +
          '<span class="fs-12 fw-bold text-muted text-uppercase me-1"><i class="bi bi-layers me-1"></i>Exam Stage:</span>' +
          stages.map(function (s) {
            var isSel = s.id === stg.id;
            return '<button type="button" class="btn btn-sm ' + (isSel ? 'btn-success fw-bold text-white shadow-sm' : 'btn-light border text-secondary') + '" data-select-stage="' + s.id + '">' +
              '<i class="bi bi-circle-fill me-1" style="font-size: 8px;"></i>' +
              'Stage ' + s.seq + ': ' + fmt.esc(pipe.typeLabel(s.type)) +
            '</button>';
          }).join('') +
        '</div>';
      }

      /* Approval Phase tabs */
      var phaseTabsHtml = '<div class="card card-posting-section mb-4">' +
        '<div class="card-posting-head d-flex align-items-center justify-content-between flex-wrap gap-2">' +
          '<div class="d-flex align-items-center gap-2">' +
            '<i class="bi bi-shield-check"></i>' +
            '<span>Approval Channel Configuration</span>' +
          '</div>' +
          '<span class="badge bg-white text-success border px-2 py-1 fs-12">' + fmt.esc(stg.name) + '</span>' +
        '</div>' +
        '<div class="card-posting-body pb-2">' +
          stageTabsHtml +
          '<div class="row g-3 mb-3">' +
            PHASES.map(function (p) {
              var isCurrent = p.key === activePhaseKey;
              var isReq = p.key === 'APPLICANT' ? stg.requireApplicantApproval : stg.requireVenueApproval;
              var phaseApprovers = (p.key === 'APPLICANT' ? stg.applicantApprovers : stg.venueApprovers) || [];
              var phaseAp = store.approvalFor(stg.id, p.key);

              var statusBadge = '';
              if (phaseAp && phaseAp.status === 'APPROVED') {
                statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2">Approved</span>';
              } else if (phaseAp && phaseAp.status === 'PENDING') {
                statusBadge = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-2">Pending Review</span>';
              } else if (isReq) {
                statusBadge = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2">Required</span>';
              } else {
                statusBadge = '<span class="badge bg-light text-muted border rounded-pill px-2">Optional</span>';
              }

              return '<div class="col-md-6">' +
                '<div class="p-3 rounded-3 border cursor-pointer h-100 transition-all ' + (isCurrent ? 'border-success bg-success-subtle bg-opacity-10 shadow-sm' : 'bg-white hover-bg-light') + '" data-select-phase="' + p.key + '">' +
                  '<div class="d-flex align-items-start justify-content-between gap-2 mb-2">' +
                    '<div class="d-flex align-items-center gap-2">' +
                      '<div class="rounded-circle d-grid place-items-center ' + (isCurrent ? 'bg-success text-white' : 'bg-light text-secondary') + '" style="width: 32px; height: 32px;">' +
                        '<i class="bi ' + p.icon + '"></i>' +
                      '</div>' +
                      '<div>' +
                        '<h6 class="mb-0 fw-bold ' + (isCurrent ? 'text-success' : 'text-dark') + '" style="font-size: 13.5px;">' + fmt.esc(p.label) + '</h6>' +
                        '<span class="fs-11 text-muted">' + fmt.esc(p.badgeText) + '</span>' +
                      '</div>' +
                    '</div>' +
                    statusBadge +
                  '</div>' +
                  '<p class="fs-12 text-muted mb-2 line-clamp-2" style="min-height: 36px;">' + fmt.esc(p.desc) + '</p>' +
                  '<div class="d-flex align-items-center justify-content-between fs-12 pt-2 border-top">' +
                    '<span class="text-secondary"><i class="bi bi-diagram-2 me-1"></i><strong>' + phaseApprovers.length + '</strong> approver levels</span>' +
                    '<span class="fw-semibold ' + (isCurrent ? 'text-success' : 'text-primary') + '">' +
                      (isCurrent ? '<i class="bi bi-check2-circle me-1"></i>Active Phase' : 'Configure Phase &rarr;') +
                    '</span>' +
                  '</div>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>';

      /* Approver chain visualization */
      var chainHtml = approvers.length
        ? '<div class="chain mb-3 d-flex flex-wrap align-items-center gap-1">' + approvers.map(function (id, i) {
            var u = store.find('users', id) || { name: id, designation: 'Approver' };
            return (i ? '<span class="arrow text-muted mx-1"><i class="bi bi-chevron-right fs-12"></i></span>' : '') +
              '<span class="pill blue py-1 px-2"><i class="bi bi-person-badge me-1"></i>L' + (i + 1) + ' &middot; ' + fmt.esc(u.name) + '</span>';
          }).join('') + '</div>' +
          '<div class="fs-12 text-muted mb-2"><i class="bi bi-info-circle me-1"></i>Each designated officer must review and approve in sequence before this step is finalized.</div>'
        : ui.alert('warn', 'No approvers configured for this phase. Click <strong>Edit Sequence</strong> to assign bank officers.');

      /* Verification Payload content (Candidate roster table or Venue allocation plan) */
      var payloadHtml = '';
      if (activePhaseKey === 'APPLICANT') {
        payloadHtml = roster.length
          ? '<div class="mb-3 d-flex gap-3 text-center p-2 bg-light rounded border">' +
              '<div class="flex-fill"><span class="fs-11 text-muted d-block text-uppercase fw-semibold">Roster Candidates</span><span class="fs-5 fw-bold text-success">' + roster.length + '</span></div>' +
              '<div class="flex-fill border-start"><span class="fs-11 text-muted d-block text-uppercase fw-semibold">With Roll Numbers</span><span class="fs-5 fw-bold text-dark">' + roster.filter(function (r) { return r.rollNo; }).length + '</span></div>' +
              '<div class="flex-fill border-start"><span class="fs-11 text-muted d-block text-uppercase fw-semibold">Total Vacancies</span><span class="fs-5 fw-bold text-primary">' + c.vacancies + '</span></div>' +
            '</div>' +
            '<div class="table-responsive"><table class="table table-sm table-striped table-hover align-middle table-x mb-0"><thead><tr><th>Roll</th><th>Candidate</th><th>Mobile</th></tr></thead><tbody>' +
            roster.slice(0, 6).map(function (r) {
              var a = store.applicant(r.applicantId) || {};
              return '<tr><td class="mono fw-semibold">' + fmt.esc(r.rollNo || '—') + '</td>' +
                '<td class="fw-medium">' + fmt.esc(a.name || 'Candidate') + '</td>' +
                '<td class="mono fs-12 text-secondary">' + fmt.esc(a.mobile || '—') + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            (roster.length > 6 ? '<div class="fs-12 text-muted mt-2 text-center">... and ' + (roster.length - 6) + ' more applicants on this stage roster.</div>' : '')
          : ui.empty('No candidate list yet', 'Applicants who apply will appear here once applications are processed.', 'bi-people');
      } else {
        payloadHtml = venues.length
          ? '<div class="table-responsive"><table class="table table-sm table-striped table-hover align-middle table-x mb-0"><thead><tr><th>Venue</th><th>Date</th><th>Exam Time</th><th>Roll Range</th></tr></thead><tbody>' +
            venues.map(function (v) {
              return '<tr><td><div class="fw-semibold text-dark">' + fmt.esc(v.name) + '</div><div class="fs-11 text-muted">' + fmt.esc(v.address) + '</div></td>' +
                '<td class="nowrap fs-12">' + fmt.date(v.examDate) + '</td>' +
                '<td class="nowrap fs-12">' + fmt.time12(v.startTime) + ' – ' + fmt.time12(v.endTime) + '</td>' +
                '<td class="mono nowrap fs-12">' + fmt.esc(v.rollFrom || '—') + ' – ' + fmt.esc(v.rollTo || '—') + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : ui.empty('No examination venue configured yet', 'Venues and hall allocations can be established now or later in the stage workspace.', 'bi-geo-alt');
      }

      /* Check if acting user is currently the active approver */
      var isApproverTurn = ap && ap.status === 'PENDING' && ap.chain[ap.currentSeq] && ap.chain[ap.currentSeq].userId === me.id;

      /* Build Approval sequence & Approval trail cards */
      var mainSectionsHtml =
        '<div class="row g-3">' +
          '<!-- Left Column: Sequence & Trail -->' +
          '<div class="col-lg-5">' +
            ui.card({
              title: 'Approval sequence',
              hint: fmt.esc(currentPhase.shortLabel) + ' &middot; ' + fmt.esc(pipe.typeLabel(stg.type)),
              actions: '<button type="button" class="btn btn-sm btn-outline-secondary" id="btn-edit-approvers"><i class="bi bi-pencil me-1"></i> Edit Sequence</button>',
              body: chainHtml +
                '<hr class="hr-soft my-3">' +
                '<div class="form-check form-switch">' +
                  '<input class="form-check-input" type="checkbox" id="f-required"' + (required ? ' checked' : '') + '>' +
                  '<label class="form-check-label fs-13 fw-semibold text-dark" for="f-required">Approval required for this phase</label>' +
                '</div>' +
                '<div class="fs-11 text-muted mt-1">When ticked, the pipeline cannot advance past this phase until all approval levels approve.</div>'
            }) +
            '<div class="mt-3">' +
              ui.card({
                title: 'Approval trail',
                hint: ap ? ('Requested by ' + fmt.esc(ap.createdBy) + ' &middot; ' + fmt.dateTime(ap.createdAt)) : 'Sequential review history & audit trail',
                body: (ap ? renderActiveTimeline(ap) : renderDraftTimeline(approvers)) +
                  (isApproverTurn
                    ? '<div class="mt-3 pt-3 border-top d-flex gap-2">' +
                        '<button type="button" class="btn btn-sm btn-success flex-fill" id="btn-act-approve"><i class="bi bi-check2-circle me-1"></i> Approve Request</button>' +
                        '<button type="button" class="btn btn-sm btn-outline-danger flex-fill" id="btn-act-reject"><i class="bi bi-x-circle me-1"></i> Reject</button>' +
                      '</div>'
                    : (!ap || ap.status === 'REJECTED'
                      ? '<div class="mt-3 pt-3 border-top text-end">' +
                          '<button type="button" class="btn btn-sm btn-outline-success" id="btn-send-approval"' + (approvers.length ? '' : ' disabled') + '>' +
                            '<i class="bi bi-send me-1"></i> Send Request Now (Optional)' +
                          '</button>' +
                        '</div>'
                      : ''))
              }) +
            '</div>' +
          '</div>' +

          '<!-- Right Column: Verification Payload -->' +
          '<div class="col-lg-7">' +
            ui.card({
              title: activePhaseKey === 'APPLICANT' ? 'Candidate list being verified' : 'Venue plan being verified',
              hint: summaryText,
              actions: '<button type="button" class="btn btn-sm btn-outline-secondary" id="btn-view-details"><i class="bi bi-list-ul me-1"></i> ' +
                (activePhaseKey === 'APPLICANT' ? 'View Full List' : 'View Venue Details') + '</button>',
              body: payloadHtml
            }) +
          '</div>' +
        '</div>';

      return '<div class="create-job-posting-container">' +
        '<!-- Page Header -->' +
        '<div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">' +
          '<div class="d-flex align-items-center gap-2">' +
            '<div class="posting-header-icon">' +
              '<i class="bi bi-briefcase-fill"></i>' +
            '</div>' +
            '<div>' +
              '<h4 class="fw-bold text-dark mb-0" style="font-size: 1.35rem; letter-spacing: -0.01em;">Create Job Posting</h4>' +
              '<div class="text-muted" style="font-size: 12.5px;">' + fmt.esc(c.title || c.post) + ' &middot; ' + fmt.esc(c.code) + '</div>' +
            '</div>' +
          '</div>' +
          '<button class="btn btn-outline-secondary btn-back-posting" id="btn-back">' +
            '<i class="bi bi-arrow-left me-1"></i> Back to Circulars' +
          '</button>' +
        '</div>' +

        ui.postingWizard(3, c.id) +

        phaseTabsHtml +
        statusAlertHtml +
        mainSectionsHtml +

        '<!-- Bottom Navigation -->' +
        '<div class="d-flex justify-content-between align-items-center job-bootom mt-4">' +
          '<button class="btn btn-outline-secondary" id="btn-prev-step">' +
            '<i class="bi bi-arrow-left me-1"></i> Previous (Eligibility Rules)' +
          '</button>' +
          '<div class="d-flex align-items-center gap-2">' +
            '<button class="btn btn-outline-success" id="btn-save-draft">' +
              '<i class="bi bi-check2 me-1"></i> Save Channel Settings' +
            '</button>' +
            '<button class="btn btn-save-next" id="btn-save-next">' +
              '<i class="bi bi-check2-circle me-1"></i> Complete & View Circular' +
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

      // Edit Sequence Button
      var editBtn = view.querySelector('#btn-edit-approvers');
      if (editBtn) {
        editBtn.addEventListener('click', function () {
          editApproversModal(stg, activePhaseKey, function () {
            renderView();
          });
        });
      }

      // Required toggle switch
      var reqSwitch = view.querySelector('#f-required');
      if (reqSwitch) {
        reqSwitch.addEventListener('change', function () {
          var patch = {};
          if (activePhaseKey === 'APPLICANT') {
            patch.requireApplicantApproval = reqSwitch.checked;
          } else {
            patch.requireVenueApproval = reqSwitch.checked;
          }
          store.update('stages', stg.id, patch);
          store.audit('SET_APPROVAL_REQUIREMENT', 'stage', stg.id,
            activePhaseKey + ' approval required flag set to ' + reqSwitch.checked + ' for ' + pipe.typeLabel(stg.type));
          ui.toast('Approval requirement updated');
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
        sendBtn.addEventListener('click', function () {
          var roster = store.rosterOf(stg.id);
          var venues = store.venuesOf(stg.id);
          var summary = activePhaseKey === 'APPLICANT'
            ? fmt.plural(roster.length, 'candidate') + ' for ' + pipe.typeLabel(stg.type) + ' — ' + c.post
            : fmt.plural(venues.length, 'venue') + ' for ' + pipe.typeLabel(stg.type) + ' — ' + c.post;
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
          ERec.router.go('#/circulars/new-eligibility/' + c.id);
        });
      }

      // Save Draft Settings button
      var draftBtn = view.querySelector('#btn-save-draft');
      if (draftBtn) {
        draftBtn.addEventListener('click', function () {
          ui.toast('Approval channel configuration saved');
        });
      }

      // Save & Complete button
      var saveNextBtn = view.querySelector('#btn-save-next');
      if (saveNextBtn) {
        saveNextBtn.addEventListener('click', function () {
          ui.toast('Job Posting created and approval channels configured successfully!', 'success');
          ERec.router.go('#/circular/' + c.id);
        });
      }
    }

    renderView();
  }

  ERec.pages.newcircularApproval = { render: render };
})(window);
