/* Create Job Posting - Basic Information page.
   Matches the design from the uploaded PDF specifications. */
(function (global) {
  'use strict';

  var ERec = global.ERec = global.ERec || {};
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var DEMO_APPLICANTS = 40;

  var STAGE_OPTIONS = [
    { key: 'MCQ', label: 'MCQ', fullTitle: 'Multiple Choice Questions (MCQ)', desc: 'Preliminary screening examination via objective questions' },
    { key: 'WRITTEN', label: 'Written', fullTitle: 'Written Examination', desc: 'Descriptive, essay and technical domain examination' },
    { key: 'VIVA', label: 'Viva voce', fullTitle: 'Viva-Voce & Interview', desc: 'Oral interview, document scrutiny & panel assessment' },
    { key: 'PRACTICAL', label: 'Practical Test', fullTitle: 'Practical / Lab / Typing Test', desc: 'Hands-on practical skills or computer typing examination' }
  ];

  function render(view) {
    ERec.router.setCrumbs([
      { label: 'Job Circulars', href: '#/circulars' },
      { label: 'Create Job Posting' }
    ]);

    var y = new Date().getFullYear();
    var selectedStages = ['MCQ', 'WRITTEN', 'VIVA'];
    var stageSearchQuery = '';

    function buildSelectedChipsHtml() {
      if (!selectedStages.length) {
        return '<span class="text-danger fs-12"><i class="bi bi-exclamation-circle me-1"></i>No stages selected. Please select at least one stage below.</span>';
      }
      return selectedStages.map(function (key, idx) {
        var opt = STAGE_OPTIONS.find(function (x) { return x.key === key; }) || { key: key, label: key };
        return '<span class="exam-stage-chip is-selected" data-stage="' + key + '">' +
          '<i class="bi bi-check2 text-success"></i> ' +
          '<span class="stage-num">' + (idx + 1) + '. </span>' +
          fmt.esc(opt.label) +
          '<button type="button" class="btn-remove-stage" data-remove-stage="' + key + '" title="Remove ' + fmt.esc(opt.label) + '">' +
            '<i class="bi bi-x-circle-fill"></i>' +
          '</button>' +
        '</span>';
      }).join('<i class="bi bi-chevron-right text-muted fs-12 mx-1"></i>');
    }

    function buildAvailableCardsHtml(query) {
      var q = (query || '').trim().toLowerCase();
      var matches = STAGE_OPTIONS.filter(function (opt) {
        if (!q) return true;
        return opt.key.toLowerCase().indexOf(q) >= 0 ||
               opt.label.toLowerCase().indexOf(q) >= 0 ||
               (opt.fullTitle && opt.fullTitle.toLowerCase().indexOf(q) >= 0) ||
               (opt.desc && opt.desc.toLowerCase().indexOf(q) >= 0);
      });

      if (!matches.length) {
        return '<div class="col-12">' +
          '<div class="p-3 text-center text-muted fs-13 bg-light rounded-3 border border-dashed">' +
            '<i class="bi bi-search me-1"></i> No examination stages found matching "<strong>' + fmt.esc(query) + '</strong>". ' +
            '<button type="button" class="btn btn-sm btn-link text-decoration-none p-0 ms-1" id="btn-clear-search">Clear filter</button>' +
          '</div>' +
        '</div>';
      }

      return matches.map(function (opt) {
        var isSel = selectedStages.indexOf(opt.key) >= 0;
        var selIndex = isSel ? selectedStages.indexOf(opt.key) + 1 : null;
        return '<div class="col-md-6 col-lg-4">' +
          '<div class="stage-select-card ' + (isSel ? 'is-selected' : '') + '" data-stage-toggle="' + opt.key + '">' +
            '<div class="card-head">' +
              '<div class="d-flex align-items-center gap-2">' +
                '<h6 class="card-title">' + fmt.esc(opt.label) + '</h6>' +
                (isSel ? '<span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size: 10px;">Stage ' + selIndex + '</span>' : '') +
              '</div>' +
              '<div class="stage-card-action">' +
                (isSel
                  ? '<i class="bi bi-check-circle-fill text-success fs-5"></i>'
                  : '<i class="bi bi-plus-circle text-muted fs-5"></i>') +
              '</div>' +
            '</div>' +
            '<div class="card-desc">' + fmt.esc(opt.desc || opt.fullTitle) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
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
              '<div class="text-muted" style="font-size: 12.5px;">Create a new job posting to attract candidates.</div>' +
            '</div>' +
          '</div>' +
          '<button class="btn btn-outline-secondary btn-back-posting" id="btn-back">' +
            '<i class="bi bi-arrow-left me-1"></i> Back' +
          '</button>' +
        '</div>' +

        '<!-- Stepper / Wizard -->' +
        '<div class="posting-wizard-card mb-4">' +
          '<div class="wizard-steps-container">' +
            '<div class="wizard-step is-active">' +
              '<span class="step-num-circle">1</span>' +
              '<span class="step-title">Basic Information</span>' +
            '</div>' +
            '<div class="wizard-step-line"></div>' +
            '<div class="wizard-step is-inactive">' +
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

        '<!-- Section 1: Circular -->' +
        '<div class="card card-posting-section mb-4">' +
          '<div class="card-posting-head">' +
            '<i class="bi bi-file-earmark-text"></i>' +
            '<span>Circular</span>' +
          '</div>' +
          '<div class="card-posting-body">' +
            '<div class="row g-3">' +
              '<div class="col-md-6">' +
                '<label class="form-label fw-medium text-dark" style="font-size: 13px;">Circular title <span class="text-danger">*</span></label>' +
                '<input type="text" class="form-control" id="f-title" value="Recruitment of Officer (IT) - ' + y + '" placeholder="e.g. Recruitment of Officer (IT) - ' + y + '">' +
              '</div>' +
              '<div class="col-md-6">' +
                '<label class="form-label fw-medium text-dark" style="font-size: 13px;">Circular no. <span class="text-danger">*</span></label>' +
                '<input type="text" class="form-control font-monospace" id="f-code" value="HRD/REC/' + y + '/04" placeholder="e.g. HRD/REC/' + y + '/04">' +
              '</div>' +
              '<div class="col-md-6">' +
                '<label class="form-label fw-medium text-dark" style="font-size: 13px;">Post <span class="text-danger">*</span></label>' +
                '<input type="text" class="form-control" id="f-post" value="Officer (IT)" placeholder="e.g. Officer (IT)">' +
              '</div>' +
              '<div class="col-md-6">' +
                '<label class="form-label fw-medium text-dark" style="font-size: 13px;">Vacancies <span class="text-danger">*</span></label>' +
                '<input type="number" class="form-control" id="f-vac" value="5" min="1">' +
              '</div>' +
              '<div class="col-md-4">' +
                '<label class="form-label fw-medium text-dark" style="font-size: 13px;">Application opens <span class="text-danger">*</span></label>' +
                '<div class="input-group">' +
                  '<input type="text" class="form-control" id="f-start" value="17-09-2026">' +
                  '<span class="input-group-text bg-white text-muted"><i class="bi bi-calendar3"></i></span>' +
                '</div>' +
              '</div>' +
              '<div class="col-md-4">' +
                '<label class="form-label fw-medium text-dark" style="font-size: 13px;">Application closes <span class="text-danger">*</span></label>' +
                '<div class="input-group">' +
                  '<input type="text" class="form-control" id="f-end" value="17-10-2026">' +
                  '<span class="input-group-text bg-white text-muted"><i class="bi bi-calendar3"></i></span>' +
                '</div>' +
              '</div>' +
              '<div class="col-md-4">' +
                '<label class="form-label fw-medium text-dark" style="font-size: 13px;">Closing time <span class="text-danger">*</span></label>' +
                '<input type="text" class="form-control" id="f-endtime" value="05:00 PM">' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- Section 2: Starter eligibility rules -->' +
        '<div class="card card-posting-section mb-4">' +
          '<div class="card-posting-head">' +
            '<i class="bi bi-shield-check"></i>' +
            '<span>Starter eligibility rules</span>' +
          '</div>' +
          '<div class="card-posting-body">' +
            '<div class="row g-3">' +
              '<div class="col-md-6">' +
                '<label class="form-label fw-medium text-dark" style="font-size: 13px;">Minimum age <span class="text-danger">*</span></label>' +
                '<input type="number" class="form-control" id="f-minage" value="21" min="14" max="70">' +
              '</div>' +
              '<div class="col-md-6">' +
                '<label class="form-label fw-medium text-dark" style="font-size: 13px;">Maximum age <span class="text-danger">*</span></label>' +
                '<input type="number" class="form-control" id="f-maxage" value="30" min="14" max="70">' +
              '</div>' +
              '<div class="col-12">' +
                '<label class="form-label fw-medium text-dark" style="font-size: 13px;">Minimum degree level <span class="text-danger">*</span></label>' +
                '<select class="form-select" id="f-degree">' +
                  '<option value="SSC">SSC</option>' +
                  '<option value="HSC">HSC</option>' +
                  '<option value="Bachelor" selected>Bachelor</option>' +
                  '<option value="Master">Master</option>' +
                '</select>' +
              '</div>' +
            '</div>' +
            '<div class="text-muted mt-2" style="font-size: 12px; line-height: 1.5;">' +
              'These create the first few rules. Add experience, subject and grade rules &mdash; or edit these &mdash; from Eligibility Rules in the circular workspace.' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- Section 3: Examination stages -->' +
        '<div class="card card-posting-section mb-4">' +
          '<div class="card-posting-head d-flex align-items-center justify-content-between flex-wrap gap-1">' +
            '<div class="d-flex align-items-center gap-2">' +
              '<i class="bi bi-diagram-3"></i>' +
              '<span>Examination stages</span>' +
            '</div>' +
            '<span class="fs-12 fw-normal text-muted">Search &amp; select multiple stages</span>' +
          '</div>' +
          '<div class="card-posting-body">' +
            '<!-- Search input -->' +
            '<div class="stage-search-box mb-3">' +
              '<div class="input-group">' +
                '<span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>' +
                '<input type="text" class="form-control border-start-0 ps-0" id="stage-search-input" placeholder="Search examination stages (e.g. MCQ, Written, Viva, Practical)..." autocomplete="off">' +
                '<button class="btn btn-outline-secondary border-start-0 d-none" type="button" id="stage-search-clear" title="Clear search"><i class="bi bi-x-lg"></i></button>' +
              '</div>' +
            '</div>' +

            '<!-- Selected stages sequence -->' +
            '<div class="selected-stages-section mb-3">' +
              '<div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-1">' +
                '<span class="fw-semibold text-dark fs-13 d-flex align-items-center gap-1">' +
                  '<i class="bi bi-check2-circle text-success"></i> Selected Examination Sequence (<span id="selected-count">' + selectedStages.length + '</span>)' +
                '</span>' +
                '<span class="text-muted fs-12">Applicants proceed through stages in this order</span>' +
              '</div>' +
              '<div class="stage-chips-wrap d-flex align-items-center flex-wrap gap-2" id="selected-chips-container">' +
                buildSelectedChipsHtml() +
              '</div>' +
            '</div>' +

            '<!-- Available stages cards -->' +
            '<div class="available-stages-section">' +
              '<div class="d-flex align-items-center justify-content-between mb-2">' +
                '<span class="text-muted fs-12 fw-medium">Available stages (click to add or remove):</span>' +
              '</div>' +
              '<div class="row g-2" id="stages-grid-container">' +
                buildAvailableCardsHtml('') +
              '</div>' +
            '</div>' +

            '<div class="text-muted mt-3" style="font-size: 12px; line-height: 1.5;">' +
              '<i class="bi bi-info-circle me-1"></i> Selected stages define the applicant progression path through examination, scrutiny, and viva. At least one stage must be selected.' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- Save & Next action -->' +
        '<div class="d-flex justify-content-end mb-5">' +
          '<button class="btn btn-save-next" id="btn-save-next">' +
            'Save & Next' +
          '</button>' +
        '</div>' +

      '</div>';

    view.innerHTML = html;

    function updateStageViews() {
      var chipsWrap = view.querySelector('#selected-chips-container');
      var gridWrap = view.querySelector('#stages-grid-container');
      var countEl = view.querySelector('#selected-count');
      var clearBtn = view.querySelector('#stage-search-clear');
      var searchInput = view.querySelector('#stage-search-input');

      if (chipsWrap) chipsWrap.innerHTML = buildSelectedChipsHtml();
      if (gridWrap) gridWrap.innerHTML = buildAvailableCardsHtml(stageSearchQuery);
      if (countEl) countEl.textContent = selectedStages.length;

      if (clearBtn && searchInput) {
        if (searchInput.value.trim()) {
          clearBtn.classList.remove('d-none');
        } else {
          clearBtn.classList.add('d-none');
        }
      }

      // Bind remove buttons on chips
      if (chipsWrap) {
        chipsWrap.querySelectorAll('[data-remove-stage]').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var key = btn.dataset.removeStage;
            toggleStage(key);
          });
        });
      }

      // Bind cards in grid
      if (gridWrap) {
        gridWrap.querySelectorAll('[data-stage-toggle]').forEach(function (card) {
          card.addEventListener('click', function () {
            var key = card.dataset.stageToggle;
            toggleStage(key);
          });
        });
        var clearLink = gridWrap.querySelector('#btn-clear-search');
        if (clearLink && searchInput) {
          clearLink.addEventListener('click', function () {
            searchInput.value = '';
            stageSearchQuery = '';
            updateStageViews();
            searchInput.focus();
          });
        }
      }
    }

    function toggleStage(key) {
      var pos = selectedStages.indexOf(key);
      if (pos >= 0) {
        if (selectedStages.length === 1) {
          ui.toast('At least one examination stage must remain selected', 'warning');
          return;
        }
        selectedStages.splice(pos, 1);
      } else {
        selectedStages.push(key);
        // Keep chronological order: MCQ, WRITTEN, VIVA, etc.
        selectedStages.sort(function (a, b) {
          var ia = STAGE_OPTIONS.findIndex(function (x) { return x.key === a; });
          var ib = STAGE_OPTIONS.findIndex(function (x) { return x.key === b; });
          return ia - ib;
        });
      }
      updateStageViews();
    }

    var searchInput = view.querySelector('#stage-search-input');
    var clearBtn = view.querySelector('#stage-search-clear');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        stageSearchQuery = searchInput.value;
        updateStageViews();
      });
    }
    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        stageSearchQuery = '';
        updateStageViews();
        searchInput.focus();
      });
    }

    updateStageViews();

    view.querySelector('#btn-back').addEventListener('click', function () {
      ERec.router.go('#/circulars');
    });

    view.querySelector('#btn-save-next').addEventListener('click', function () {
      var title = (view.querySelector('#f-title').value || '').trim();
      var code = (view.querySelector('#f-code').value || '').trim();
      var post = (view.querySelector('#f-post').value || '').trim();
      var vac = parseInt(view.querySelector('#f-vac').value, 10) || 1;
      var rawStart = (view.querySelector('#f-start').value || '').trim();
      var rawEnd = (view.querySelector('#f-end').value || '').trim();
      var rawEndTime = (view.querySelector('#f-endtime').value || '').trim();
      var minAge = parseInt(view.querySelector('#f-minage').value, 10) || 21;
      var maxAge = parseInt(view.querySelector('#f-maxage').value, 10) || 30;
      var degree = view.querySelector('#f-degree').value || 'Bachelor';

      if (!title) { ui.toast('Please enter circular title', 'warning'); return; }
      if (!post) { ui.toast('Please enter post name', 'warning'); return; }
      if (!code) { ui.toast('Please enter circular no.', 'warning'); return; }
      if (maxAge < minAge) { ui.toast('Maximum age cannot be lower than minimum age', 'warning'); return; }
      if (!selectedStages.length) {
        ui.toast('Please select at least one examination stage (MCQ, Written, or Viva voce)', 'warning');
        return;
      }

      function parseDateInput(str) {
        if (!str) return fmt.isoDate();
        if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
          var p = str.split('-');
          return p[2] + '-' + p[1] + '-' + p[0];
        }
        return str;
      }

      function parseTimeInput(str) {
        if (!str) return '17:00';
        if (/(\d{1,2}):(\d{2})\s*(AM|PM)/i.test(str)) {
          var m = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          var hh = parseInt(m[1], 10);
          var mm = m[2];
          var ampm = m[3].toUpperCase();
          if (ampm === 'PM' && hh < 12) hh += 12;
          if (ampm === 'AM' && hh === 12) hh = 0;
          return (hh < 10 ? '0' + hh : hh) + ':' + mm;
        }
        return str;
      }

      var start = parseDateInput(rawStart);
      var end = parseDateInput(rawEnd);
      var endT = parseTimeInput(rawEndTime);

      var id = fmt.uid('C');
      store.insert('circulars', {
        id: id,
        code: code,
        title: title,
        post: post,
        vacancies: vac,
        applyStart: start,
        applyEnd: end,
        applyEndTime: endT,
        eligibilityRules: [
          Object.assign(ERec.seed.blankRule('AGE'), {
            name: 'Age Limit', minAge: minAge, maxAge: maxAge,
            failureMessage: 'Applicant must be between ' + minAge + ' and ' + maxAge + ' years old.'
          }),
          Object.assign(ERec.seed.blankRule('DEGREE_LEVEL'), {
            name: 'Required Degree Level',
            degreeLevel: degree, mandatory: true,
            failureMessage: 'Applicant must hold at least a ' + degree + ' degree.'
          })
        ],
        status: 'ACTIVE',
        steps: {}
      });

      selectedStages.forEach(function (type, i) {
        var opt = STAGE_OPTIONS.find(function (x) { return x.key === type; });
        var stageTitle = opt ? opt.label : pipe.typeLabel(type);
        store.insert('stages', {
          id: id + '-S' + (i + 1),
          circularId: id,
          type: type,
          seq: i + 1,
          name: (type === 'VIVA' ? 'Viva voce' : stageTitle) + ' Examination',
          requireApplicantApproval: true,
          requireVenueApproval: (i === 0 && selectedStages.length > 1),
          applicantApprovers: ['u-gm', 'u-dmd', 'u-md'],
          venueApprovers: ['u-gm'],
          instructions: '',
          examDate: null,
          fullMarks: type === 'VIVA' ? 50 : 100,
          passMarks: type === 'VIVA' ? 25 : 50,
          status: 'NOT_STARTED',
          steps: {}
        });
      });

      ERec.seed.makeApplicants({
        circularId: id,
        count: DEMO_APPLICANTS,
        prefix: code.replace(/\W+/g, '').slice(-6).toUpperCase() || 'APP',
        appliedAt: start
      }).forEach(function (a) { store.insert('applicants', a); });

      store.audit('CREATE_CIRCULAR', 'circular', id, 'Circular ' + post + ' (' + code + ') created with stages: ' + selectedStages.map(function (s) { return s === 'VIVA' ? 'Viva voce' : pipe.typeLabel(s); }).join(', '));
      ERec.app.renderNav();
      ui.toast('Circular created with ' + fmt.plural(DEMO_APPLICANTS, 'applicant'));
      ERec.router.go('#/circular/' + id);
    });
  }

  ERec.pages.newcircularBasicInfo = { render: render };
})(window);
