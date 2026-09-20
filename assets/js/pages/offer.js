/* Offer letter generation for the finally selected candidates. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt;

  function selectedOf(circularId) {
    return store.where('applicants', function (a) {
      return a.circularId === circularId && (a.status === 'SELECTED' || a.status === 'JOINED');
    });
  }

  function issueModal(c, targets, after) {
    var tpl = store.templateFor(c.id, null, 'OFFER', ERec.seed.defaultTemplates('OFFER'));
    ui.modal({
      title: 'Generate offer letters',
      size: 'lg',
      body:
        '<div class="row g-3 mb-3">' +
          '<div class="col-md-4"><label class="form-label">Reference prefix</label>' +
            '<input class="form-control mono" id="o-ref" value="' + fmt.esc(c.code) + '/OFFER"></div>' +
          '<div class="col-md-4"><label class="form-label">Date of joining</label>' +
            '<input type="date" class="form-control" id="o-join" value="' + fmt.addDays(fmt.isoDate(), 30) + '"></div>' +
          '<div class="col-md-4"><label class="form-label">Consolidated salary (BDT)</label>' +
            '<input type="number" class="form-control" id="o-sal" value="45000"></div>' +
        '</div>' +
        '<label class="form-label">E-mail subject</label>' +
        '<input class="form-control mb-3" id="o-sub" value="' + fmt.esc(tpl.mailSubject) + '">' +
        '<label class="form-label">E-mail body</label>' +
        '<textarea class="form-control mb-3" id="o-mail" rows="7">' + fmt.esc(tpl.mailBody) + '</textarea>' +
        '<label class="form-label">SMS body</label>' +
        '<textarea class="form-control" id="o-sms" rows="3">' + fmt.esc(tpl.smsBody) + '</textarea>' +
        '<div class="form-text mt-2">Placeholders: {{name}} {{roll}} {{post}} {{joiningDate}} {{salary}}</div>',
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" data-act="go">Issue ' + fmt.plural(targets.length, 'offer letter') + '</button>',
      onShow: function (api) {
        api.find('[data-act="go"]').addEventListener('click', function () {
          var refPrefix = api.find('#o-ref').value.trim();
          var joinDate = api.find('#o-join').value;
          var salary = parseInt(api.find('#o-sal').value, 10) || 0;
          if (!joinDate) { ui.toast('Set a date of joining', 'warning'); return; }

          store.update('templates', tpl.id, {
            mailSubject: api.find('#o-sub').value, mailBody: api.find('#o-mail').value, smsBody: api.find('#o-sms').value
          });

          var records = [], n = 0;
          targets.forEach(function (a, i) {
            if (store.offerFor(a.id)) return;
            var ref = refPrefix + '/' + fmt.pad(i + 1, 3);
            store.insert('offers', {
              id: fmt.uid('off'), applicantId: a.id, circularId: c.id, refNo: ref,
              issuedAt: new Date().toISOString(), joiningDate: joinDate, salary: salary, status: 'ISSUED'
            });
            var v = { name: a.name, roll: a.rollNo, post: c.post, joiningDate: fmt.date(joinDate), salary: fmt.money(salary) };
            records.push({
              applicantId: a.id, applicantName: a.name, circularId: c.id, stageId: null,
              kind: 'OFFER', channel: 'MAIL', to: a.email,
              subject: fmt.merge(api.find('#o-sub').value, v), body: fmt.merge(api.find('#o-mail').value, v)
            });
            records.push({
              applicantId: a.id, applicantName: a.name, circularId: c.id, stageId: null,
              kind: 'OFFER', channel: 'SMS', to: a.mobile, subject: '',
              body: fmt.merge(api.find('#o-sms').value, v)
            });
            n++;
          });
          store.notify(records);
          store.audit('ISSUE_OFFER', 'circular', c.id, fmt.plural(n, 'offer letter') + ' issued');
          api.close();
          ui.toast(fmt.plural(n, 'offer letter') + ' issued');
          after();
        });
      }
    });
  }

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var c = store.circular(stg.circularId);
    var selected = selectedOf(c.id);
    var pending = selected.filter(function (a) { return !store.offerFor(a.id); });
    var state = store.circularStep(c.id, 'offer');
    var done = !!(state && state.done);

    var body = ui.lockedNotice(stg, 'offer');

    if (!selected.length) {
      body += ui.alert('warn', '<strong>No finally selected candidate yet.</strong> Publish the final result first.');
    } else if (done) {
      body += ui.alert('ok', '<strong>Offer letters issued to ' + fmt.plural(state.count, 'candidate') + '.</strong> ' +
        'Initiate joining on the day the candidates report.');
    } else {
      body += ui.alert('info', '<strong>' + fmt.plural(selected.length, 'finally selected candidate') + '.</strong> ' +
        'Issue the offer letter with the reference number, joining date and salary; each letter is printable and the ' +
        'candidate is notified by mail and SMS.');
    }

    var rows = selected.map(function (a) {
      var o = store.offerFor(a.id);
      var j = store.joiningFor(a.id);
      return '<tr>' +
        '<td class="mono nowrap">' + fmt.esc(a.rollNo || '—') + '</td>' +
        '<td><div class="name-cell">' + ui.avatar(a.name, 'sm') +
          '<div><div class="n">' + fmt.esc(a.name) + '</div><div class="m">' + fmt.esc(a.mobile) + '</div></div></div></td>' +
        '<td class="mono fs-12">' + (o ? fmt.esc(o.refNo) : '<span class="muted">—</span>') + '</td>' +
        '<td class="nowrap">' + (o ? fmt.date(o.joiningDate) : '—') + '</td>' +
        '<td class="num">' + (o ? fmt.money(o.salary) : '—') + '</td>' +
        '<td>' + (j ? ui.statusPill('JOINED') : o ? ui.statusPill('OFFERED') : ui.pill('Not issued', 'grey')) + '</td>' +
        '<td class="text-end nowrap">' +
          (o ? '<button class="btn btn-sm btn-light" data-print="' + a.id + '"><i class="bi bi-printer"></i> Letter</button> ' +
            '<button class="btn btn-sm btn-outline-danger" data-revoke="' + a.id + '"><i class="bi bi-x-lg"></i></button>'
            : '<button class="btn btn-sm btn-primary" data-one="' + a.id + '">Issue offer</button>') +
        '</td></tr>';
    }).join('');

    body += ui.card({
      title: 'Offer letters',
      hint: fmt.plural(selected.length - pending.length, 'letter') + ' issued · ' + fmt.plural(pending.length, 'candidate') + ' pending',
      actions:
        '<button class="btn btn-sm btn-light btn-icon" id="btn-print-all"><i class="bi bi-printer"></i> Print all letters</button>' +
        '<button class="btn btn-sm btn-light btn-icon ms-2" id="btn-csv"><i class="bi bi-filetype-csv"></i> Export</button>',
      tight: true,
      body: selected.length
        ? '<table class="table table-striped table-hover align-middle table-x" id="table-offers"><thead><tr><th>Roll</th><th>Candidate</th><th>Reference no.</th>' +
          '<th>Joining date</th><th class="num">Salary</th><th>Status</th><th data-orderable="false"></th></tr></thead><tbody>' + rows + '</tbody></table>'
        : ui.empty('Nobody has been finally selected', 'Publish the final result first.', 'bi-file-earmark-text')
    });

    ui.stagePage(view, stg, 'offer', {
      body: body,
      action: done
        ? {
          note: fmt.plural(state.count, 'offer letter') + ' issued',
          secondary: [{ id: 'btn-reopen', label: 'Issue more offers' }]
        }
        : pending.length
          ? {
            note: fmt.plural(pending.length, 'candidate') + ' without an offer letter',
            primary: {
              id: 'btn-issue', tone: 'success', icon: 'bi-file-earmark-text',
              label: 'Issue ' + fmt.plural(pending.length, 'offer letter')
            }
          }
          : {
            primary: {
              id: 'btn-complete', tone: 'success', icon: 'bi-check2-circle',
              label: 'Finish the offer stage', disabled: !selected.length
            }
          }
    });

    if (selected.length) {
      ui.dataTable(view.querySelector('#table-offers'), { pageLength: 10 });
    }

    var issueBtn = view.querySelector('#btn-issue');
    if (issueBtn) issueBtn.addEventListener('click', function () {
      issueModal(c, pending, function () { ERec.router.refresh(); });
    });
    ui.on(view, '[data-one]', 'click', function (e, b) {
      issueModal(c, [store.applicant(b.dataset.one)], function () { ERec.router.refresh(); });
    });
    ui.on(view, '[data-print]', 'click', function (e, b) { ERec.exp.printDoc('offer', b.dataset.print); });
    ui.on(view, '[data-revoke]', 'click', function (e, b) {
      var a = store.applicant(b.dataset.revoke);
      ui.confirm({ title: 'Revoke offer', body: 'Remove the offer letter issued to <strong>' + fmt.esc(a.name) + '</strong>?', okText: 'Revoke', danger: true })
        .then(function (ok) {
          if (!ok) return;
          var o = store.offerFor(a.id);
          if (o) store.remove('offers', o.id);
          ui.toast('Offer revoked');
          ERec.router.refresh();
        });
    });

    view.querySelector('#btn-print-all').addEventListener('click', function () {
      ERec.exp.printDoc('offer-all', c.id);
    });
    view.querySelector('#btn-csv').addEventListener('click', function () {
      ERec.exp.csv(c.post.replace(/\W+/g, '_') + '_offers.csv',
        ['Roll', 'Name', 'Mobile', 'Email', 'Reference', 'Joining Date', 'Salary', 'Status'],
        selected.map(function (a) {
          var o = store.offerFor(a.id);
          return [a.rollNo, a.name, a.mobile, a.email, o ? o.refNo : '', o ? o.joiningDate : '',
            o ? o.salary : '', o ? 'Issued' : 'Pending'];
        }));
    });

    var comp = view.querySelector('#btn-complete');
    if (comp) comp.addEventListener('click', function () {
      store.markCircularStep(c.id, 'offer', { count: selected.length });
      store.audit('OFFER_STAGE_DONE', 'circular', c.id, fmt.plural(selected.length, 'offer letter') + ' completed');
      ui.toast('Offer stage completed');
      ERec.router.go('#/circular/' + c.id + '/stage/' + stg.id + '/joining');
    });

    var reopen = view.querySelector('#btn-reopen');
    if (reopen) reopen.addEventListener('click', function () {
      store.clearCircularStep(c.id, 'offer');
      ERec.router.refresh();
    });
  }

  ERec.pages.offer = { render: render, selectedOf: selectedOf };
})(window);
