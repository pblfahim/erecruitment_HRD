/* Circular list + create. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var DEMO_APPLICANTS = 40;   // generated behind the scenes so a new circular is walkable

  function newCircularForm() {
    var y = new Date().getFullYear();
    var chain = ['MCQ', 'WRITTEN', 'VIVA'];

    function chainHtml() {
      return (chain.length
        ? '<div class="chain mb-2">' + chain.map(function (t, i) {
          return (i ? '<span class="arrow"><i class="bi bi-chevron-right"></i></span>' : '') +
            '<span class="stage-chip cur">' + (i + 1) + '. ' + fmt.esc(pipe.typeLabel(t)) +
            '<button class="stage-chip-x" data-rm="' + i + '" title="Remove"><i class="bi bi-x"></i></button></span>';
        }).join('') + '</div>'
        : '<div class="fs-12 text-danger mb-2">Add at least one examination stage.</div>') +
        '<div class="d-flex gap-2 flex-wrap">' +
        ['MCQ', 'WRITTEN', 'VIVA'].map(function (t) {
          return '<button class="btn btn-sm btn-light" data-add="' + t + '">' +
            '<i class="bi bi-plus-lg"></i> Add ' + pipe.typeLabel(t) + '</button>';
        }).join('') + '</div>' +
        '<div class="form-text mt-2">Roll numbers are generated at stage 1. A Viva-Voce stage automatically ' +
        'includes document scrutiny. The chain can be changed later.</div>';
    }

    ui.modal({
      title: 'New circular',
      size: 'lg',
      body:
        '<div class="section-title">Circular</div>' +
        '<div class="row g-3">' +
          '<div class="col-md-8"><label class="form-label">Circular title</label>' +
            '<input class="form-control" id="f-title" placeholder="Recruitment of Officer (IT) - ' + y + '"></div>' +
          '<div class="col-md-4"><label class="form-label">Circular no.</label>' +
            '<input class="form-control mono" id="f-code" placeholder="HRD/REC/' + y + '/04"></div>' +
          '<div class="col-md-6"><label class="form-label">Post</label>' +
            '<input class="form-control" id="f-post" placeholder="Officer (IT)"></div>' +
          '<div class="col-md-2"><label class="form-label">Vacancies</label>' +
            '<input type="number" min="1" class="form-control" id="f-vac" value="5"></div>' +
          '<div class="col-md-4"><label class="form-label">Application opens</label>' +
            '<input type="date" class="form-control" id="f-start" value="' + fmt.isoDate() + '"></div>' +
          '<div class="col-md-4"><label class="form-label">Application closes</label>' +
            '<input type="date" class="form-control" id="f-end" value="' + fmt.addDays(fmt.isoDate(), 30) + '"></div>' +
          '<div class="col-md-4"><label class="form-label">Closing time</label>' +
            '<input type="time" class="form-control" id="f-endtime" value="17:00"></div>' +
        '</div>' +

        '<div class="section-title">Starter eligibility rules</div>' +
        '<div class="row g-3">' +
          '<div class="col-md-3"><label class="form-label">Minimum age</label>' +
            '<input type="number" min="14" max="70" class="form-control" id="f-minage" value="21"></div>' +
          '<div class="col-md-3"><label class="form-label">Maximum age</label>' +
            '<input type="number" min="14" max="70" class="form-control" id="f-maxage" value="30"></div>' +
          '<div class="col-md-6"><label class="form-label">Minimum degree level</label>' +
            '<select class="form-select" id="f-degree">' +
            ERec.seed.DEGREE_LEVELS.map(function (l) {
              return '<option value="' + l + '"' + (l === 'Bachelor' ? ' selected' : '') + '>' + l + '</option>';
            }).join('') + '</select></div>' +
          '<div class="col-12"><div class="form-text">' +
            'These create the first few rules. Add experience, subject and grade rules — or edit these — ' +
            'from <strong>Eligibility Rules</strong> in the circular workspace.</div></div>' +
        '</div>' +

        '<div class="section-title">Examination stages</div>' +
        '<div id="chain-box">' + chainHtml() + '</div>',
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" data-act="save">Create circular</button>',
      onShow: function (api) {
        function rebind() {
          var box = api.find('#chain-box');
          box.innerHTML = chainHtml();
          box.querySelectorAll('[data-add]').forEach(function (b) {
            b.addEventListener('click', function () { chain.push(b.dataset.add); rebind(); });
          });
          box.querySelectorAll('[data-rm]').forEach(function (b) {
            b.addEventListener('click', function () { chain.splice(+b.dataset.rm, 1); rebind(); });
          });
        }
        rebind();

        api.find('[data-act="save"]').addEventListener('click', function () {
          var title = api.find('#f-title').value.trim();
          var post = api.find('#f-post').value.trim();
          if (!title || !post) { ui.toast('Title and post are required', 'warning'); return; }
          if (!chain.length) { ui.toast('Add at least one examination stage', 'warning'); return; }

          var minAge = parseInt(api.find('#f-minage').value, 10) || 0;
          var maxAge = parseInt(api.find('#f-maxage').value, 10) || 0;
          if (maxAge && minAge && maxAge < minAge) {
            ui.toast('Maximum age cannot be lower than minimum age', 'warning'); return;
          }

          var id = fmt.uid('C');
          var code = api.find('#f-code').value.trim() || id;
          store.insert('circulars', {
            id: id, code: code, title: title, post: post,
            vacancies: parseInt(api.find('#f-vac').value, 10) || 1,
            applyStart: api.find('#f-start').value,
            applyEnd: api.find('#f-end').value,
            applyEndTime: api.find('#f-endtime').value || '17:00',
            /* Starter rules; the full typed builder lives on the workspace. */
            eligibilityRules: [
              Object.assign(ERec.seed.blankRule('AGE'), {
                name: 'Age Limit', minAge: minAge, maxAge: maxAge,
                failureMessage: 'Applicant must be between ' + minAge + ' and ' + maxAge + ' years old.'
              }),
              Object.assign(ERec.seed.blankRule('DEGREE_LEVEL'), {
                name: 'Minimum Academic Qualification',
                degreeLevel: api.find('#f-degree').value, mandatory: true,
                failureMessage: 'Applicant must hold at least a ' + api.find('#f-degree').value + ' degree.'
              })
            ],
            status: 'ACTIVE', steps: {}
          });

          chain.forEach(function (type, i) {
            store.insert('stages', {
              id: id + '-S' + (i + 1), circularId: id, type: type, seq: i + 1,
              name: pipe.typeLabel(type) + ' Examination',
              requireApplicantApproval: true, requireVenueApproval: false,
              applicantApprovers: ['u-gm', 'u-dmd', 'u-md'], venueApprovers: ['u-gm'],
              instructions: '', examDate: null,
              fullMarks: type === 'VIVA' ? 50 : 100, passMarks: type === 'VIVA' ? 25 : 50,
              status: 'NOT_STARTED', steps: {}
            });
          });

          /* Sample applications are created with the circular - without a
             candidate list there is nothing to walk through. */
          ERec.seed.makeApplicants({
            circularId: id, count: DEMO_APPLICANTS,
            prefix: code.replace(/\W+/g, '').slice(-6).toUpperCase() || 'APP',
            appliedAt: api.find('#f-start').value
          }).forEach(function (a) { store.insert('applicants', a); });

          store.audit('CREATE_CIRCULAR', 'circular', id, 'Circular ' + post + ' created');
          api.close();
          ui.toast('Circular created with ' + fmt.plural(DEMO_APPLICANTS, 'application'));
          ERec.app.renderNav();
          ERec.router.go('#/circular/' + id);
        });
      }
    });
  }

  /* Metric tile for the row of summary cards above the circular table. */
  function statCard(opts) {
    return '<div class="col-12 col-sm-6 col-xl-3">' +
      '<div class="stat-card-modern shadow-sm h-100" style="background-color: ' + opts.bg + ';">' +
        '<div class="d-flex align-items-center justify-content-between">' +
          '<div>' +
            '<span class="text-secondary fw-semibold small">' + fmt.esc(opts.label) + '</span>' +
            '<h3 class="fw-bold mb-0 mt-1" style="color: ' + opts.valueColor + ';">' + opts.value + '</h3>' +
          '</div>' +
          '<div class="stat-icon-badge bg-white shadow-sm ' + (opts.iconClass || '') + '"' +
            (opts.iconColor ? ' style="color:' + opts.iconColor + ';"' : '') + '>' +
            '<i class="bi ' + opts.icon + '"></i>' +
          '</div>' +
        '</div>' +
        '<div class="mt-3 pt-2 border-top border-light d-flex align-items-center justify-content-between">' +
          '<span class="small text-muted">' + fmt.esc(opts.foot) + '</span>' +
          '<span class="badge ' + opts.badgeClass + ' fw-semibold">' + fmt.esc(opts.badge) + '</span>' +
        '</div>' +
      '</div></div>';
  }

  function render(view) {
    ERec.router.setCrumbs([{ label: 'Job Circulars' }]);
    var list = store.all('circulars');
    var me = store.actingUser();
    var minePending = store.pendingApprovalsFor(me.id).length;

    var rows = list.map(function (c) {
      var p = pipe.circularProgress(c.id);
      var n = store.applicantsOf(c.id).length;
      var active = pipe.activeStage(c.id);
      var cur = active ? pipe.currentStep(active) : null;
      var rules = c.eligibilityRules || [];
      return '<tr class="clickable" data-cid="' + c.id + '">' +
        '<td><div class="name-cell"><div><div class="n">' + fmt.esc(c.post) + '</div>' +
          '<div class="m mono">' + fmt.esc(c.code) + '</div></div></div></td>' +
        '<td class="fs-12">' + (rules.length
          ? '<span class="fw-semibold">' + fmt.plural(rules.length, 'rule') + '</span>' +
            '<div class="muted text-truncate" style="max-width:220px">' +
            fmt.esc(rules.map(function (r) { return ERec.seed.ruleTypeLabel(r.type); }).join(', ')) + '</div>'
          : '<span class="muted">No rules set</span>') + '</td>' +
        '<td class="num fw-semibold">' + c.vacancies + '</td>' +
        '<td class="num fw-semibold text-success">' + n + '</td>' +
        '<td class="nowrap fs-12">' + fmt.date(c.applyEnd) +
          (c.applyEndTime ? '<br><span class="muted">' + fmt.time12(c.applyEndTime) + '</span>' : '') + '</td>' +
        '<td class="nowrap">' + fmt.esc(pipe.chainLabel(c.id)) + '</td>' +
        '<td style="min-width:160px">' + ui.progressBar(p.pct) +
          '<div class="fs-12 text-muted mt-1 d-flex justify-content-between">' +
            '<span>' + (cur ? fmt.esc(cur.label) : 'Complete') + '</span>' +
            '<span class="fw-bold text-success">' + p.pct + '%</span>' +
          '</div></td>' +
        '<td>' + ui.statusPill(c.status) + '</td>' +
        '<td class="nowrap text-end"><a class="btn btn-sm btn-outline-success" href="#/circular/' + c.id + '">' +
          'Workspace <i class="bi bi-chevron-right"></i></a></td>' +
        '</tr>';
    }).join('');

    var html = ui.pageHead({
      title: 'Active Recruitment Circulars',
      sub: 'Pubali Bank PLC &middot; Oversee job circulars and recruitment pipelines.',
      actions: '<button class="btn btn-sm btn-green-solid btn-icon shadow-sm" id="btn-new">' +
        '<i class="bi bi-plus-lg"></i> Post New Circular</button>'
    });

    html += '<div class="row g-3 mb-4">' +
      statCard({
        label: 'Active Circulars', value: list.length, bg: '#eef5fc', valueColor: '#1e293b',
        icon: 'bi-briefcase-fill', iconClass: 'text-primary',
        foot: 'Recruitment drives', badge: 'Live', badgeClass: 'badge-soft-blue'
      }) +
      statCard({
        label: 'Total Applicants', value: store.all('applicants').length, bg: '#ecfdf5', valueColor: '#047857',
        icon: 'bi-people-fill', iconClass: 'text-success',
        foot: 'Across active jobs', badge: 'Registered', badgeClass: 'badge-soft-green'
      }) +
      statCard({
        label: 'Pending Approvals', value: minePending, bg: '#fff8ec', valueColor: '#b45309',
        icon: 'bi-shield-check', iconClass: 'text-warning',
        foot: 'Waiting on sign-off',
        badge: minePending > 0 ? 'Action required' : 'Clear',
        badgeClass: minePending > 0 ? 'bg-danger text-white' : 'badge-soft-green'
      }) +
      statCard({
        label: 'SMS & Mails Dispatched', value: store.all('notifications').length, bg: '#f5f3ff', valueColor: '#6d28d9',
        icon: 'bi-envelope-check-fill', iconColor: '#8b5cf6',
        foot: 'Applicant notifications', badge: 'Dispatched', badgeClass: 'badge-soft-purple'
      }) +
      '</div>';

    html += ui.card({
      tight: true,
      body: list.length ? '<div class="table-scroll"><table class="table-x"><thead><tr>' +
        '<th>Post / Reference No.</th><th>Eligibility</th><th class="num">Vacancies</th><th class="num">Applied</th>' +
        '<th>Closes</th><th>Pipeline Stages</th><th>Progress</th><th>Status</th><th>Action</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>'
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
