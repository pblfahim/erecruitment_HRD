/* Final result - generated from the last stage's selected candidates.
   The merit list aggregates marks across every stage of the circular, and
   the notification text is shown and editable before publishing. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var excluded = {};   // applicantId -> true, un-ticked before publishing

  function meritList(stg) {
    var stages = store.stagesOf(stg.circularId);
    return store.rosterOf(stg.id)
      .filter(function (r) { return r.selectedForNext; })
      .map(function (r) {
        var a = store.applicant(r.applicantId);
        var perStage = stages.map(function (s) {
          var row = store.rosterRow(s.id, a.id);
          return { stage: s, marks: row && row.marks !== null && row.marks !== undefined ? Number(row.marks) : null };
        });
        var total = perStage.reduce(function (sum, x) { return sum + (x.marks || 0); }, 0);
        var full = perStage.reduce(function (sum, x) { return sum + (x.marks === null ? 0 : x.stage.fullMarks); }, 0);
        return { row: r, a: a, perStage: perStage, total: total, full: full };
      })
      .sort(function (x, y) { return y.total - x.total; });
  }

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var c = store.circular(stg.circularId);
    var stages = store.stagesOf(c.id);
    var list = meritList(stg);
    var state = store.circularStep(c.id, 'result');
    var done = !!(state && state.done);
    var tpl = store.templateFor(c.id, null, 'FINAL', ERec.seed.defaultTemplates('FINAL'));

    var included = list.filter(function (x) { return !excluded[x.a.id]; });

    var body = ui.lockedNotice(stg, 'result');

    if (done) {
      body += ui.alert('ok', '<strong>Final result published.</strong> ' + fmt.plural(state.count, 'candidate') +
        ' finally selected and notified ' + fmt.ago(state.at) + '. Offer letters can now be issued.');
    } else {
      body += ui.alert('info', '<strong>' + fmt.plural(list.length, 'candidate') +
        ' cleared the ' + fmt.esc(pipe.typeLabel(stg.type)) + ' stage against ' + c.vacancies + ' vacancies.</strong> ' +
        'Un-tick anyone who should not appear in the final result, review the notification text, then publish.');
    }

    var markCols = stages.map(function (s) {
      return '<th class="num nowrap">' + fmt.esc(pipe.typeLabel(s.type)) + '<br><span class="fs-12">/' + s.fullMarks + '</span></th>';
    }).join('');

    var rows = list.map(function (x, i) {
      var inc = !excluded[x.a.id];
      return '<tr' + (inc ? '' : ' style="opacity:.5"') + '>' +
        '<td><input type="checkbox" class="form-check-input" data-inc="' + x.a.id + '"' + (inc ? ' checked' : '') +
          (done ? ' disabled' : '') + '></td>' +
        '<td class="num muted">' + (i + 1) + '</td>' +
        '<td class="mono nowrap">' + fmt.esc(x.row.rollNo) + '</td>' +
        '<td><div class="name-cell"><div><div class="n">' + fmt.esc(x.a.name) + '</div>' +
          '<div class="m">' + fmt.esc(x.a.fatherName) + '</div></div></div></td>' +
        x.perStage.map(function (p) {
          return '<td class="num">' + (p.marks === null ? '<span class="muted">—</span>' : p.marks) + '</td>';
        }).join('') +
        '<td class="num fw-semibold">' + x.total + ' <span class="muted fs-12">/ ' + x.full + '</span></td>' +
        '<td>' + (x.row.selectionBasis === 'PRIVILEGED'
          ? ui.pill('Privilege', 'purple', 'bi-star-fill') : ui.pill('Merit', 'green')) + '</td>' +
        '<td>' + ui.statusPill(x.a.status) + '</td>' +
        '</tr>';
    }).join('');

    body += ui.card({
      title: 'Merit list',
      hint: 'Ordered by aggregate marks across all stages. ' + c.vacancies + ' vacancies were advertised.',
      actions: '<button class="btn btn-sm btn-light btn-icon" id="btn-csv"><i class="bi bi-filetype-csv"></i> Export</button>' +
        '<button class="btn btn-sm btn-light btn-icon ms-2" id="btn-print"><i class="bi bi-printer"></i> Print final result</button>',
      tight: true,
      body: list.length
        ? '<div class="table-scroll"><table class="table table-striped table-hover align-middle table-x" id="table-merit-list"><thead><tr><th style="width:34px" data-orderable="false"></th><th>Merit</th>' +
          '<th>Roll</th><th>Candidate</th>' + markCols + '<th class="num">Total</th><th>Basis</th><th>Status</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        : ui.empty('No candidate selected in the final stage', 'Complete mark upload and select candidates first.', 'bi-trophy')
    });

    body += '<div class="row g-3"><div class="col-lg-7">' + ui.card({
      title: 'Result notification',
      hint: 'Sent to every finally selected candidate. Editable.',
      body:
        '<div class="mb-3">' + ['name', 'roll', 'post', 'circular'].map(function (p) {
          return '<span class="ph-chip" data-ph="' + p + '">{{' + p + '}}</span>';
        }).join('') + '</div>' +
        '<label class="form-label">E-mail subject</label>' +
        '<input class="form-control mb-3" id="f-subject" value="' + fmt.esc(tpl.mailSubject) + '">' +
        '<label class="form-label">E-mail body</label>' +
        '<textarea class="form-control mb-3" id="f-mail" rows="10">' + fmt.esc(tpl.mailBody) + '</textarea>' +
        '<label class="form-label">SMS body</label>' +
        '<textarea class="form-control" id="f-sms" rows="3">' + fmt.esc(tpl.smsBody) + '</textarea>' +
        '<div class="sms-count mt-1" id="sms-count"></div>'
    }) + '</div><div class="col-lg-5">' + ui.card({
      title: 'Preview',
      body: included.length
        ? '<div class="fs-12 muted mb-1">E-MAIL</div><div class="preview-box mb-3">' +
          '<strong id="p-sub"></strong><hr class="hr-soft my-2"><span id="p-mail"></span></div>' +
          '<div class="fs-12 muted mb-1">SMS</div><div class="preview-box" id="p-sms"></div>'
        : ui.empty('Nobody to notify')
    }) + ui.card({
      title: 'Summary',
      body: '<dl class="kv">' +
        '<dt>Vacancies</dt><dd>' + c.vacancies + '</dd>' +
        '<dt>Cleared final stage</dt><dd>' + list.length + '</dd>' +
        '<dt>Included in result</dt><dd class="fw-semibold">' + included.length + '</dd>' +
        '<dt>Excluded</dt><dd>' + (list.length - included.length) + '</dd>' +
        '</dl>' +
        (included.length > c.vacancies
          ? ui.alert('warn', included.length + ' selected against ' + c.vacancies + ' vacancies.')
          : '')
    }) + '</div></div>';

    ui.stagePage(view, stg, 'result', {
      body: body,
      action: done
        ? {
          note: fmt.plural(state.count, 'candidate') + ' finally selected',
          secondary: [{ id: 'btn-reopen', label: 'Change the result' }]
        }
        : {
          primary: {
            id: 'btn-publish', tone: 'success', icon: 'bi-trophy',
            label: 'Publish result for ' + fmt.plural(included.length, 'candidate'),
            disabled: !included.length
          }
        }
    });

    if (list.length) {
      ui.dataTable(view.querySelector('#table-merit-list'), { pageLength: 10 });
    }

    /* ---- wiring ---- */
    var fSub = view.querySelector('#f-subject'), fMail = view.querySelector('#f-mail'), fSms = view.querySelector('#f-sms');
    var lastField = fMail;
    [fSub, fMail, fSms].forEach(function (el) {
      el.addEventListener('focus', function () { lastField = el; });
      el.addEventListener('input', repaint);
    });
    ui.on(view, '[data-ph]', 'click', function (e, chip) {
      var token = '{{' + chip.dataset.ph + '}}';
      var el = lastField, s = el.selectionStart || 0, t = el.selectionEnd || 0;
      el.value = el.value.slice(0, s) + token + el.value.slice(t);
      el.focus(); el.selectionStart = el.selectionEnd = s + token.length;
      repaint();
    });

    function varsFor(x) {
      return { name: x.a.name, roll: x.row.rollNo, post: c.post, circular: c.code };
    }

    function repaint() {
      var x = included[0];
      var counter = view.querySelector('#sms-count');
      if (!x) { counter.textContent = ''; return; }
      var v = varsFor(x);
      var sms = fmt.merge(fSms.value, v);
      var p = fmt.smsParts(sms);
      view.querySelector('#p-sub').textContent = fmt.merge(fSub.value, v);
      view.querySelector('#p-mail').textContent = fmt.merge(fMail.value, v);
      view.querySelector('#p-sms').textContent = sms;
      counter.textContent = p.len + ' characters · ' + fmt.plural(p.parts, 'SMS part');
      counter.classList.toggle('over', p.parts > 1);
    }
    repaint();

    ui.on(view, '[data-inc]', 'change', function (e, cb) {
      excluded[cb.dataset.inc] = !cb.checked;
      ERec.router.refresh();
    });

    view.querySelector('#btn-csv').addEventListener('click', function () {
      ERec.exp.csv(c.post.replace(/\W+/g, '_') + '_final_result.csv',
        ['Merit', 'Roll', 'Name', "Father's Name", 'Total', 'Basis', 'Included'],
        list.map(function (x, i) {
          return [i + 1, x.row.rollNo, x.a.name, x.a.fatherName, x.total,
            x.row.selectionBasis || 'MERIT', excluded[x.a.id] ? 'No' : 'Yes'];
        }));
    });
    view.querySelector('#btn-print').addEventListener('click', function () {
      ERec.exp.printDoc('final-result', c.id);
    });

    var pub = view.querySelector('#btn-publish');
    if (pub) pub.addEventListener('click', function () {
      ui.confirm({
        title: 'Publish final result',
        body: fmt.plural(included.length, 'candidate') + ' will be marked <strong>finally selected</strong> and ' +
          'will receive the e-mail and SMS shown in the preview.',
        okText: 'Publish result'
      }).then(function (ok) {
        if (!ok) return;
        store.update('templates', tpl.id, { mailSubject: fSub.value, mailBody: fMail.value, smsBody: fSms.value });
        var records = [];
        included.forEach(function (x) {
          store.update('applicants', x.a.id, { status: 'SELECTED' });
          x.row.resultStatus = 'PASSED';
          var v = varsFor(x);
          records.push({
            applicantId: x.a.id, applicantName: x.a.name, circularId: c.id, stageId: stg.id,
            kind: 'FINAL', channel: 'MAIL', to: x.a.email,
            subject: fmt.merge(fSub.value, v), body: fmt.merge(fMail.value, v)
          });
          records.push({
            applicantId: x.a.id, applicantName: x.a.name, circularId: c.id, stageId: stg.id,
            kind: 'FINAL', channel: 'SMS', to: x.a.mobile, subject: '', body: fmt.merge(fSms.value, v)
          });
        });
        list.filter(function (x) { return excluded[x.a.id]; }).forEach(function (x) {
          store.update('applicants', x.a.id, { status: 'REJECTED' });
        });
        store.notify(records);
        store.markCircularStep(c.id, 'result', { count: included.length });
        store.audit('FINAL_RESULT', 'circular', c.id,
          'Final result published — ' + included.length + ' selected, ' + included.length * 2 + ' notifications sent');
        ui.toast('Final result published to ' + fmt.plural(included.length, 'candidate'));
        ERec.router.go('#/circular/' + c.id + '/stage/' + stg.id + '/offer');
      });
    });

    var reopen = view.querySelector('#btn-reopen');
    if (reopen) reopen.addEventListener('click', function () {
      store.clearCircularStep(c.id, 'result');
      ui.toast('Final result re-opened');
      ERec.router.refresh();
    });
  }

  ERec.pages.result = { render: render, meritList: meritList };
})(window);
