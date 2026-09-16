/* Circular workspace: configure the exam stage chain, set approver chains,
   and see the whole pipeline at a glance. */
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
        return '<div class="d-flex align-items-center gap-2 border rounded p-2 mb-2">' +
          '<span class="pill green">Level ' + (i + 1) + '</span>' +
          '<div class="flex-grow-1"><div class="fw-semibold fs-13">' + fmt.esc(u.name) + '</div>' +
          '<div class="fs-12 muted">' + fmt.esc(u.designation) + '</div></div>' +
          '<button class="btn btn-sm btn-light" data-up="' + id + '"' + (i === 0 ? ' disabled' : '') + ' title="Move Up"><i class="bi bi-arrow-up"></i></button>' +
          '<button class="btn btn-sm btn-light" data-down="' + id + '"' + (i === chosen.length - 1 ? ' disabled' : '') + ' title="Move Down"><i class="bi bi-arrow-down"></i></button>' +
          '<button class="btn btn-sm btn-outline-danger" data-rm="' + id + '" title="Remove"><i class="bi bi-x-lg"></i></button>' +
          '</div>';
      }).join('');

      var avail = approvers.filter(function (u) { return chosen.indexOf(u.id) < 0; });
      return '<div class="section-title">Approval sequence</div>' +
        (picked || '<div class="fs-13 muted mb-2">No approver selected — this approval step can still be skipped.</div>') +
        '<div class="section-title">Add approver</div>' +
        (avail.length ? avail.map(function (u) {
          return '<button class="btn btn-sm btn-light d-flex align-items-center gap-2 w-100 mb-2 text-start p-2 border" data-add="' + u.id + '">' +
            ui.avatar(u.name, 'sm') +
            '<span><span class="d-block fw-semibold fs-13">' + fmt.esc(u.name) + '</span>' +
            '<span class="d-block fs-12 muted">' + fmt.esc(u.designation) + '</span></span>' +
            '<i class="bi bi-plus-lg ms-auto"></i></button>';
        }).join('') : '<div class="fs-12 muted">All approvers added.</div>');
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
          ui.toast('Approval sequence saved');
          ERec.router.refresh();
        });
      }
    });
    return m;
  }

  /* ---------- eligibility rule builder ----------
     One dropdown picks the rule type; only that type's fields are shown, and
     the preview line restates the rule in plain English as it is filled in. */

  function rulesOf(c) { return c.eligibilityRules || []; }

  function saveRules(c, list, note) {
    store.update('circulars', c.id, { eligibilityRules: list });
    store.audit('EDIT_RULES', 'circular', c.id, note);
    ERec.router.refresh();
  }

  /* The fields that belong to each rule type. */
  function ruleFieldsHtml(r) {
    var levels = ERec.seed.DEGREE_LEVELS.map(function (l) {
      return '<option value="' + l + '"' + (r.degreeLevel === l ? ' selected' : '') + '>' + l + '</option>';
    }).join('');

    switch (r.type) {
      case 'AGE':
        return '<div class="row g-3">' +
          '<div class="col-md-6"><label class="form-label">Minimum Age</label>' +
            '<input type="number" min="14" max="70" class="form-control" data-f="minAge" value="' +
            fmt.esc(r.minAge || '') + '" placeholder="e.g. 21"></div>' +
          '<div class="col-md-6"><label class="form-label">Maximum Age</label>' +
            '<input type="number" min="14" max="70" class="form-control" data-f="maxAge" value="' +
            fmt.esc(r.maxAge || '') + '" placeholder="e.g. 30"></div>' +
          '<div class="col-12"><label class="form-label">Age counted as on</label>' +
            '<input type="date" class="form-control" data-f="asOn" value="' + fmt.esc(r.asOn || '') + '">' +
            '<div class="form-text">Leave blank to count age from the application closing date.</div></div>' +
          '</div>';

      case 'EXPERIENCE':
        return '<label class="form-label">Minimum Years of Experience</label>' +
          '<input type="number" min="0" max="40" step="0.5" class="form-control mb-3" data-f="minYears" value="' +
            fmt.esc(r.minYears || '') + '" placeholder="e.g. 2">' +
          '<label class="form-label">Industry (optional)</label>' +
          '<input class="form-control" data-f="industry" value="' + fmt.esc(r.industry || '') + '" placeholder="e.g. Banking">' +
          '<div class="form-text mb-3">Only experience where the applicant selected this industry counts towards the total.</div>' +
          '<label class="form-label">Designation keywords (optional, comma-separated)</label>' +
          '<input class="form-control mb-3" data-f="designationKeywords" value="' +
            fmt.esc(r.designationKeywords || '') + '" placeholder="e.g. Officer, Executive">' +
          '<label class="form-label">Responsibility keywords (optional, comma-separated)</label>' +
          '<input class="form-control" data-f="responsibilityKeywords" value="' +
            fmt.esc(r.responsibilityKeywords || '') + '" placeholder="e.g. accounting, audit">' +
          '<div class="form-text">Only experience where the job title or responsibilities contain one of these words counts towards the total.</div>';

      case 'DEGREE_LEVEL':
        return '<label class="form-label">Minimum Degree Level</label>' +
          '<select class="form-select mb-3" data-f="degreeLevel">' + levels + '</select>' +
          '<div class="form-check">' +
            '<input class="form-check-input" type="checkbox" id="r-mandatory" data-f="mandatory"' +
            (r.mandatory === false ? '' : ' checked') + '>' +
            '<label class="form-check-label fw-semibold" for="r-mandatory">Mandatory</label>' +
          '</div>' +
          '<div class="form-text">Untick "Mandatory" to just prefer this degree without disqualifying applicants who don\'t have it.</div>';

      case 'RESULT_GRADE':
        return '<label class="form-label">Division/Class text (fails if any result contains this)</label>' +
          '<input class="form-control mb-3" data-f="divisionText" value="' +
            fmt.esc(r.divisionText || '') + '" placeholder="e.g. Third">' +
          '<label class="form-label">Minimum GPA/CGPA, on a 5.0 scale (optional)</label>' +
          '<input type="number" step="0.01" min="0" max="5" class="form-control" data-f="minGpa" value="' +
            fmt.esc(r.minGpa || '') + '" placeholder="e.g. 3.0">' +
          '<div class="form-text">Set this to also catch GPA-graded results (most SSC/HSC results since 2001 use GPA, not division). Set at least one of the two fields above.</div>';

      case 'SUBJECT':
        return '<label class="form-label">Degree Level</label>' +
          '<select class="form-select mb-3" data-f="degreeLevel">' + levels + '</select>' +
          '<label class="form-label">Allowed subjects (comma-separated)</label>' +
          '<input class="form-control" data-f="allowedSubjects" value="' +
            fmt.esc(r.allowedSubjects || '') + '" placeholder="e.g. Accounting, Finance, Management">' +
          '<div class="form-text">Applicant\'s result at this degree level must be in one of these subjects.</div>';

      default:
        return '';
    }
  }

  function ruleModal(c, existing) {
    /* Work on a copy so Cancel really cancels. */
    var r = existing
      ? JSON.parse(JSON.stringify(existing))
      : ERec.seed.blankRule('AGE');

    ui.modal({
      title: '<i class="bi bi-shield-check text-success me-2"></i>' +
        (existing ? 'Edit Eligibility Rule' : 'Add Eligibility Rule'),
      size: 'lg',
      body:
        '<div class="row g-3 mb-1">' +
          '<div class="col-md-7"><label class="form-label">Rule Type <span class="text-danger">*</span></label>' +
            '<select class="form-select" id="r-type">' +
            ERec.seed.RULE_TYPES.map(function (t) {
              return '<option value="' + t.key + '"' + (r.type === t.key ? ' selected' : '') + '>' +
                fmt.esc(t.label) + '</option>';
            }).join('') + '</select>' +
            '<div class="form-text">These ' + ERec.seed.RULE_TYPES.length +
            ' types are the only ones the eligibility engine actually evaluates.</div></div>' +
          '<div class="col-md-5"><label class="form-label">Status</label>' +
            '<select class="form-select" id="r-status">' +
              '<option value="ACTIVE"' + (r.status !== 'INACTIVE' ? ' selected' : '') + '>Active</option>' +
              '<option value="INACTIVE"' + (r.status === 'INACTIVE' ? ' selected' : '') + '>Inactive</option>' +
            '</select></div>' +
        '</div>' +

        '<label class="form-label">Rule Name / Title <span class="text-danger">*</span></label>' +
        '<input class="form-control mb-3" id="r-name" value="' + fmt.esc(r.name || '') +
          '" placeholder="e.g., Minimum Age Requirement, SSC GPA >= 3.5">' +

        '<div id="r-fields">' + ruleFieldsHtml(r) + '</div>' +

        '<label class="form-label mt-3">Preview</label>' +
        '<div class="preview-box fst-italic" id="r-preview">' + fmt.esc(ERec.seed.describeRule(r)) + '</div>' +

        '<label class="form-label mt-3">Failure Message</label>' +
        '<input class="form-control" id="r-fail" value="' + fmt.esc(r.failureMessage || '') +
          '" placeholder="e.g., Applicant must be between 21 and 30 years old.">',
      footer: '<button class="btn btn-sm btn-outline-secondary px-3" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-green-solid px-4" data-act="save">' +
        '<i class="bi bi-check2 me-1"></i> Save Rule</button>',
      onShow: function (api) {
        /* Pull whatever the type-specific inputs currently hold into `r`. */
        function collect() {
          api.el.querySelectorAll('[data-f]').forEach(function (el) {
            r[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value.trim();
          });
          r.name = api.find('#r-name').value.trim();
          r.status = api.find('#r-status').value;
          r.failureMessage = api.find('#r-fail').value.trim();
        }

        function paintPreview() {
          collect();
          api.find('#r-preview').textContent = ERec.seed.describeRule(r);
        }

        /* Changing the type swaps the whole field set, keeping name/status. */
        api.find('#r-type').addEventListener('change', function (e) {
          var keep = { id: r.id, name: r.name, status: r.status, failureMessage: r.failureMessage };
          r = Object.assign(ERec.seed.blankRule(e.target.value), keep);
          api.find('#r-fields').innerHTML = ruleFieldsHtml(r);
          paintPreview();
        });

        ui.on(api.el, '[data-f]', 'input', paintPreview);
        ui.on(api.el, '[data-f]', 'change', paintPreview);
        api.find('#r-name').addEventListener('input', collect);
        api.find('#r-fail').addEventListener('input', collect);
        paintPreview();

        api.find('[data-act="save"]').addEventListener('click', function () {
          collect();
          if (!r.name) { ui.toast('Give the rule a name', 'warning'); return; }
          if (r.type === 'AGE' && !r.minAge && !r.maxAge) {
            ui.toast('Set a minimum and/or maximum age', 'warning'); return;
          }
          if (r.type === 'AGE' && r.minAge && r.maxAge && Number(r.maxAge) < Number(r.minAge)) {
            ui.toast('Maximum age cannot be lower than minimum age', 'warning'); return;
          }
          if (r.type === 'EXPERIENCE' && !r.minYears) { ui.toast('Set the minimum years of experience', 'warning'); return; }
          if (r.type === 'RESULT_GRADE' && !r.divisionText && !r.minGpa) {
            ui.toast('Set a division/class text or a minimum GPA', 'warning'); return;
          }
          if (r.type === 'SUBJECT' && !ERec.seed.csvList(r.allowedSubjects).length) {
            ui.toast('List at least one allowed subject', 'warning'); return;
          }

          var list = rulesOf(c).slice();
          var i = list.findIndex(function (x) { return x.id === r.id; });
          if (i >= 0) list[i] = r; else list.push(r);
          saveRules(c, list, (existing ? 'Rule updated: ' : 'Rule added: ') + r.name);
          api.close();
          ui.toast(existing ? 'Rule updated' : 'Rule added');
        });
      }
    });
  }

  /* Copy the whole rule set across from another circular. */
  function copyRulesModal(c) {
    var others = store.where('circulars', function (x) {
      return x.id !== c.id && (x.eligibilityRules || []).length;
    });
    if (!others.length) {
      ui.modal({
        title: 'Copy Rules From',
        body: ui.empty('No other circular has rules yet',
          'Add rules to another circular first, then you can copy them here.', 'bi-shield-exclamation'),
        footer: '<button class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Close</button>'
      });
      return;
    }
    ui.modal({
      title: '<i class="bi bi-files text-success me-2"></i>Copy Rules From',
      body: '<p class="fs-13 text-muted">The selected circular\'s rules are appended to this one. ' +
        'Existing rules are kept.</p>' +
        others.map(function (x) {
          return '<button class="btn btn-light d-flex align-items-center gap-2 w-100 mb-2 text-start p-2 border" ' +
            'data-from="' + x.id + '">' +
            '<span class="flex-grow-1"><span class="d-block fw-semibold fs-13">' + fmt.esc(x.post) + '</span>' +
            '<span class="d-block fs-12 muted mono">' + fmt.esc(x.code) + '</span></span>' +
            '<span class="badge bg-light text-secondary border">' +
            fmt.plural((x.eligibilityRules || []).length, 'rule') + '</span>' +
            '<i class="bi bi-arrow-right ms-1"></i></button>';
        }).join(''),
      footer: '<button class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>',
      onShow: function (api) {
        ui.on(api.el, '[data-from]', 'click', function (e, b) {
          var src = store.circular(b.dataset.from);
          /* fresh ids, so editing a copy never touches the original */
          var copied = (src.eligibilityRules || []).map(function (x) {
            return Object.assign({}, x, { id: fmt.uid('rul') });
          });
          saveRules(c, rulesOf(c).concat(copied), fmt.plural(copied.length, 'rule') + ' copied from ' + src.post);
          api.close();
          ui.toast(fmt.plural(copied.length, 'rule') + ' copied from ' + src.post);
        });
      }
    });
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
        TYPES.map(function (t) { return '<option value="' + t + '">' + pipe.typeLabel(t) + '</option>'; }).join('') +
        '</select>' +
        '<div class="form-text mt-2">The new stage is appended at the end of the chain. ' +
        'Roll numbers are generated at the first stage, and scrutiny appears automatically on a Viva-Voce stage.</div>',
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
          ui.toast('Stage added');
          ERec.router.refresh();
        });
      }
    });
  }

  /* One compact line per approval point. The switches and the approver
     sequence itself are edited on the approval step, where the user is
     actually doing that job - this screen only says what is set up. */
  function approvalSummary(stg, kind) {
    var required = kind === 'APPLICANT' ? stg.requireApplicantApproval : stg.requireVenueApproval;
    var ids = (kind === 'APPLICANT' ? stg.applicantApprovers : stg.venueApprovers) || [];
    var label = kind === 'APPLICANT' ? 'Candidate list' : 'Venue';
    var route = '#/circular/' + stg.circularId + '/stage/' + stg.id + '/' +
      (kind === 'APPLICANT' ? 'approval-applicant' : 'approval-venue');
    return '<div class="appr-line">' +
      '<span class="appr-what">' + label + '</span>' +
      (required ? ui.pill('Required', 'blue') : ui.pill('Optional', 'outline')) +
      '<span class="appr-who">' + (ids.length
        ? ids.map(function (id, i) {
          var u = store.find('users', id);
          return (i ? ' → ' : '') + fmt.esc(u ? u.name : id);
        }).join('')
        : '<span class="muted">no approver set</span>') + '</span>' +
      '<a class="appr-set" href="' + route + '">Set up</a>' +
      '</div>';
  }

  function stageRow(stg, i, total) {
    var p = pipe.progress(stg);
    var locked = stageHasProgress(stg);
    return '<tr data-sid="' + stg.id + '">' +
      '<td class="nowrap"><span class="pill green">Stage ' + stg.seq + '</span></td>' +
      '<td>' +
        '<select class="form-select form-select-sm" data-type="' + stg.id + '" style="width:132px"' +
          (locked ? ' disabled title="This stage has already been started"' : '') + '>' +
        TYPES.map(function (t) {
          return '<option value="' + t + '"' + (t === stg.type ? ' selected' : '') + '>' + pipe.typeLabel(t) + '</option>';
        }).join('') + '</select>' +
        (stg.seq === 1 ? '<div class="fs-12 muted mt-1"><i class="bi bi-123"></i> roll numbers are given here</div>' : '') +
        (stg.type === 'VIVA' ? '<div class="fs-12 muted mt-1"><i class="bi bi-folder-check"></i> includes document scrutiny</div>' : '') +
      '</td>' +
      '<td>' + approvalSummary(stg, 'APPLICANT') + approvalSummary(stg, 'VENUE') + '</td>' +
      '<td style="min-width:130px">' + ui.progressBar(fmt.pct(p.done, p.total)) +
        '<div class="fs-12 muted mt-1">' + p.done + ' of ' + p.total + ' steps' +
        (p.pending ? ' · <span class="text-warning fw-semibold">' + p.pending + ' waiting</span>' : '') + '</div></td>' +
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
        '<div class="d-flex flex-wrap gap-1">' + steps.map(function (st) {
          var tone = st.done ? (st.skipped ? 'outline' : 'green') : (st.enabled ? 'blue' : 'grey');
          var icon = st.done ? (st.skipped ? 'bi-dash-lg' : 'bi-check-lg') : (st.enabled ? 'bi-play-fill' : 'bi-lock-fill');
          return '<a href="' + st.route + '" class="pill ' + tone + ' shadow-sm py-1 px-2" title="' + fmt.esc(st.blockedReason || st.label) + '">' +
            '<i class="bi ' + icon + '"></i> ' + fmt.esc(st.label) + (st.optional ? ' <span class="badge bg-light text-muted ms-1" style="font-size:0.65rem">OPT</span>' : '') + '</a>';
        }).join('') + '</div></div>';
    }).join('<hr class="hr-soft">');
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
            '<div><span class="text-secondary fw-semibold small">Registered Applicants</span>' +
            '<h3 class="fw-bold mb-0 mt-1" style="color:#1e293b;">' + applicants.length + '</h3></div>' +
            '<div class="stat-icon-badge bg-white text-primary shadow-sm"><i class="bi bi-people-fill"></i></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="col-12 col-sm-6 col-xl-3">' +
        '<div class="stat-card-modern shadow-sm h-100" style="background-color: #ecfdf5;">' +
          '<div class="d-flex align-items-center justify-content-between">' +
            '<div><span class="text-secondary fw-semibold small">Authorised Vacancies</span>' +
            '<h3 class="fw-bold mb-0 mt-1" style="color:#047857;">' + c.vacancies + '</h3></div>' +
            '<div class="stat-icon-badge bg-white text-success shadow-sm"><i class="bi bi-briefcase-fill"></i></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="col-12 col-sm-6 col-xl-3">' +
        '<div class="stat-card-modern shadow-sm h-100" style="background-color: #fff8ec;">' +
          '<div class="d-flex align-items-center justify-content-between">' +
            '<div><span class="text-secondary fw-semibold small">Pipeline Structure</span>' +
            '<h4 class="fw-bold mb-0 mt-1" style="color:#b45309; font-size:1.15rem">' + stages.length + ' Stages</h4></div>' +
            '<div class="stat-icon-badge bg-white text-warning shadow-sm"><i class="bi bi-diagram-3-fill"></i></div>' +
          '</div>' +
          '<div class="mt-2 text-muted small text-truncate">' + fmt.esc(pipe.chainLabel(c.id)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="col-12 col-sm-6 col-xl-3">' +
        '<div class="stat-card-modern shadow-sm h-100" style="background-color: #f5f3ff;">' +
          '<div class="d-flex align-items-center justify-content-between">' +
            '<div><span class="text-secondary fw-semibold small">Application Window</span>' +
            '<h4 class="fw-bold mb-0 mt-1" style="color:#6d28d9; font-size:1rem">' + fmt.date(c.applyEnd) +
            (c.applyEndTime ? ' <span class="fw-normal" style="font-size:0.8rem">' + fmt.time12(c.applyEndTime) + '</span>' : '') +
            '</h4></div>' +
            '<div class="stat-icon-badge bg-white shadow-sm" style="color:#8b5cf6"><i class="bi bi-calendar-check-fill"></i></div>' +
          '</div>' +
          '<div class="mt-2 text-muted small">Opened: ' + fmt.date(c.applyStart) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    var rules = rulesOf(c);
    var ruleRows = rules.map(function (r) {
      var off = r.status === 'INACTIVE';
      return '<tr' + (off ? ' style="opacity:.55"' : '') + '>' +
        '<td><div class="fw-semibold">' + fmt.esc(r.name) + '</div>' +
          '<div class="fs-12 muted">' + fmt.esc(r.failureMessage || 'No failure message set') + '</div></td>' +
        '<td class="nowrap"><span class="pill blue">' +
          fmt.esc(ERec.seed.ruleTypeLabel(r.type)) + '</span></td>' +
        '<td class="fs-13">' + fmt.esc(ERec.seed.describeRule(r)) + '</td>' +
        '<td>' + (off ? ui.pill('Inactive', 'grey') : ui.pill('Active', 'green')) + '</td>' +
        '<td class="text-end nowrap">' +
          '<button class="btn btn-sm btn-light" data-editrule="' + r.id + '" title="Edit"><i class="bi bi-pencil"></i></button> ' +
          '<button class="btn btn-sm btn-outline-danger" data-delrule="' + r.id + '" title="Remove"><i class="bi bi-trash"></i></button>' +
        '</td></tr>';
    }).join('');

    html += ui.card({
      title: '<i class="bi bi-shield-check text-success me-2"></i>Eligibility Rules',
      hint: 'The conditions an application is checked against. Each rule is one type the eligibility engine evaluates.',
      actions: '<button class="btn btn-sm btn-outline-secondary btn-icon" id="btn-copy-rules">' +
          '<i class="bi bi-files"></i> Copy Rules From</button>' +
        '<button class="btn btn-sm btn-green-solid btn-icon shadow-sm ms-2" id="btn-add-rule">' +
          '<i class="bi bi-plus-lg"></i> Add Eligibility Rule</button>',
      tight: true,
      body: rules.length
        ? '<div class="table-scroll"><table class="table-x"><thead><tr>' +
          '<th>Rule Name</th><th>Type</th><th>What it checks</th><th>Status</th><th>Actions</th>' +
          '</tr></thead><tbody>' + ruleRows + '</tbody></table></div>'
        : ui.empty('No eligibility rules yet',
            'Add a rule to start screening applications against this circular.', 'bi-shield-exclamation')
    });

    html += ui.card({
      title: '<i class="bi bi-layers-fill text-success me-2"></i>Examination Pipeline Sequence',
      hint: 'Which examinations this circular runs, and in what order. Roll numbers are given at stage 1, and any Viva-Voce stage automatically includes document scrutiny.',
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
    view.querySelector('#btn-add-rule').addEventListener('click', function () { ruleModal(c, null); });
    view.querySelector('#btn-copy-rules').addEventListener('click', function () { copyRulesModal(c); });

    ui.on(view, '[data-editrule]', 'click', function (e, b) {
      ruleModal(c, rulesOf(c).find(function (x) { return x.id === b.dataset.editrule; }));
    });

    ui.on(view, '[data-delrule]', 'click', function (e, b) {
      var r = rulesOf(c).find(function (x) { return x.id === b.dataset.delrule; });
      if (!r) return;
      ui.confirm({
        title: 'Remove Eligibility Rule',
        body: 'Remove <strong>' + fmt.esc(r.name) + '</strong> from this circular?',
        okText: 'Remove', danger: true
      }).then(function (ok) {
        if (!ok) return;
        saveRules(c, rulesOf(c).filter(function (x) { return x.id !== r.id; }), 'Rule removed: ' + r.name);
        ui.toast('Rule removed');
      });
    });

    ui.on(view, '[data-type]', 'change', function (e, sel) {
      var stg = store.stage(sel.dataset.type);
      store.update('stages', stg.id, {
        type: sel.value, name: pipe.typeLabel(sel.value) + ' Examination',
        fullMarks: sel.value === 'VIVA' ? 50 : 100, passMarks: sel.value === 'VIVA' ? 25 : 50
      });
      ui.toast('Stage type changed to ' + pipe.typeLabel(sel.value));
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
        body: 'Remove the <strong>' + fmt.esc(pipe.typeLabel(stg.type)) + '</strong> stage?' +
          (stageHasProgress(stg) ? ' <span class="text-danger">This stage already has completed steps; its roster, venues, marks and approvals will be discarded.</span>' : ''),
        okText: 'Remove', danger: true
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
        ui.toast('Stage removed');
        ERec.router.refresh();
      });
    });
  }

  ERec.pages.circular = {
    render: render, editApprovers: editApprovers,
    ruleModal: ruleModal, ruleFieldsHtml: ruleFieldsHtml, copyRulesModal: copyRulesModal
  };
})(window);
