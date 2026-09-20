/* Create Job Posting - Step 2: Eligibility Rules.
   Matches the Add Eligibility Rule options and design from circular.js. */
(function (global) {
  'use strict';

  var ERec = global.ERec = global.ERec || {};
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt;

  function rulesOf(c) {
    return c.eligibilityRules || [];
  }

  function saveRules(c, list, note, callback) {
    store.update('circulars', c.id, { eligibilityRules: list });
    store.audit('EDIT_RULES', 'circular', c.id, note);
    if (callback) callback();
  }

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

  function ruleModal(c, existing, onSaved) {
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
          saveRules(c, list, (existing ? 'Rule updated: ' : 'Rule added: ') + r.name, function () {
            if (onSaved) onSaved();
          });
          api.close();
          ui.toast(existing ? 'Rule updated' : 'Rule added');
        });
      }
    });
  }

  function copyRulesModal(c, onSaved) {
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
          var copied = (src.eligibilityRules || []).map(function (x) {
            return Object.assign({}, x, { id: fmt.uid('rul') });
          });
          saveRules(c, rulesOf(c).concat(copied), fmt.plural(copied.length, 'rule') + ' copied from ' + src.post, function () {
            if (onSaved) onSaved();
          });
          api.close();
          ui.toast(fmt.plural(copied.length, 'rule') + ' copied from ' + src.post);
        });
      }
    });
  }

  function render(view, params) {
    var cid = (params && params.cid) || '';
    var c = store.circular(cid);
    if (!c) {
      ui.toast('Circular not found', 'danger');
      ERec.router.go('#/circulars');
      return;
    }

    ERec.router.setCrumbs([
      { label: 'Job Circulars', href: '#/circulars' },
      { label: 'Create Job Posting', href: '#/circulars/new' },
      { label: 'Eligibility Rules' }
    ]);

    function renderRulesTable() {
      var rules = rulesOf(c);
      if (!rules.length) {
        return ui.empty('No eligibility rules yet',
          'Add a rule or copy from another circular to start screening applications.', 'bi-shield-exclamation');
      }
      var ruleRows = rules.map(function (r) {
        var off = r.status === 'INACTIVE';
        return '<tr' + (off ? ' style="opacity:.55"' : '') + '>' +
          '<td><div class="fw-semibold text-dark">' + fmt.esc(r.name) + '</div>' +
          '<div class="fs-12 muted">' + fmt.esc(r.failureMessage || 'No failure message set') + '</div></td>' +
          '<td class="nowrap"><span class="pill blue">' +
          fmt.esc(ERec.seed.ruleTypeLabel(r.type)) + '</span></td>' +
          '<td class="fs-13">' + fmt.esc(ERec.seed.describeRule(r)) + '</td>' +
          '<td>' + (off ? ui.pill('Inactive', 'grey') : ui.pill('Active', 'green')) + '</td>' +
          '<td class="text-end nowrap">' +
          '<button class="btn btn-sm btn-light me-1" data-editrule="' + r.id + '" title="Edit"><i class="bi bi-pencil"></i></button>' +
          '<button class="btn btn-sm btn-outline-danger" data-delrule="' + r.id + '" title="Remove"><i class="bi bi-trash"></i></button>' +
          '</td></tr>';
      }).join('');

      return '<div class="table-scroll"><table class="table table-striped table-hover align-middle table-x" id="table-eligibility-rules"><thead><tr>' +
        '<th>Rule Name</th><th>Type</th><th>What it checks</th><th>Status</th><th class="text-end" data-orderable="false">Actions</th>' +
        '</tr></thead><tbody>' + ruleRows + '</tbody></table></div>';
    }

    var html =
      '<div class="create-job-posting-container">' +

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

      '<!-- Stepper / Wizard -->' +
      '<div class="posting-wizard-card mb-4">' +
      '<div class="wizard-steps-container">' +
      '<div class="wizard-step is-completed">' +
      '<span class="step-num-circle"><i class="bi bi-check-lg"></i></span>' +
      '<span class="step-title">Basic Information</span>' +
      '</div>' +
      '<div class="wizard-step-line is-completed"></div>' +
      '<div class="wizard-step is-active">' +
      '<span class="step-num-circle">2</span>' +
      '<span class="step-title">Eligibility Rules</span>' +
      '</div>' +
      '<div class="wizard-step-line"></div>' +
      '<div class="wizard-step is-inactive">' +
      '<span class="step-num-circle">3</span>' +
      '<span class="step-title">Job Preview</span>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<!-- Eligibility Rules Section Card -->' +
      '<div class="card card-posting-section mb-4">' +
      '<div class="card-posting-head d-flex align-items-center justify-content-between flex-wrap gap-2">' +
      '<div class="d-flex align-items-center gap-2">' +
      '<i class="bi bi-shield-check"></i>' +
      '<span>Eligibility Rules</span>' +
      '</div>' +
      '<div class="d-flex align-items-center gap-2">' +
      '<button class="btn btn-sm btn-outline-secondary btn-icon" id="btn-copy-rules">' +
      '<i class="bi bi-files"></i> Copy Rules From' +
      '</button>' +
      '<button class="btn btn-sm btn-green-solid btn-icon shadow-sm" id="btn-add-rule">' +
      '<i class="bi bi-plus-lg"></i> Add Eligibility Rule' +
      '</button>' +
      '</div>' +
      '</div>' +
      '<div class="card-posting-body" id="rules-table-container">' +
      renderRulesTable() +
      '</div>' +
      '</div>' +

      '<!-- Save & Next action -->' +
      '<div class="d-flex justify-content-between align-items-center mb-5">' +
      '<button class="btn btn-outline-secondary" id="btn-prev-step">' +
      '<i class="bi bi-arrow-left me-1"></i> Previous' +
      '</button>' +
      '<button class="btn btn-save-next" id="btn-save-next">' +
      'Save & Next' +
      '</button>' +
      '</div>' +

      '</div>';

    view.innerHTML = html;

    function initTable() {
      var tbl = view.querySelector('#table-eligibility-rules');
      if (tbl) ui.dataTable(tbl, { pageLength: 10 });
    }

    initTable();

    function refreshTable() {
      var container = view.querySelector('#rules-table-container');
      if (container) {
        container.innerHTML = renderRulesTable();
        initTable();
      }
    }

    view.querySelector('#btn-add-rule').addEventListener('click', function () {
      ruleModal(c, null, refreshTable);
    });

    view.querySelector('#btn-copy-rules').addEventListener('click', function () {
      copyRulesModal(c, refreshTable);
    });

    ui.on(view, '[data-editrule]', 'click', function (e, b) {
      var r = rulesOf(c).find(function (x) { return x.id === b.dataset.editrule; });
      if (r) ruleModal(c, r, refreshTable);
    });

    ui.on(view, '[data-delrule]', 'click', function (e, b) {
      var r = rulesOf(c).find(function (x) { return x.id === b.dataset.delrule; });
      if (!r) return;
      ui.confirm({
        title: 'Remove Eligibility Rule',
        body: 'Are you sure you want to remove the rule <strong>' + fmt.esc(r.name) + '</strong>?',
        confirmText: 'Remove Rule',
        confirmClass: 'btn-danger',
        onConfirm: function () {
          var list = rulesOf(c).filter(function (x) { return x.id !== r.id; });
          saveRules(c, list, 'Rule removed: ' + r.name, refreshTable);
          ui.toast('Rule removed');
        }
      });
    });

    view.querySelector('#btn-back').addEventListener('click', function () {
      ERec.router.go('#/circulars');
    });

    view.querySelector('#btn-prev-step').addEventListener('click', function () {
      ERec.router.go('#/circulars/new');
    });

    view.querySelector('#btn-save-next').addEventListener('click', function () {
      var rules = rulesOf(c);
      if (!rules.length) {
        ui.toast('Please add at least one eligibility rule before proceeding', 'warning');
        return;
      }
      ui.toast('Eligibility rules saved successfully');
      ERec.router.go('#/circular/' + c.id);
    });
  }

  ERec.pages.newcircularEligibility = { render: render };
})(window);
