/* Circular workspace: configure the exam stage chain, set approver chains,
   and see the whole pipeline at a glance.
   Pubali Bank PLC &middot; HRD E-Recruitment Admin Portal */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var TYPES = ['MCQ', 'WRITTEN', 'VIVA'];

  /* Ordered approver picker - the order of selection is the approval order.
     Opened from the approval step, which is where approvers are set up. */
  function editApprovers(stg, kind) {
    var field = kind === 'APPLICANT' ? 'applicantApprovers' : 'venueApprovers';
    var chosen = (stg[field] || []).slice();
    var approvers = store.where('users', function (u) { return u.role === 'APPROVER'; });

    function listHtml() {
      var picked = chosen.map(function (id, i) {
        var u = store.find('users', id);
        return '<div class="d-flex align-items-center gap-2 border rounded p-2 mb-2 bg-light">' +
          '<span class="pill green">Level ' + (i + 1) + '</span>' +
          '<div class="flex-grow-1"><div class="fw-semibold fs-13 text-dark">' + fmt.esc(u.name) + '</div>' +
          '<div class="fs-12 text-muted">' + fmt.esc(u.designation) + '</div></div>' +
          '<button class="btn btn-sm btn-light" data-up="' + id + '"' + (i === 0 ? ' disabled' : '') + ' title="Move Up"><i class="bi bi-arrow-up"></i></button>' +
          '<button class="btn btn-sm btn-light" data-down="' + id + '"' + (i === chosen.length - 1 ? ' disabled' : '') + ' title="Move Down"><i class="bi bi-arrow-down"></i></button>' +
          '<button class="btn btn-sm btn-outline-danger" data-rm="' + id + '" title="Remove"><i class="bi bi-x-lg"></i></button>' +
          '</div>';
      }).join('');

      var avail = approvers.filter(function (u) { return chosen.indexOf(u.id) < 0; });
      return '<div class="section-title mb-2"><i class="bi bi-diagram-3 text-success me-1"></i>Approval Routing Sequence</div>' +
        (picked || '<div class="fs-13 text-muted mb-3 p-2 bg-light rounded text-center">No approver assigned &mdash; this stage will proceed with direct administrative approval.</div>') +
        '<div class="section-title mt-3 mb-2"><i class="bi bi-person-plus text-success me-1"></i>Add Authorized Approver</div>' +
        (avail.length ? avail.map(function (u) {
          return '<button class="btn btn-sm btn-light d-flex align-items-center gap-2 w-100 mb-2 text-start p-2 border" data-add="' + u.id + '">' +
            ui.avatar(u.name, 'sm') +
            '<span><span class="d-block fw-semibold fs-13 text-dark">' + fmt.esc(u.name) + '</span>' +
            '<span class="d-block fs-12 text-muted">' + fmt.esc(u.designation) + '</span></span>' +
            '<i class="bi bi-plus-circle text-success ms-auto fs-5"></i></button>';
        }).join('') : '<div class="fs-12 text-muted">All approvers already in sequence.</div>');
    }

    var m = ui.modal({
      title: 'Configure Approvers &middot; ' + pipe.typeLabel(stg.type) + ' &middot; ' + (kind === 'APPLICANT' ? 'Candidate Roster' : 'Exam Venues'),
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
              chosen = chosen.filter(function (x) { return x !== b.dataset.rm; }); rebind();
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
          ui.toast('Approval sequence updated');
          ERec.router.refresh();
        });
      }
    });
    return m;
  }

  function stageHasProgress(stg) {
    return Object.keys(stg.steps || {}).length > 0;
  }

  function resequence(circularId) {
    store.stagesOf(circularId).forEach(function (s, i) { s.seq = i + 1; });
    store.save();
  }

  function addStage(circularId) {
    var stages = store.stagesOf(circularId);
    ui.modal({
      title: 'Add Examination Stage',
      body: '<label class="form-label">Examination Type</label>' +
        '<select class="form-select" id="f-type">' +
        TYPES.map(function (t) { return '<option value="' + t + '">' + pipe.typeLabel(t) + ' Examination</option>'; }).join('') +
        '</select>' +
        '<div class="form-text text-muted mt-2">The new stage is appended to the pipeline. ' +
        'Roll numbers are generated in the first exam stage, and document scrutiny activates automatically in Viva-Voce.</div>',
      footer: '<button class="btn btn-sm btn-outline-secondary px-3" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-green-solid px-4" data-act="add"><i class="bi bi-plus-lg me-1"></i> Add Stage</button>',
      onShow: function (api) {
        api.find('[data-act="add"]').addEventListener('click', function () {
          var type = api.find('#f-type').value;
          store.insert('stages', {
            id: fmt.uid('stg'), circularId: circularId, type: type, seq: stages.length + 1,
            name: pipe.typeLabel(type) + ' Examination',
            requireApplicantApproval: false, requireVenueApproval: false,
            applicantApprovers: [], venueApprovers: [],
            instructions: '', examDate: null,
            fullMarks: type === 'VIVA' ? 50 : 100, passMarks: type === 'VIVA' ? 25 : 50,
            status: 'NOT_STARTED', steps: {}
          });
          store.audit('ADD_STAGE', 'circular', circularId, pipe.typeLabel(type) + ' stage added');
          api.close();
          ui.toast('Examination stage added');
          ERec.router.refresh();
        });
      }
    });
  }

  function approvalSummary(stg, kind) {
    var required = kind === 'APPLICANT' ? stg.requireApplicantApproval : stg.requireVenueApproval;
    var ids = (kind === 'APPLICANT' ? stg.applicantApprovers : stg.venueApprovers) || [];
    var label = kind === 'APPLICANT' ? 'Candidate Roster' : 'Exam Venues';
    var route = '#/circular/' + stg.circularId + '/stage/' + stg.id + '/' +
      (kind === 'APPLICANT' ? 'approval-applicant' : 'approval-venue');
    return '<div class="appr-line">' +
      '<span class="appr-what text-dark fw-medium">' + label + '</span>' +
      (required ? ui.pill('Required', 'blue') : ui.pill('Optional', 'outline')) +
      '<span class="appr-who text-secondary">' + (ids.length
        ? ids.map(function (id, i) {
          var u = store.find('users', id);
          return (i ? ' &rarr; ' : '') + fmt.esc(u ? u.name : id);
        }).join('')
        : '<span class="text-muted">Direct Administrative Approval</span>') + '</span>' +
      '<a class="appr-set text-success fw-semibold ms-auto" href="' + route + '">Configure &rarr;</a>' +
      '</div>';
  }

  function stageRow(stg, i, total) {
    var p = pipe.progress(stg);
    var locked = stageHasProgress(stg);
    return '<tr data-sid="' + stg.id + '">' +
      '<td class="nowrap"><span class="pill green">Stage ' + stg.seq + '</span></td>' +
      '<td>' +
        '<select class="form-select form-select-sm fw-semibold" data-type="' + stg.id + '" style="width:145px"' +
          (locked ? ' disabled title="This stage has already been initiated"' : '') + '>' +
        TYPES.map(function (t) {
          return '<option value="' + t + '"' + (t === stg.type ? ' selected' : '') + '>' + pipe.typeLabel(t) + '</option>';
        }).join('') + '</select>' +
        (stg.seq === 1 ? '<div class="fs-12 text-success mt-1"><i class="bi bi-123 me-1"></i>Roll numbers generated here</div>' : '') +
        (stg.type === 'VIVA' ? '<div class="fs-12 text-primary mt-1"><i class="bi bi-folder-check me-1"></i>Includes document scrutiny</div>' : '') +
      '</td>' +
      '<td>' + approvalSummary(stg, 'APPLICANT') + approvalSummary(stg, 'VENUE') + '</td>' +
      '<td style="min-width:140px">' + ui.progressBar(fmt.pct(p.done, p.total)) +
        '<div class="fs-12 text-muted mt-1 d-flex justify-content-between">' +
          '<span>' + p.done + ' of ' + p.total + ' steps</span>' +
          (p.pending ? '<span class="text-warning fw-semibold">' + p.pending + ' waiting</span>' : '<span class="text-success fw-semibold">Ready</span>') +
        '</div></td>' +
      '<td class="text-end nowrap">' +
        '<a class="btn btn-sm btn-outline-success" href="#/circular/' + stg.circularId + '/stage/' + stg.id + '">Open <i class="bi bi-chevron-right"></i></a> ' +
        '<button class="btn btn-sm btn-light" data-move="up" data-sid="' + stg.id + '"' + (i === 0 ? ' disabled' : '') + ' title="Move earlier"><i class="bi bi-arrow-up"></i></button> ' +
        '<button class="btn btn-sm btn-light" data-move="down" data-sid="' + stg.id + '"' + (i === total - 1 ? ' disabled' : '') + ' title="Move later"><i class="bi bi-arrow-down"></i></button> ' +
        '<button class="btn btn-sm btn-outline-danger" data-del="' + stg.id + '" title="Remove stage"><i class="bi bi-trash"></i></button>' +
      '</td></tr>';
  }

  function pipelineMap(c) {
    var stages = store.stagesOf(c.id);
    return stages.map(function (s) {
      var steps = pipe.steps(s);
      var p = pipe.progress(s);
      return '<div class="mb-3 p-3 bg-light rounded-3 border">' +
        '<div class="d-flex align-items-center gap-2 mb-2 flex-wrap">' +
          '<span class="pill ' + (p.done === p.total ? 'green' : 'blue') + '">Stage ' + s.seq + '</span>' +
          '<span class="fw-bold text-dark fs-6">' + fmt.esc(pipe.stageName(s)) + '</span>' +
          '<span class="badge bg-white text-secondary border ms-1">' + p.done + '/' + p.total + ' required completed</span>' +
          '<div class="spacer flex-grow-1"></div>' +
          '<a class="btn btn-sm btn-green-solid" href="#/circular/' + c.id + '/stage/' + s.id + '">Enter Stage <i class="bi bi-chevron-right ms-1"></i></a>' +
        '</div>' +
        '<div class="d-flex flex-wrap gap-2 mt-2">' + steps.map(function (st) {
          var tone = st.done ? (st.skipped ? 'outline' : 'green') : (st.enabled ? 'blue' : 'grey');
          var icon = st.done ? (st.skipped ? 'bi-dash-lg' : 'bi-check2-circle') : (st.enabled ? 'bi-play-circle-fill' : 'bi-lock-fill');
          return '<a href="' + st.route + '" class="pill ' + tone + ' shadow-sm py-1 px-2" title="' + fmt.esc(st.blockedReason || st.label) + '">' +
            '<i class="bi ' + icon + '"></i> ' + fmt.esc(st.label) + (st.optional ? ' <span class="badge bg-light text-muted ms-1" style="font-size:0.65rem">OPT</span>' : '') + '</a>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function render(view, params) {
    var c = store.circular(params.cid);
    if (!c) { ERec.router.go('#/circulars'); return; }
    ERec.router.setCrumbs([{ label: 'Job Circulars', href: '#/circulars' }, { label: c.post }]);

    var stages = store.stagesOf(c.id);
    var applicants = store.applicantsOf(c.id);
    var active = pipe.activeStage(c.id);
    var cur = active ? pipe.currentStep(active) : null;

    var html = ui.pageHead({
      title: fmt.esc(c.post),
      sub: fmt.esc(c.title) + ' &middot; <span class="mono text-success fw-bold">' + fmt.esc(c.code) + '</span>',
      actions: (cur ? '<a class="btn btn-sm btn-green-solid btn-icon shadow-sm" href="' + cur.route + '"><i class="bi bi-play-circle-fill"></i> Continue: ' + fmt.esc(cur.label) + '</a>' : '')
    });

    html += '<div class="row g-3 mb-4">' +
      '<div class="col-12 col-sm-6 col-xl-3">' +
        '<div class="stat-card-modern shadow-sm h-100" style="background-color: #eef5fc;">' +
          '<div class="d-flex align-items-center justify-content-between">' +
            '<div><span class="text-secondary fw-semibold small">Registered Applicants</span><h3 class="fw-bold mb-0 mt-1" style="color:#1e293b;">' + applicants.length + '</h3></div>' +
            '<div class="stat-icon-badge bg-white text-primary shadow-sm"><i class="bi bi-people-fill"></i></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="col-12 col-sm-6 col-xl-3">' +
        '<div class="stat-card-modern shadow-sm h-100" style="background-color: #ecfdf5;">' +
          '<div class="d-flex align-items-center justify-content-between">' +
            '<div><span class="text-secondary fw-semibold small">Authorized Vacancies</span><h3 class="fw-bold mb-0 mt-1" style="color:#047857;">' + c.vacancies + '</h3></div>' +
            '<div class="stat-icon-badge bg-white text-success shadow-sm"><i class="bi bi-briefcase-fill"></i></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="col-12 col-sm-6 col-xl-3">' +
        '<div class="stat-card-modern shadow-sm h-100" style="background-color: #fff8ec;">' +
          '<div class="d-flex align-items-center justify-content-between">' +
            '<div><span class="text-secondary fw-semibold small">Pipeline Structure</span><h4 class="fw-bold mb-0 mt-1" style="color:#b45309; font-size:1.15rem">' + stages.length + ' Stages</h4></div>' +
            '<div class="stat-icon-badge bg-white text-warning shadow-sm"><i class="bi bi-diagram-3-fill"></i></div>' +
          '</div>' +
          '<div class="mt-2 text-muted small text-truncate">' + fmt.esc(pipe.chainLabel(c.id)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="col-12 col-sm-6 col-xl-3">' +
        '<div class="stat-card-modern shadow-sm h-100" style="background-color: #f5f3ff;">' +
          '<div class="d-flex align-items-center justify-content-between">' +
            '<div><span class="text-secondary fw-semibold small">Application Window</span><h4 class="fw-bold mb-0 mt-1" style="color:#6d28d9; font-size:1rem">' + fmt.date(c.applyEnd) + '</h4></div>' +
            '<div class="stat-icon-badge bg-white text-purple shadow-sm" style="color:#8b5cf6"><i class="bi bi-calendar-check-fill"></i></div>' +
          '</div>' +
          '<div class="mt-2 text-muted small">Opened: ' + fmt.date(c.applyStart) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    html += ui.card({
      title: '<i class="bi bi-layers-fill text-success me-2"></i>Examination Pipeline Sequence',
      hint: 'Configure the order of examinations for this recruitment drive. Roll numbers are generated in stage 1, and document scrutiny runs in Viva-Voce.',
      actions: '<button class="btn btn-sm btn-green-solid btn-icon shadow-sm" id="btn-add-stage"><i class="bi bi-plus-lg"></i> Add Examination Stage</button>',
      tight: true,
      body: stages.length ? '<div class="table-scroll"><table class="table-x"><thead><tr>' +
        '<th>Stage</th><th>Examination Type</th><th style="min-width:300px">Approval Routing Setup</th>' +
        '<th>Progress</th><th>Actions</th>' +
        '</tr></thead><tbody>' +
        stages.map(function (s, i) { return stageRow(s, i, stages.length); }).join('') +
        '</tbody></table></div>'
        : ui.empty('No stages configured', 'Add at least one examination stage to start.', 'bi-diagram-3')
    });

    html += ui.card({
      title: '<i class="bi bi-diagram-3 text-success me-2"></i>Full Operational Pipeline Roadmap',
      hint: 'Visual stage breakdown with real-time progress indicators across every workflow step.',
      body: stages.length ? pipelineMap(c) : ui.empty('Nothing to show yet')
    });

    view.innerHTML = html;

    view.querySelector('#btn-add-stage').addEventListener('click', function () { addStage(c.id); });

    ui.on(view, '[data-type]', 'change', function (e, sel) {
      var stg = store.stage(sel.dataset.type);
      store.update('stages', stg.id, {
        type: sel.value, name: pipe.typeLabel(sel.value) + ' Examination',
        fullMarks: sel.value === 'VIVA' ? 50 : 100, passMarks: sel.value === 'VIVA' ? 25 : 50
      });
      ui.toast('Stage type updated to ' + pipe.typeLabel(sel.value));
      ERec.router.refresh();
    });

    ui.on(view, '[data-move]', 'click', function (e, b) {
      var list = store.stagesOf(c.id);
      var i = list.findIndex(function (s) { return s.id === b.dataset.sid; });
      var j = b.dataset.move === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;
      var a = list[i].seq; list[i].seq = list[j].seq; list[j].seq = a;
      store.save();
      ERec.router.refresh();
    });

    ui.on(view, '[data-del]', 'click', function (e, b) {
      var stg = store.stage(b.dataset.del);
      ui.confirm({
        title: 'Remove Examination Stage',
        body: 'Are you sure you want to remove the <strong>' + fmt.esc(pipe.typeLabel(stg.type)) + '</strong> stage?' +
          (stageHasProgress(stg) ? ' <div class="text-danger mt-2"><i class="bi bi-exclamation-triangle me-1"></i>This stage already has registered records; roster, venues, marks and approvals will be cleared.</div>' : ''),
        okText: 'Remove Stage', danger: true
      }).then(function (ok) {
        if (!ok) return;
        store.where('stageApplicants', function (r) { return r.stageId === stg.id; })
          .forEach(function (r) { store.remove('stageApplicants', r.id); });
        store.where('venues', function (v) { return v.stageId === stg.id; })
          .forEach(function (v) { store.remove('venues', v.id); });
        store.where('approvals', function (a) { return a.stageId === stg.id; })
          .forEach(function (a) { store.remove('approvals', a.id); });
        store.remove('stages', stg.id);
        resequence(c.id);
        store.audit('REMOVE_STAGE', 'circular', c.id, pipe.typeLabel(stg.type) + ' stage removed');
        ui.toast('Examination stage removed');
        ERec.router.refresh();
      });
    });
  }

  ERec.pages.circular = { render: render, editApprovers: editApprovers };
})(window);
