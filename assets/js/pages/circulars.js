/* Circular list + create.
   Pubali Bank PLC &middot; HRD E-Recruitment Admin Portal */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  function newCircularForm() {
    var y = new Date().getFullYear();
    ui.modal({
      title: 'New Recruitment Circular',
      size: 'lg',
      body:
        '<div class="row g-3">' +
          '<div class="col-md-8"><label class="form-label">Circular Title</label>' +
            '<input class="form-control" id="f-title" placeholder="Recruitment of Officer (IT) - ' + y + '"></div>' +
          '<div class="col-md-4"><label class="form-label">Reference No.</label>' +
            '<input class="form-control mono" id="f-code" placeholder="PBPLC/HRD/REC/' + y + '/04"></div>' +
          '<div class="col-md-5"><label class="form-label">Post Name</label>' +
            '<input class="form-control" id="f-post" placeholder="Officer (IT)"></div>' +
          '<div class="col-md-4"><label class="form-label">Division / Department</label>' +
            '<input class="form-control" id="f-dept" placeholder="Information Technology Division"></div>' +
          '<div class="col-md-3"><label class="form-label">Vacancies</label>' +
            '<input type="number" min="1" class="form-control" id="f-vac" value="5"></div>' +
          '<div class="col-md-6"><label class="form-label">Application Opens</label>' +
            '<input type="date" class="form-control" id="f-start" value="' + fmt.isoDate() + '"></div>' +
          '<div class="col-md-6"><label class="form-label">Application Closes</label>' +
            '<input type="date" class="form-control" id="f-end" value="' + fmt.addDays(fmt.isoDate(), 30) + '"></div>' +
          '<div class="col-md-7"><label class="form-label">Examination Pipeline Stages</label>' +
            '<select class="form-select" id="f-chain">' +
              '<option value="MCQ,WRITTEN,VIVA">MCQ &rarr; Written &rarr; Viva-Voce</option>' +
              '<option value="MCQ,VIVA">MCQ &rarr; Viva-Voce</option>' +
              '<option value="WRITTEN,VIVA">Written &rarr; Viva-Voce</option>' +
              '<option value="VIVA">Direct Viva-Voce Only</option>' +
            '</select>' +
            '<div class="form-text text-muted">Stages can be customized later from the circular workspace.</div></div>' +
          '<div class="col-md-5"><label class="form-label">Demo Applicants to Generate</label>' +
            '<input type="number" min="0" max="300" class="form-control" id="f-applicants" value="40">' +
            '<div class="form-text text-muted">Sample applicant roster to walk through the pipeline.</div></div>' +
        '</div>',
      footer: '<button class="btn btn-sm btn-outline-secondary px-3" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-green-solid px-4" data-act="save"><i class="bi bi-check2-circle me-1"></i> Create Circular</button>',
      onShow: function (api) {
        api.find('[data-act="save"]').addEventListener('click', function () {
          var title = api.find('#f-title').value.trim();
          var post = api.find('#f-post').value.trim();
          if (!title || !post) { ui.toast('Title and post are required', 'warning'); return; }
          var id = fmt.uid('C');
          store.insert('circulars', {
            id: id,
            code: api.find('#f-code').value.trim() || id,
            title: title, post: post,
            department: api.find('#f-dept').value.trim() || '—',
            vacancies: parseInt(api.find('#f-vac').value, 10) || 1,
            applyStart: api.find('#f-start').value,
            applyEnd: api.find('#f-end').value,
            status: 'ACTIVE', steps: {}
          });
          api.find('#f-chain').value.split(',').forEach(function (type, i) {
            store.insert('stages', {
              id: id + '-S' + (i + 1), circularId: id, type: type, seq: i + 1,
              name: pipe.typeLabel(type) + ' Examination',
              requireApplicantApproval: true, requireVenueApproval: false,
              applicantApprovers: [], venueApprovers: [],
              instructions: '', examDate: null,
              fullMarks: type === 'VIVA' ? 50 : 100, passMarks: type === 'VIVA' ? 25 : 50,
              status: 'NOT_STARTED', steps: {}
            });
          });

          var n = parseInt(api.find('#f-applicants').value, 10);
          if (isNaN(n) || n < 0) n = 0;
          if (n > 0) {
            ERec.seed.makeApplicants({
              circularId: id, count: n,
              prefix: (api.find('#f-code').value.trim() || id).replace(/\W+/g, '').slice(-6).toUpperCase() || 'APP',
              appliedAt: api.find('#f-start').value
            }).forEach(function (a) { store.insert('applicants', a); });
          }

          store.audit('CREATE_CIRCULAR', 'circular', id,
            'Circular ' + post + ' created with ' + fmt.plural(n, 'applicant'));
          api.close();
          ui.toast('Circular created' + (n ? ' with ' + fmt.plural(n, 'applicant') : ''));
          ERec.app.renderNav();
          ERec.router.go('#/circular/' + id);
        });
      }
    });
  }

  function render(view) {
    ERec.router.setCrumbs([{ label: 'Job Circulars' }]);
    var list = store.all('circulars');
    var allApplicants = store.all('applicants');
    var me = store.actingUser();
    var minePending = store.pendingApprovalsFor(me.id).length;
    var notificationsCount = store.all('notifications').length;

    var rows = list.map(function (c) {
      var p = pipe.circularProgress(c.id);
      var n = store.applicantsOf(c.id).length;
      var active = pipe.activeStage(c.id);
      var cur = active ? pipe.currentStep(active) : null;
      return '<tr class="clickable" data-cid="' + c.id + '">' +
        '<td><div class="name-cell"><div><div class="n">' + fmt.esc(c.post) + '</div>' +
        '<div class="m mono">' + fmt.esc(c.code) + '</div></div></div></td>' +
        '<td>' + fmt.esc(c.department) + '</td>' +
        '<td class="num fw-semibold">' + c.vacancies + '</td>' +
        '<td class="num fw-semibold text-success">' + n + '</td>' +
        '<td class="nowrap">' + fmt.esc(pipe.chainLabel(c.id)) + '</td>' +
        '<td style="min-width:160px">' + ui.progressBar(p.pct) +
          '<div class="fs-12 text-muted mt-1 d-flex justify-content-between">' +
            '<span>' + (cur ? fmt.esc(cur.label) : 'Complete') + '</span>' +
            '<span class="fw-bold text-success">' + p.pct + '%</span>' +
          '</div></td>' +
        '<td>' + ui.statusPill(c.status) + '</td>' +
        '<td class="nowrap text-end"><a class="btn btn-sm btn-outline-success" href="#/circular/' + c.id + '">Workspace <i class="bi bi-chevron-right"></i></a></td>' +
        '</tr>';
    }).join('');

    var html = ui.pageHead({
      title: 'Active Recruitment Circulars',
      sub: 'Pubali Bank PLC &middot; Oversee job circulars and recruitment pipelines.',
      actions: '<button class="btn btn-sm btn-green-solid btn-icon shadow-sm" id="btn-new"><i class="bi bi-plus-lg"></i> Post New Circular</button>'
    });

    // Metric Stat Cards Grid
    html +=
      '<div class="row g-3 mb-4">' +
      '<div class="col-12 col-sm-6 col-xl-3">' +
      '<div class="stat-card-modern shadow-sm h-100" style="background-color: #eef5fc;">' +
      '<div class="d-flex align-items-center justify-content-between">' +
      '<div>' +
      '<span class="text-secondary fw-semibold small">Active Circulars</span>' +
      '<h3 class="fw-bold mb-0 mt-1" style="color: #1e293b;">' + list.length + '</h3>' +
      '</div>' +
      '<div class="stat-icon-badge bg-white text-primary shadow-sm">' +
      '<i class="bi bi-briefcase-fill"></i>' +
      '</div>' +
      '</div>' +
      '<div class="mt-3 pt-2 border-top border-light d-flex align-items-center justify-content-between">' +
      '<span class="small text-muted">Recruitment drives</span>' +
      '<span class="badge badge-soft-blue fw-semibold">Live</span>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div class="col-12 col-sm-6 col-xl-3">' +
      '<div class="stat-card-modern shadow-sm h-100" style="background-color: #ecfdf5;">' +
      '<div class="d-flex align-items-center justify-content-between">' +
      '<div>' +
      '<span class="text-secondary fw-semibold small">Total Applicants</span>' +
      '<h3 class="fw-bold mb-0 mt-1" style="color: #047857;">' + allApplicants.length + '</h3>' +
      '</div>' +
      '<div class="stat-icon-badge bg-white text-success shadow-sm">' +
      '<i class="bi bi-people-fill"></i>' +
      '</div>' +
      '</div>' +
      '<div class="mt-3 pt-2 border-top border-light d-flex align-items-center justify-content-between">' +
      '<span class="small text-muted">Across active jobs</span>' +
      '<span class="badge badge-soft-green fw-semibold">Registered</span>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div class="col-12 col-sm-6 col-xl-3">' +
      '<div class="stat-card-modern shadow-sm h-100" style="background-color: #fff8ec;">' +
      '<div class="d-flex align-items-center justify-content-between">' +
      '<div>' +
      '<span class="text-secondary fw-semibold small">Pending Approvals</span>' +
      '<h3 class="fw-bold mb-0 mt-1" style="color: #b45309;">' + minePending + '</h3>' +
      '</div>' +
      '<div class="stat-icon-badge bg-white text-warning shadow-sm">' +
      '<i class="bi bi-shield-check"></i>' +
      '</div>' +
      '</div>' +
      '<div class="mt-3 pt-2 border-top border-light d-flex align-items-center justify-content-between">' +
      '<span class="small text-muted">Waiting on sign-off</span>' +
      '<span class="badge ' + (minePending > 0 ? 'bg-danger text-white' : 'badge-soft-green') + ' fw-semibold">' +
      (minePending > 0 ? 'Action required' : 'Clear') + '</span>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div class="col-12 col-sm-6 col-xl-3">' +
      '<div class="stat-card-modern shadow-sm h-100" style="background-color: #f5f3ff;">' +
      '<div class="d-flex align-items-center justify-content-between">' +
      '<div>' +
      '<span class="text-secondary fw-semibold small">SMS & Mails Dispatched</span>' +
      '<h3 class="fw-bold mb-0 mt-1" style="color: #6d28d9;">' + notificationsCount + '</h3>' +
      '</div>' +
      '<div class="stat-icon-badge bg-white text-purple shadow-sm" style="color:#8b5cf6;">' +
      '<i class="bi bi-envelope-check-fill"></i>' +
      '</div>' +
      '</div>' +
      '<div class="mt-3 pt-2 border-top border-light d-flex align-items-center justify-content-between">' +
      '<span class="small text-muted">Applicant notifications</span>' +
      '<span class="badge badge-soft-purple fw-semibold">Dispatched</span>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>';

    html += ui.card({
      tight: true,
      body: list.length ? '<div class="table-scroll"><table class="table-x"><thead><tr>' +
        '<th>Post / Reference No.</th><th>Department</th><th class="num">Vacancies</th><th class="num">Applied</th>' +
        '<th>Pipeline Stages</th><th>Progress</th><th>Status</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : ui.empty('No circulars yet', 'Create one to start the recruitment pipeline.', 'bi-megaphone')
    });

    view.innerHTML = html;

    view.querySelector('#btn-new').addEventListener('click', newCircularForm);
    ui.on(view, 'tr[data-cid]', 'click', function (e, tr) {
      if (e.target.closest('a')) return;
      ERec.router.go('#/circular/' + tr.dataset.cid);
    });
  }

  ERec.pages.circulars = { render: render, newCircularForm: newCircularForm };
})(window);
