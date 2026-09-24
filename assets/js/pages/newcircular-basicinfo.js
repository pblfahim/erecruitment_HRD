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

    function buildSelectedChipsHtml() {
      if (!selectedStages.length) {
        return '<span class="text-danger fs-12"><i class="bi bi-exclamation-circle me-1"></i>No stages selected. Please select at least one stage below.</span>';
      }
      return selectedStages.map(function (key, idx) {
        var opt = STAGE_OPTIONS.find(function (x) { return x.key === key; }) || { key: key, label: key };
        return '<span class="exam-stage-chip is-selected" data-stage="' + key + '">' +
          '<i class="bi bi-check2 text-success fw-bold"></i> ' +
          '<span class="stage-num">' + (idx + 1) + '. </span>' +
          fmt.esc(opt.label) +
          '<button type="button" class="btn-remove-stage" data-remove-stage="' + key + '" title="Remove ' + fmt.esc(opt.label) + '">' +
            '<i class="bi bi-x-circle-fill"></i>' +
          '</button>' +
        '</span>';
      }).join('<i class="bi bi-chevron-right text-muted mx-1" style="font-size: 11px;"></i>');
    }

    function buildAvailableCardsHtml() {
      return STAGE_OPTIONS.map(function (opt) {
        var isSel = selectedStages.indexOf(opt.key) >= 0;
        var selIndex = isSel ? selectedStages.indexOf(opt.key) + 1 : null;
        var badgeText = isSel ? 'Stage ' + selIndex : 'Stage 3';
        return '<div class="col-md-6 col-lg-3">' +
          '<div class="stage-select-card ' + (isSel ? 'is-selected' : '') + '" data-stage-toggle="' + opt.key + '">' +
            '<div class="card-head">' +
              '<div class="d-flex align-items-center gap-2">' +
                '<h6 class="card-title">' + fmt.esc(opt.label) + '</h6>' +
                '<span class="badge stage-pill-badge">' + badgeText + '</span>' +
              '</div>' +
              '<div class="stage-card-action">' +
                (isSel
                  ? '<i class="bi bi-check-circle-fill" style="color: #0ebe7f; font-size: 16px;"></i>'
                  : '<i class="bi bi-plus-circle text-muted" style="font-size: 16px;"></i>') +
              '</div>' +
            '</div>' +
            '<div class="card-desc">' + fmt.esc(opt.desc || opt.fullTitle) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    var html =
      '<div class="create-job-posting-container">' +
        ui.postingWizard(1) +

        '<!-- Section 1: Circular -->' +
        '<div class="card card-posting-section mb-4">' +
          '<div class="card-posting-head">' +
            '<i class="bi bi-file-earmark-text"></i>' +
            '<span>Circular</span>' +
          '</div>' +
          '<div class="card-posting-body">' +
            '<div class="row g-3">' +
              '<div class="col-md-6">' +
                '<label class="form-label">Circular title <span class="text-danger">*</span></label>' +
                '<input type="text" class="form-control" id="f-title" value="Recruitment of Officer (IT) - ' + y + '" placeholder="e.g. Recruitment of Officer (IT) - ' + y + '">' +
              '</div>' +
              '<div class="col-md-6">' +
                '<label class="form-label">Circular no. <span class="text-danger">*</span></label>' +
                '<input type="text" class="form-control" id="f-code" value="HRD/REC/' + y + '/04" placeholder="e.g. HRD/REC/' + y + '/04">' +
              '</div>' +
              '<div class="col-md-6">' +
                '<label class="form-label">Post <span class="text-danger">*</span></label>' +
                '<input type="text" class="form-control" id="f-post" value="Officer (IT)" placeholder="e.g. Officer (IT)">' +
              '</div>' +
              '<div class="col-md-6">' +
                '<label class="form-label">Vacancies <span class="text-danger">*</span></label>' +
                '<input type="number" class="form-control" id="f-vac" value="5" min="1">' +
              '</div>' +
              '<div class="col-md-4">' +
                '<label class="form-label" for="f-start">Application opens <span class="text-danger">*</span></label>' +
                '<div class="input-group">' +
                  '<input type="date" class="form-control" id="f-start" value="2026-09-17">' +
                  '<button type="button" class="input-group-text bg-white text-muted btn-date-picker" id="btn-picker-start" title="Choose opening date" tabindex="-1">' +
                    '<i class="bi bi-calendar3"></i>' +
                  '</button>' +
                '</div>' +
              '</div>' +
              '<div class="col-md-4">' +
                '<label class="form-label" for="f-end">Application closes <span class="text-danger">*</span></label>' +
                '<div class="input-group">' +
                  '<input type="date" class="form-control" id="f-end" value="2026-10-17" min="2026-09-17">' +
                  '<button type="button" class="input-group-text bg-white text-muted btn-date-picker" id="btn-picker-end" title="Choose closing date" tabindex="-1">' +
                    '<i class="bi bi-calendar3"></i>' +
                  '</button>' +
                '</div>' +
              '</div>' +
              '<div class="col-md-4">' +
                '<label class="form-label" for="f-endtime">Closing time <span class="text-danger">*</span></label>' +
                '<div class="input-group">' +
                  '<input type="time" class="form-control" id="f-endtime" value="17:00">' +
                  '<button type="button" class="input-group-text bg-white text-muted btn-date-picker" id="btn-picker-endtime" title="Choose closing time" tabindex="-1">' +
                    '<i class="bi bi-clock"></i>' +
                  '</button>' +
                '</div>' +
              '</div>' +
              '<div class="col-12 mt-2">' +
                '<div class="d-flex align-items-center gap-2 p-2 px-3 rounded-2 fs-12 bg-light text-muted border" id="date-window-summary">' +
                  '<i class="bi bi-calendar-range text-primary fs-14"></i>' +
                  '<span id="date-window-text">Application window: 30 days &bull; Closes 17 Oct 2026 at 05:00 PM BST</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- Section 2: Examination stages -->' +
        '<div class="card card-posting-section mb-4">' +
          '<div class="card-posting-head d-flex align-items-center justify-content-between flex-wrap gap-1">' +
            '<div class="d-flex align-items-center gap-2">' +
              '<i class="bi bi-diagram-2"></i>' +
              '<span>Examination stages</span>' +
            '</div>' +
            '<span class="fs-12 fw-normal text-muted">Select multiple stages</span>' +
          '</div>' +
          '<div class="card-posting-body">' +
            '<!-- Selected stages sequence -->' +
            '<div class="selected-stages-section mb-3">' +
              '<div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-1">' +
                '<span class="fw-semibold text-dark fs-13 d-flex align-items-center gap-2">' +
                  '<i class="bi bi-check-circle" style="color: #0ebe7f; font-size: 15px;"></i>' +
                  'Selected Examination Sequence ( <span id="selected-count">' + selectedStages.length + '</span> )' +
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
                '<span class="text-muted fw-medium" style="font-size: 12px;">Available stages (click to add or remove):</span>' +
              '</div>' +
              '<div class="row g-3" id="stages-grid-container">' +
                buildAvailableCardsHtml() +
              '</div>' +
            '</div>' +

            '<div class="text-muted mt-3 d-flex align-items-center gap-1" style="font-size: 11.5px; line-height: 1.5;">' +
              '<i class="bi bi-info-circle text-secondary"></i> Selected stages define the applicant progression path through examination, scrutiny, and viva. At least one stage must be selected.' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- Bottom Actions Row -->' +
        '<div class="circular-action-bar d-flex align-items-center justify-content-between flex-wrap gap-2">' +
          '<button type="button" class="btn btn-cancel-posting" id="btn-cancel">' +
            '<i class="bi bi-x-circle me-1"></i> Cancel' +
          '</button>' +
          '<div class="d-flex align-items-center gap-2">' +
            '<button type="button" class="btn btn-save-next" id="btn-save-next">' +
              'Save &amp; Continue <i class="bi bi-arrow-right ms-1"></i>' +
            '</button>' +
          '</div>' +
        '</div>' +

      '</div>';

    view.innerHTML = html;
    ui.bindPostingWizard(view);

    function updateStageViews() {
      var chipsWrap = view.querySelector('#selected-chips-container');
      var gridWrap = view.querySelector('#stages-grid-container');
      var countEl = view.querySelector('#selected-count');

      if (chipsWrap) chipsWrap.innerHTML = buildSelectedChipsHtml();
      if (gridWrap) gridWrap.innerHTML = buildAvailableCardsHtml();
      if (countEl) countEl.textContent = selectedStages.length;

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

    updateStageViews();

    // Functional Application opens / closes / time handlers
    var startInput = view.querySelector('#f-start');
    var endInput = view.querySelector('#f-end');
    var timeInput = view.querySelector('#f-endtime');
    var btnPickerStart = view.querySelector('#btn-picker-start');
    var btnPickerEnd = view.querySelector('#btn-picker-end');
    var btnPickerTime = view.querySelector('#btn-picker-endtime');

    function triggerPicker(el) {
      if (!el) return;
      if (typeof el.showPicker === 'function') {
        try {
          el.showPicker();
          return;
        } catch (e) {}
      }
      el.focus();
    }

    if (btnPickerStart) {
      btnPickerStart.addEventListener('click', function () { triggerPicker(startInput); });
    }
    if (btnPickerEnd) {
      btnPickerEnd.addEventListener('click', function () { triggerPicker(endInput); });
    }
    if (btnPickerTime) {
      btnPickerTime.addEventListener('click', function () { triggerPicker(timeInput); });
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

    function updateDateWindowSummary() {
      var summaryEl = view.querySelector('#date-window-summary');
      var textEl = view.querySelector('#date-window-text');
      if (!startInput || !endInput || !timeInput || !textEl) return;

      var sVal = (startInput.value || '').trim();
      var eVal = (endInput.value || '').trim();
      var tVal = (timeInput.value || '').trim();

      if (!sVal || !eVal) {
        if (summaryEl) summaryEl.className = 'd-flex align-items-center gap-2 p-2 px-3 rounded-2 fs-12 bg-warning-subtle text-dark border border-warning-subtle';
        textEl.innerHTML = '<i class="bi bi-exclamation-circle text-warning me-1"></i>Please specify both application opening and closing dates.';
        return;
      }

      var dStart = new Date(sVal + 'T00:00:00');
      var dEnd = new Date(eVal + 'T00:00:00');

      if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
        if (summaryEl) summaryEl.className = 'd-flex align-items-center gap-2 p-2 px-3 rounded-2 fs-12 bg-warning-subtle text-dark border border-warning-subtle';
        textEl.textContent = 'Please enter valid dates.';
        return;
      }

      var diffDays = Math.round((dEnd.getTime() - dStart.getTime()) / 86400000);

      if (diffDays < 0) {
        if (summaryEl) summaryEl.className = 'd-flex align-items-center gap-2 p-2 px-3 rounded-2 fs-12 bg-danger-subtle text-danger border border-danger-subtle';
        textEl.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-danger me-1"></i><strong>Invalid dates:</strong> Closing date cannot be earlier than opening date.';
        return;
      }

      if (summaryEl) summaryEl.className = 'd-flex align-items-center gap-2 p-2 px-3 rounded-2 fs-12 bg-light text-muted border';
      var daysStr = diffDays === 0 ? 'Same day deadline' : (diffDays === 1 ? '1 day window' : diffDays + ' days window');
      var timeFormatted = tVal ? (fmt.time12(tVal) || tVal) : '05:00 PM';
      textEl.innerHTML = '<span class="fw-semibold text-dark"><i class="bi bi-calendar-check text-success me-1"></i>Application window: ' + daysStr + '</span>' +
        ' <span class="mx-1">&bull;</span> ' + fmt.date(sVal) + ' to ' + fmt.date(eVal) +
        ' <span class="mx-1">&bull;</span> Closes at <span class="fw-semibold text-danger">' + timeFormatted + ' BST</span>';
    }

    if (startInput) {
      startInput.addEventListener('change', function () {
        if (endInput) {
          endInput.min = startInput.value;
          if (endInput.value && endInput.value < startInput.value) {
            endInput.value = startInput.value;
          }
        }
        updateDateWindowSummary();
      });
      startInput.addEventListener('input', updateDateWindowSummary);
    }

    if (endInput) {
      endInput.addEventListener('change', updateDateWindowSummary);
      endInput.addEventListener('input', updateDateWindowSummary);
    }

    if (timeInput) {
      timeInput.addEventListener('change', updateDateWindowSummary);
      timeInput.addEventListener('input', updateDateWindowSummary);
    }

    updateDateWindowSummary();

    var backBtn = view.querySelector('#btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        ERec.router.go('#/circulars');
      });
    }

    view.querySelector('#btn-cancel').addEventListener('click', function () {
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

      if (!title) { ui.toast('Please enter circular title', 'warning'); return; }
      if (!code) { ui.toast('Please enter circular no.', 'warning'); return; }
      if (!post) { ui.toast('Please enter post name', 'warning'); return; }
      if (!rawStart) { ui.toast('Please select application opening date', 'warning'); return; }
      if (!rawEnd) { ui.toast('Please select application closing date', 'warning'); return; }
      if (!rawEndTime) { ui.toast('Please select closing time', 'warning'); return; }

      var start = parseDateInput(rawStart);
      var end = parseDateInput(rawEnd);
      var endT = parseTimeInput(rawEndTime);

      if (end < start) {
        ui.toast('Application closing date cannot be earlier than opening date', 'warning');
        return;
      }
      if (!selectedStages.length) {
        ui.toast('Please select at least one examination stage (MCQ, Written, or Viva voce)', 'warning');
        return;
      }

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
        eligibilityRules: [],
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
      ui.toast('Basic information saved. Now configure eligibility rules.');
      ERec.router.go('#/circulars/new-eligibility/' + id);
    });
  }

  ERec.pages.newcircularBasicInfo = { render: render };
})(window);
