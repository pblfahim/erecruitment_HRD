/* Joining - on the reporting day the candidate's documents are verified one
   last time (including anything left over from a conditional scrutiny) and
   an employee ID is issued. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt;

  /* Any conditional scrutiny outcome for this candidate, from any stage. */
  function pendingDocs(applicantId) {
    var rows = store.where('stageApplicants', function (r) {
      return r.applicantId === applicantId && r.scrutiny && r.scrutiny.status === 'CONDITIONAL';
    });
    if (!rows.length) return null;
    var sc = rows[rows.length - 1].scrutiny;
    return {
      deadline: sc.deadline,
      remarks: sc.remarks,
      missing: (sc.checklist || []).filter(function (d) { return d.ok !== true; })
    };
  }

  function joinModal(c, a, after) {
    var pd = pendingDocs(a.id);
    var o = store.offerFor(a.id);
    var checks = (pd ? pd.missing.map(function (d) { return d.name; }) : []);

    ui.modal({
      title: 'Initiate joining · ' + fmt.esc(a.name),
      size: 'lg',
      body:
        '<dl class="kv mb-3">' +
          '<dt>Roll number</dt><dd class="mono">' + fmt.esc(a.rollNo || '—') + '</dd>' +
          '<dt>Post</dt><dd>' + fmt.esc(c.post) + '</dd>' +
          '<dt>Offer reference</dt><dd class="mono">' + fmt.esc(o ? o.refNo : '—') + '</dd>' +
          '<dt>Offered joining date</dt><dd>' + fmt.date(o ? o.joiningDate : null) + '</dd>' +
        '</dl>' +
        (pd
          ? ui.alert('warn', '<strong>Conditional acceptance at scrutiny.</strong> ' +
            fmt.plural(checks.length, 'document') + ' were to be produced by ' + fmt.date(pd.deadline) + '.' +
            (pd.remarks ? '<div class="fs-12 mt-1">“' + fmt.esc(pd.remarks) + '”</div>' : ''))
          : '') +
        (checks.length
          ? '<div class="section-title">Outstanding documents</div>' +
            checks.map(function (n, i) {
              return '<div class="doc-row"><input class="form-check-input" type="checkbox" data-doc="' + i + '">' +
                '<span class="nm">' + fmt.esc(n) + '</span></div>';
            }).join('')
          : '') +
        '<div class="section-title">Joining details</div>' +
        '<div class="row g-3">' +
          '<div class="col-md-6"><label class="form-label">Employee ID</label>' +
            '<input class="form-control mono" id="j-emp" value="EMP-' + fmt.pad(store.all('joinings').length + 1001, 5) + '"></div>' +
          '<div class="col-md-6"><label class="form-label">Actual joining date</label>' +
            '<input type="date" class="form-control" id="j-date" value="' +
            fmt.esc(o ? o.joiningDate : fmt.isoDate()) + '"></div>' +
          '<div class="col-12"><label class="form-label">Remarks</label>' +
            '<textarea class="form-control" id="j-rem" rows="2" placeholder="All documents verified in original."></textarea></div>' +
        '</div>',
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-success" data-act="join">Confirm joining</button>',
      onShow: function (api) {
        api.find('[data-act="join"]').addEventListener('click', function () {
          var boxes = Array.prototype.slice.call(api.el.querySelectorAll('[data-doc]'));
          var unmet = boxes.filter(function (b) { return !b.checked; }).length;
          var emp = api.find('#j-emp').value.trim();
          if (!emp) { ui.toast('Employee ID is required', 'warning'); return; }

          function commit() {
            store.insert('joinings', {
              id: fmt.uid('joi'), applicantId: a.id, circularId: c.id,
              employeeId: emp, joinedAt: api.find('#j-date').value,
              docsVerified: unmet === 0, remarks: api.find('#j-rem').value.trim()
            });
            store.update('applicants', a.id, { status: 'JOINED' });
            if (o) store.update('offers', o.id, { status: 'JOINED' });
            store.audit('JOINING', 'applicant', a.id, a.name + ' joined as ' + emp);
            api.close();
            ui.toast(a.name + ' has joined');
            after();
          }

          if (unmet) {
            ui.confirm({
              title: 'Documents still outstanding',
              body: fmt.plural(unmet, 'document') + ' from the conditional scrutiny is not ticked as produced. ' +
                'Record the joining anyway?',
              okText: 'Join anyway', danger: true
            }).then(function (ok) { if (ok) commit(); });
          } else commit();
        });
      }
    });
  }

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var c = store.circular(stg.circularId);
    var selected = ERec.pages.offer.selectedOf(c.id);
    var withOffer = selected.filter(function (a) { return store.offerFor(a.id); });
    var joined = selected.filter(function (a) { return store.joiningFor(a.id); });
    var state = store.circularStep(c.id, 'joining');
    var done = !!(state && state.done);

    var body = ui.lockedNotice(stg, 'joining');

    if (!withOffer.length) {
      body += ui.alert('warn', '<strong>No offer letter has been issued yet.</strong> Issue offers before initiating joining.');
    } else if (done) {
      body += ui.alert('ok', '<strong>Joining completed for ' + fmt.plural(state.count, 'candidate') + '.</strong> ' +
        'The recruitment cycle for this circular is finished.');
    } else {
      body += ui.alert('info', '<strong>On the reporting day, verify each candidate and record the joining.</strong> ' +
        'Candidates who were conditionally accepted at scrutiny show their outstanding documents here.');
    }

    body += '<div class="stat-grid">' +
      '<div class="stat"><div class="k">Finally selected</div><div class="v">' + selected.length + '</div></div>' +
      '<div class="stat"><div class="k">Offer issued</div><div class="v">' + withOffer.length + '</div></div>' +
      '<div class="stat"><div class="k">Joined</div><div class="v text-success">' + joined.length + '</div></div>' +
      '<div class="stat"><div class="k">Yet to join</div><div class="v">' + (withOffer.length - joined.length) + '</div></div>' +
      '</div>';

    var rows = withOffer.map(function (a) {
      var j = store.joiningFor(a.id);
      var o = store.offerFor(a.id);
      var pd = pendingDocs(a.id);
      return '<tr>' +
        '<td class="mono nowrap">' + fmt.esc(a.rollNo || '—') + '</td>' +
        '<td><div class="name-cell">' + ui.avatar(a.name, 'sm') +
          '<div><div class="n">' + fmt.esc(a.name) + '</div><div class="m">' + fmt.esc(a.mobile) + '</div></div></div></td>' +
        '<td class="mono fs-12">' + fmt.esc(o.refNo) + '</td>' +
        '<td class="nowrap">' + fmt.date(o.joiningDate) + '</td>' +
        '<td>' + (pd
          ? ui.pill(fmt.plural(pd.missing.length, 'doc') + ' pending', 'amber', 'bi-exclamation-triangle')
          : ui.pill('Clear', 'green', 'bi-check-lg')) + '</td>' +
        '<td class="mono fs-12">' + (j ? fmt.esc(j.employeeId) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + (j ? ui.statusPill('JOINED') : ui.pill('Awaiting', 'grey')) + '</td>' +
        '<td class="text-end nowrap">' + (j
          ? '<span class="fs-12 muted">' + fmt.date(j.joinedAt) + '</span> ' +
            '<button class="btn btn-sm btn-outline-danger" data-undo="' + a.id + '"><i class="bi bi-arrow-counterclockwise"></i></button>'
          : '<button class="btn btn-sm btn-primary" data-join="' + a.id + '">Initiate joining</button>') +
        '</td></tr>';
    }).join('');

    body += ui.card({
      title: 'Joining register',
      hint: 'Circular ' + fmt.esc(c.code) + ' · ' + fmt.esc(c.post),
      actions: '<button class="btn btn-sm btn-light btn-icon" id="btn-csv"><i class="bi bi-filetype-csv"></i> Export register</button>',
      tight: true,
      body: withOffer.length
        ? '<table class="table-x"><thead><tr><th>Roll</th><th>Candidate</th><th>Offer ref.</th>' +
          '<th>Joining date</th><th>Documents</th><th>Employee ID</th><th>Status</th><th></th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table>'
        : ui.empty('No candidate with an offer letter', 'Issue offer letters first.', 'bi-person-badge')
    });

    ui.stagePage(view, stg, 'joining', {
      body: body,
      action: done
        ? {
          note: fmt.plural(state.count, 'candidate') + ' joined — cycle closed',
          secondary: [{ id: 'btn-reopen', label: 'Re-open the cycle' }]
        }
        : {
          note: (withOffer.length - joined.length) + ' of ' + withOffer.length + ' yet to report',
          primary: {
            id: 'btn-complete', tone: 'success', icon: 'bi-flag-fill',
            label: 'Close this recruitment', disabled: !joined.length
          }
        }
    });

    ui.on(view, '[data-join]', 'click', function (e, b) {
      joinModal(c, store.applicant(b.dataset.join), function () { ERec.router.refresh(); });
    });

    ui.on(view, '[data-undo]', 'click', function (e, b) {
      var a = store.applicant(b.dataset.undo);
      ui.confirm({ title: 'Undo joining', body: 'Remove the joining record for <strong>' + fmt.esc(a.name) + '</strong>?', okText: 'Undo', danger: true })
        .then(function (ok) {
          if (!ok) return;
          var j = store.joiningFor(a.id);
          if (j) store.remove('joinings', j.id);
          store.update('applicants', a.id, { status: 'SELECTED' });
          ui.toast('Joining record removed');
          ERec.router.refresh();
        });
    });

    view.querySelector('#btn-csv').addEventListener('click', function () {
      ERec.exp.csv(c.post.replace(/\W+/g, '_') + '_joining_register.csv',
        ['Roll', 'Name', 'Offer Ref', 'Offered Joining Date', 'Employee ID', 'Actual Joining Date', 'Docs Verified', 'Remarks'],
        withOffer.map(function (a) {
          var o = store.offerFor(a.id), j = store.joiningFor(a.id);
          return [a.rollNo, a.name, o.refNo, o.joiningDate, j ? j.employeeId : '', j ? j.joinedAt : '',
            j ? (j.docsVerified ? 'Yes' : 'No') : '', j ? j.remarks : ''];
        }));
    });

    var comp = view.querySelector('#btn-complete');
    if (comp) comp.addEventListener('click', function () {
      ui.confirm({
        title: 'Complete recruitment cycle',
        body: fmt.plural(joined.length, 'candidate') + ' have joined out of ' +
          fmt.plural(withOffer.length, 'offer') + ' issued. Close the cycle for this circular?',
        okText: 'Complete'
      }).then(function (ok) {
        if (!ok) return;
        store.markCircularStep(c.id, 'joining', { count: joined.length });
        store.update('circulars', c.id, { status: 'CLOSED' });
        store.audit('COMPLETE_CYCLE', 'circular', c.id,
          'Recruitment cycle closed — ' + joined.length + ' joined');
        ui.toast('Recruitment cycle completed');
        ERec.app.renderNav();
        ERec.router.refresh();
      });
    });

    var reopen = view.querySelector('#btn-reopen');
    if (reopen) reopen.addEventListener('click', function () {
      store.clearCircularStep(c.id, 'joining');
      store.update('circulars', c.id, { status: 'ACTIVE' });
      ERec.router.refresh();
    });
  }

  ERec.pages.joining = { render: render, pendingDocs: pendingDocs };
})(window);
