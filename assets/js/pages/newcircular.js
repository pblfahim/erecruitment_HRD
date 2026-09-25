/* Create Job Posting - Step 4: Job Preview.
   Displays the formal Pubali Bank Circular Notice Document with Edit options. */
(function (global) {
  'use strict';

  var ERec = global.ERec = global.ERec || {};
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  function render(view, params) {
    var cid = (params && params.cid) || '';
    var c = store.circular(cid);
    if (!c) {
      var allCircs = store.circulars();
      if (allCircs.length) {
        c = allCircs[allCircs.length - 1];
      } else {
        ui.toast('Circular not found', 'danger');
        ERec.router.go('#/circulars');
        return;
      }
    }

    ERec.router.setCrumbs([
      { label: 'Job Circulars', href: '#/circulars' },
      { label: 'Create Job Posting', href: '#/circulars/new' },
      { label: 'Job Preview' }
    ]);

    function getStages() {
      return store.stagesOf(c.id);
    }

    function getRules() {
      return c.eligibilityRules || [];
    }

    function buildNoticeDocumentView(stages, rules) {
      var minAge = 21, maxAge = 30;
      var ageRule = rules.find(function (r) { return r.type === 'AGE' && r.status !== 'INACTIVE'; });
      if (ageRule) {
        minAge = ageRule.minAge || minAge;
        maxAge = ageRule.maxAge || maxAge;
      } else if (c.maxAge) {
        maxAge = c.maxAge;
      }

      var degRule = rules.find(function (r) { return r.type === 'DEGREE_LEVEL' && r.status !== 'INACTIVE'; });
      var degreeStr = (degRule && degRule.degreeLevel) ? degRule.degreeLevel : (c.minDegreeLevel || 'Bachelor');

      var deadlineTime = c.applyEndTime ? (/AM|PM/i.test(c.applyEndTime) ? c.applyEndTime : (fmt.time12(c.applyEndTime) || c.applyEndTime)) : '05:00 PM';

      return '<div class="preview-notice-paper p-4 p-md-5 bg-white border rounded shadow-sm mb-4" id="circular-notice-document">' +
        '<!-- Document Header with Bank Logo -->' +
        '<div class="text-center pb-4 border-bottom mb-4 position-relative">' +
          '<div class="mb-2">' +
            '<img src="assets/images/pbplc.svg" alt="Pubali Bank PLC Logo" style="height: 48px; max-width: 240px;">' +
          '</div>' +
          '<h4 class="fw-bold text-dark text-uppercase mb-1" style="letter-spacing: 0.05em; font-size: 1.35rem;">Pubali Bank PLC</h4>' +
          '<div class="text-muted fs-13">Human Resources Division &middot; Head Office</div>' +
          '<div class="text-muted fs-12">26 Dilkusha Commercial Area, Dhaka-1000, Bangladesh</div>' +
          '<div class="mt-3 py-2 px-3 bg-light rounded d-inline-block border fs-13">' +
            '<strong>CAREER OPPORTUNITY &middot; RECRUITMENT NOTICE</strong>' +
          '</div>' +
        '</div>' +

        '<!-- Notice Metadata Row -->' +
        '<div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2 fs-13 text-muted">' +
          '<div><strong>Ref. No:</strong> <span class="mono fw-bold text-dark">' + fmt.esc(c.code) + '</span></div>' +
          '<div class="d-flex align-items-center gap-3">' +
            '<div><strong>Issue Date:</strong> ' + fmt.date(c.applyStart || new Date().toISOString()) + '</div>' +
            '<a href="#/circulars/new" class="btn btn-xs btn-outline-success d-print-none" id="btn-paper-edit" title="Edit this circular notice" style="font-size: 11.5px; padding: 2px 8px;">' +
              '<i class="bi bi-pencil me-1"></i>Edit' +
            '</a>' +
          '</div>' +
        '</div>' +

        '<!-- Notice Opening -->' +
        '<div class="notice-body fs-13 text-secondary lh-base mb-4">' +
          '<p>' +
            'Pubali Bank PLC, a premier and progressive leading private commercial bank in Bangladesh, invites applications from young, energetic, and goal-oriented Bangladeshi citizens possessing a proactive approach and a high standard of personal integrity for the following position:' +
          '</p>' +

          '<!-- Position Table -->' +
          '<div class="table-responsive my-3">' +
            '<table class="table table-bordered align-middle table-sm mb-0 fs-13">' +
              '<thead class="bg-light text-dark fw-bold">' +
                '<tr>' +
                  '<th>Name of Position</th>' +
                  '<th class="text-center">No. of Vacancies</th>' +
                  '<th>Minimum Educational Qualification</th>' +
                  '<th>Age Limit</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' +
                '<tr>' +
                  '<td class="fw-bold text-dark">' + fmt.esc(c.post) + '</td>' +
                  '<td class="text-center fw-bold text-success fs-14">' + c.vacancies + '</td>' +
                  '<td>' +
                    'Minimum <strong>' + fmt.esc(degreeStr) + '</strong> degree from any UGC recognized university with no third division/class in academic career.' +
                  '</td>' +
                  '<td>Between <strong>' + minAge + ' and ' + maxAge + ' years</strong> as on ' + fmt.date(c.applyEnd) + '.</td>' +
                '</tr>' +
              '</tbody>' +
            '</table>' +
          '</div>' +

          '<h6 class="fw-bold text-dark mt-4 mb-2 fs-14"><i class="bi bi-shield-check text-success me-1"></i>Key Eligibility Requirements:</h6>' +
          '<ul class="ps-3 mb-3 text-secondary">' +
            (rules.length
              ? rules.map(function (r) {
                  return '<li class="mb-1">' +
                    '<strong>' + fmt.esc(r.name || 'Criteria') + ':</strong> ' +
                    fmt.esc(ERec.seed && ERec.seed.describeRule ? ERec.seed.describeRule(r) : r.name) +
                    (r.mandatory !== false ? ' <span class="badge bg-light text-danger border fs-11">Mandatory</span>' : '') +
                  '</li>';
                }).join('')
              : '<li>Standard qualifications and background verification criteria apply.</li>') +
          '</ul>' +

          '<h6 class="fw-bold text-dark mt-4 mb-2 fs-14"><i class="bi bi-diagram-2 text-primary me-1"></i>Selection &amp; Examination Procedure:</h6>' +
          '<p class="mb-2">' +
            'Only screened and eligible candidates will be invited to appear in the examination. The recruitment process comprises the following progressive stages:' +
          '</p>' +
          '<div class="row g-2 mb-3">' +
            stages.map(function (s) {
              return '<div class="col-md-4">' +
                '<div class="p-2 border rounded bg-light">' +
                  '<div class="fw-bold text-dark fs-12">Stage ' + s.seq + ': ' + fmt.esc(s.name || pipe.typeLabel(s.type)) + '</div>' +
                  '<div class="fs-11 text-muted">Full Marks: ' + (s.fullMarks || 100) + ' &middot; Qualifying Pass Mark: ' + (s.passMarks || 50) + '</div>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>' +

          '<h6 class="fw-bold text-dark mt-4 mb-2 fs-14"><i class="bi bi-envelope-check text-success me-1"></i>Application Guidelines &amp; Submission:</h6>' +
          '<ol class="ps-3 text-secondary mb-3">' +
            '<li class="mb-1">Interested candidates must apply online through Pubali Bank Recruitment Portal: <strong>https://recruitment.pubalibankbd.com/</strong></li>' +
            '<li class="mb-1">Online application system opens on <strong>' + fmt.date(c.applyStart) + '</strong> and will close on <strong>' + fmt.date(c.applyEnd) + ' at ' + fmt.esc(deadlineTime) + ' BST</strong>.</li>' +
            '<li class="mb-1">Candidates must upload recently taken color photograph and scanned signature as per prescribed specifications.</li>' +
            '<li class="mb-1">Original documents, certificates, and National ID must be produced during the viva voce examination.</li>' +
            '<li class="mb-1">Pubali Bank PLC reserves the right to accept or reject any application without assigning any reason whatsoever.</li>' +
          '</ol>' +
        '</div>' +

        '<!-- Official Signatory Footing -->' +
        '<div class="d-flex justify-content-between align-items-end pt-5 mt-5 border-top text-center">' +
          '<div class="text-start fs-12 text-muted">' +
            '<div>Computer Generated Notice</div>' +
            '<div>Published via HRD e-Recruitment Portal</div>' +
          '</div>' +
          '<div style="min-width: 200px;">' +
            '<div class="fw-bold text-dark fs-13">General Manager</div>' +
            '<div class="fs-12 text-muted">Human Resources Division</div>' +
            '<div class="fs-12 text-muted">Pubali Bank PLC</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function buildViewHtml() {
      var stages = getStages();
      var rules = getRules();
      var noticeHtml = buildNoticeDocumentView(stages, rules);

      var toolbarHtml =
        '<div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2 preview-notice-toolbar" style="max-width: 960px; margin: 0 auto;">' +
          '<div class="d-flex align-items-center gap-2">' +
            '<span class="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1.5 fs-12 fw-semibold">' +
              '<i class="bi bi-file-earmark-text-fill me-1"></i>Formal Circular Notice View' +
            '</span>' +
            '<span class="text-muted fs-12 d-none d-sm-inline">Review the official recruitment announcement document before publication</span>' +
          '</div>' +
          '<div class="d-flex align-items-center gap-2">' +
            '<div class="btn-group">' +
              '<button type="button" class="btn btn-sm btn-outline-success bg-white" id="btn-edit-circular">' +
                '<i class="bi bi-pencil me-1"></i> Edit Circular' +
              '</button>' +
              '<button type="button" class="btn btn-sm btn-outline-success bg-white dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-expanded="false">' +
                '<span class="visually-hidden">Toggle Dropdown</span>' +
              '</button>' +
              '<ul class="dropdown-menu dropdown-menu-end shadow-sm">' +
                '<li><a class="dropdown-item fs-13" href="#/circulars/new" id="link-edit-step1"><i class="bi bi-file-earmark-text me-2 text-success"></i>Edit Basic Information (Step 1)</a></li>' +
                '<li><a class="dropdown-item fs-13" href="#/circulars/new-eligibility/' + c.id + '" id="link-edit-step2"><i class="bi bi-shield-check me-2 text-success"></i>Edit Eligibility Rules (Step 2)</a></li>' +
                '<li><a class="dropdown-item fs-13" href="#/circulars/new-approval/' + c.id + '" id="link-edit-step3"><i class="bi bi-shield-lock me-2 text-success"></i>Edit Approval Channels (Step 3)</a></li>' +
              '</ul>' +
            '</div>' +
            '<button type="button" class="btn btn-sm btn-outline-secondary bg-white" id="btn-quick-print" title="Print Circular Notice">' +
              '<i class="bi bi-printer me-1"></i> Print Notice' +
            '</button>' +
          '</div>' +
        '</div>';

      return '<div class="create-job-posting-container">' +
        ui.postingWizard(4, c.id) +

        toolbarHtml +
        noticeHtml +

        '<!-- Bottom Actions Row -->' +
        '<div class="circular-action-bar d-flex align-items-center justify-content-between flex-wrap gap-2">' +
          '<button type="button" class="btn btn-outline-secondary btn-cancel-posting" id="btn-prev-step">' +
            '<i class="bi bi-arrow-left me-1"></i> Previous (Approval Channel)' +
          '</button>' +
          '<div class="d-flex align-items-center gap-2 flex-wrap">' +
            '<button type="button" class="btn btn-outline-success" id="btn-bottom-edit">' +
              '<i class="bi bi-pencil me-1"></i> Edit Circular' +
            '</button>' +
            '<button type="button" class="btn btn-outline-secondary" id="btn-print-action">' +
              '<i class="bi bi-printer me-1"></i> Print / PDF' +
            '</button>' +
            '<button type="button" class="btn btn-outline-success" id="btn-save-draft">' +
              '<i class="bi bi-save me-1"></i> Save as Draft' +
            '</button>' +
            '<button type="button" class="btn btn-save-next" id="btn-publish-posting">' +
              '<i class="bi bi-check2-circle me-1"></i> Publish Circular' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function bindEvents() {
      // Back to Circulars
      var backBtn = view.querySelector('#btn-back');
      if (backBtn) {
        backBtn.addEventListener('click', function () {
          ERec.router.go('#/circulars');
        });
      }

      // Edit Circular actions
      var editBtn = view.querySelector('#btn-edit-circular');
      if (editBtn) {
        editBtn.addEventListener('click', function () {
          ERec.router.go('#/circulars/new');
        });
      }

      var bottomEditBtn = view.querySelector('#btn-bottom-edit');
      if (bottomEditBtn) {
        bottomEditBtn.addEventListener('click', function () {
          ERec.router.go('#/circulars/new');
        });
      }

      var paperEditBtn = view.querySelector('#btn-paper-edit');
      if (paperEditBtn) {
        paperEditBtn.addEventListener('click', function (e) {
          e.preventDefault();
          ERec.router.go('#/circulars/new');
        });
      }

      // Edit specific steps from dropdown
      var editStep1 = view.querySelector('#link-edit-step1');
      if (editStep1) {
        editStep1.addEventListener('click', function (e) {
          e.preventDefault();
          ERec.router.go('#/circulars/new');
        });
      }

      var editStep2 = view.querySelector('#link-edit-step2');
      if (editStep2) {
        editStep2.addEventListener('click', function (e) {
          e.preventDefault();
          ERec.router.go('#/circulars/new-eligibility/' + c.id);
        });
      }

      var editStep3 = view.querySelector('#link-edit-step3');
      if (editStep3) {
        editStep3.addEventListener('click', function (e) {
          e.preventDefault();
          ERec.router.go('#/circulars/new-approval/' + c.id);
        });
      }

      // Previous Step
      var prevBtn = view.querySelector('#btn-prev-step');
      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          ERec.router.go('#/circulars/new-approval/' + c.id);
        });
      }

      // Print Actions
      var quickPrint = view.querySelector('#btn-quick-print');
      if (quickPrint) {
        quickPrint.addEventListener('click', function () {
          window.print();
        });
      }

      var printAction = view.querySelector('#btn-print-action');
      if (printAction) {
        printAction.addEventListener('click', function () {
          window.print();
        });
      }

      // Save as Draft
      var saveDraftBtn = view.querySelector('#btn-save-draft');
      if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', function () {
          store.update('circulars', c.id, { status: 'DRAFT' });
          store.audit('DRAFT_CIRCULAR', 'circular', c.id, 'Saved circular ' + c.code + ' as draft configuration');
          if (ERec.app && ERec.app.renderNav) {
            ERec.app.renderNav();
          }
          ui.toast('Circular ' + c.code + ' saved as draft', 'info');
          ERec.router.go('#/circulars');
        });
      }

      // Publish & Complete Circular
      var publishBtn = view.querySelector('#btn-publish-posting');
      if (publishBtn) {
        publishBtn.addEventListener('click', function () {
          ui.confirm({
            title: 'Publish Job Circular',
            body: 'Are you sure you want to publish <strong>' + fmt.esc(c.title || c.post) + '</strong> (' + fmt.esc(c.code) + ')? This will activate the recruitment pipeline and enable applicant processing.',
            okText: 'Publish Circular',
            danger: false
          }).then(function (ok) {
            if (!ok) return;
            store.update('circulars', c.id, { status: 'ACTIVE' });
            store.audit('PUBLISH_CIRCULAR', 'circular', c.id, 'Published job circular ' + c.code + ' (' + c.post + ')');
            if (ERec.app && ERec.app.renderNav) {
              ERec.app.renderNav();
            }
            ui.toast('Job Circular ' + c.code + ' published successfully! Redirecting to circular workspace...', 'success');
            setTimeout(function () {
              ERec.router.go('#/circular/' + c.id);
            }, 600);
          });
        });
      }
    }

    function renderView() {
      view.innerHTML = buildViewHtml();
      ui.bindPostingWizard(view);
      bindEvents();
    }

    renderView();
  }

  ERec.pages.newcircular = { render: render };
  ERec.pages.newcircularPreview = { render: render };
})(window);
