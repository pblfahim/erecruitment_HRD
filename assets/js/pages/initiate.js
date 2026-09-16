/* Initiate exam - the user must see (and may edit) the exact mail and SMS
   body that goes to candidates before anything is sent. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var PLACEHOLDERS = [
    ['name', 'Candidate name'], ['roll', 'Roll number'], ['post', 'Post applied for'],
    ['circular', 'Circular number'], ['date', 'Exam date'], ['time', 'Reporting time'],
    ['examTime', 'Exam start time'],
    ['venue', 'Venue name'], ['venueAddress', 'Venue address']
  ];

  function varsFor(stg, row) {
    var c = store.circular(stg.circularId);
    var a = store.applicant(row.applicantId);
    var v = row.venueId ? store.find('venues', row.venueId) : store.venuesOf(stg.id)[0];
    return {
      name: a.name, roll: row.rollNo || '(roll not generated)', post: c.post, circular: c.code,
      date: v ? fmt.date(v.examDate) : '(date not set)',
      time: v ? fmt.time12(v.reportingTime || fmt.shiftTime(v.startTime, -30)) : '(time not set)',
      examTime: v ? fmt.time12(v.startTime) : '(time not set)',
      venue: v ? v.name : '(venue not set)',
      venueAddress: v ? v.address : ''
    };
  }

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var c = store.circular(stg.circularId);
    var roster = store.rosterOf(stg.id);
    var state = store.stepState(stg, 'initiate');
    var done = !!(state && state.done);
    var label = pipe.typeLabel(stg.type);
    var tpl = store.templateFor(c.id, stg.id, 'ADMIT', ERec.seed.defaultTemplates(stg.type, label));

    /* Candidates added later by a supplementary call have had nothing sent
       to them yet, so they are tracked separately from the first dispatch. */
    var notified = {};
    store.all('notifications').forEach(function (n) {
      if (n.stageId === stg.id && n.kind === 'ADMIT') notified[n.applicantId] = true;
    });
    var pendingRows = roster.filter(function (r) { return !notified[r.applicantId]; });

    var body = ui.lockedNotice(stg, 'initiate');

    if (done && pendingRows.length) {
      body += ui.alert('warn', '<strong>' + fmt.plural(pendingRows.length, 'candidate') +
        ' have not been notified yet.</strong> They were added to this examination after the first ' +
        'dispatch. Send the notice to them without disturbing the candidates who already have it.');
    } else if (done) {
      body += ui.alert('ok', '<strong>Examination notice sent.</strong> ' + (state.mail || 0) + ' e-mail and ' +
        (state.sms || 0) + ' SMS dispatched ' + fmt.ago(state.at) + '. ' +
        'Admit cards are available for printing.');
    } else {
      body += ui.alert('info', '<strong>Read the wording before you send it.</strong> ' +
        'Both the e-mail and the SMS are editable, and go to all ' +
        fmt.plural(roster.length, 'candidate') + ' on this list.');
    }

    var chips = PLACEHOLDERS.map(function (p) {
      return '<span class="ph-chip" data-ph="' + p[0] + '" title="' + fmt.esc(p[1]) + '">{{' + p[0] + '}}</span>';
    }).join('');

    body += '<div class="row g-3">' +
      '<div class="col-lg-7">' +
        ui.card({
          title: 'Notification content',
          hint: 'Click a placeholder to insert it at the cursor.',
          body:
            '<div class="mb-3">' + chips + '</div>' +
            '<label class="form-label">E-mail subject</label>' +
            '<input class="form-control mb-3" id="f-subject" value="' + fmt.esc(tpl.mailSubject) + '">' +
            '<label class="form-label">E-mail body</label>' +
            '<textarea class="form-control mb-3" id="f-mail" rows="14">' + fmt.esc(tpl.mailBody) + '</textarea>' +
            '<label class="form-label">SMS body</label>' +
            '<textarea class="form-control" id="f-sms" rows="4">' + fmt.esc(tpl.smsBody) + '</textarea>' +
            '<div class="d-flex justify-content-between mt-1">' +
              '<span class="sms-count" id="sms-count"></span>' +
              '<span class="form-text">Merged length is what actually gets sent</span>' +
            '</div>',
          foot: '<button class="btn btn-sm btn-light btn-icon" id="btn-save-tpl"><i class="bi bi-save"></i> Save draft</button>' +
            '<button class="btn btn-sm btn-light" id="btn-reset-tpl">Reset to standard text</button>'
        }) +
      '</div>' +
      '<div class="col-lg-5">' +
        ui.card({
          title: 'Preview',
          hint: 'Merged against a real candidate from this roster.',
          actions: roster.length > 1
            ? '<select class="form-select form-select-sm" id="f-who" style="width:200px">' +
              roster.slice(0, 60).map(function (r, i) {
                var a = store.applicant(r.applicantId);
                return '<option value="' + r.id + '"' + (i === 0 ? ' selected' : '') + '>' +
                  fmt.esc((r.rollNo ? r.rollNo + ' · ' : '') + a.name) + '</option>';
              }).join('') + '</select>'
            : '',
          body: roster.length
            ? '<div class="fs-12 muted mb-1">E-MAIL TO <span class="mono" id="p-to"></span></div>' +
              '<div class="preview-box mb-3"><strong id="p-sub"></strong><hr class="hr-soft my-2"><span id="p-mail"></span></div>' +
              '<div class="fs-12 muted mb-1">SMS TO <span class="mono" id="p-mob"></span></div>' +
              '<div class="preview-box" id="p-sms"></div>'
            : ui.empty('No candidate on this roster')
        }) +
        ui.card({
          title: 'Who this goes to',
          body:
            '<dl class="kv">' +
              '<dt>Candidates</dt><dd>' + roster.length + '</dd>' +
              '<dt>Already notified</dt><dd>' + (roster.length - pendingRows.length) + '</dd>' +
              '<dt>Not yet notified</dt><dd' + (pendingRows.length ? ' class="text-warning fw-semibold"' : '') + '>' +
                pendingRows.length + '</dd>' +
              '<dt>Exam date</dt><dd>' + fmt.date(stg.examDate) + '</dd>' +
              '<dt>Without a venue</dt><dd>' + roster.filter(function (r) { return !r.venueId; }).length + '</dd>' +
            '</dl>'
        }) +
      '</div></div>';

    var action;
    if (!done) {
      action = {
        primary: {
          id: 'btn-send', tone: 'success', icon: 'bi-send-fill',
          label: 'Send to ' + fmt.plural(roster.length, 'candidate'), disabled: !roster.length
        }
      };
    } else if (pendingRows.length) {
      action = {
        note: fmt.plural(roster.length - pendingRows.length, 'candidate') + ' already notified',
        secondary: [{ id: 'btn-print-admit', label: 'Admit cards', icon: 'bi-printer' }],
        primary: {
          id: 'btn-send-pending', tone: 'success', icon: 'bi-send-fill',
          label: 'Send to the ' + pendingRows.length + ' new candidate' + (pendingRows.length === 1 ? '' : 's')
        }
      };
    } else {
      var next = pipe.step(stg, 'scrutiny') || pipe.step(stg, 'marks');
      action = {
        note: fmt.plural(roster.length, 'candidate') + ' notified',
        secondary: [
          { id: 'btn-print-admit', label: 'Print all admit cards', icon: 'bi-printer' },
          { id: 'btn-resend', label: 'Send again to everyone' }
        ],
        primary: next ? { nav: next.key, label: 'Continue: ' + next.label, icon: 'bi-chevron-right' } : null
      };
    }

    ui.stagePage(view, stg, 'initiate', { body: body, action: action });

    /* ---- editor wiring ---- */
    var fSub = view.querySelector('#f-subject');
    var fMail = view.querySelector('#f-mail');
    var fSms = view.querySelector('#f-sms');
    var lastField = fMail;

    [fSub, fMail, fSms].forEach(function (el) {
      el.addEventListener('focus', function () { lastField = el; });
      el.addEventListener('input', repaint);
    });

    ui.on(view, '[data-ph]', 'click', function (e, chip) {
      var token = '{{' + chip.dataset.ph + '}}';
      var el = lastField;
      var s = el.selectionStart || 0, t = el.selectionEnd || 0;
      el.value = el.value.slice(0, s) + token + el.value.slice(t);
      el.focus();
      el.selectionStart = el.selectionEnd = s + token.length;
      repaint();
    });

    function currentRow() {
      var sel = view.querySelector('#f-who');
      if (sel) {
        var r = store.find('stageApplicants', sel.value);
        if (r) return r;
      }
      return roster[0];
    }

    function repaint() {
      var row = currentRow();
      var counter = view.querySelector('#sms-count');
      if (!row) { if (counter) counter.textContent = ''; return; }
      var v = varsFor(stg, row);
      var a = store.applicant(row.applicantId);
      var mergedSms = fmt.merge(fSms.value, v);
      var p = fmt.smsParts(mergedSms);

      view.querySelector('#p-to').textContent = a.email;
      view.querySelector('#p-mob').textContent = a.mobile;
      view.querySelector('#p-sub').textContent = fmt.merge(fSub.value, v);
      view.querySelector('#p-mail').textContent = fmt.merge(fMail.value, v);
      view.querySelector('#p-sms').textContent = mergedSms;

      counter.textContent = p.len + ' characters · ' + fmt.plural(p.parts, 'SMS part');
      counter.classList.toggle('over', p.parts > 1);
    }

    var who = view.querySelector('#f-who');
    if (who) who.addEventListener('change', repaint);
    if (roster.length) repaint();

    function saveTpl(quiet) {
      store.update('templates', tpl.id, {
        mailSubject: fSub.value, mailBody: fMail.value, smsBody: fSms.value
      });
      if (!quiet) ui.toast('Draft saved');
    }

    view.querySelector('#btn-save-tpl').addEventListener('click', function () { saveTpl(); });

    view.querySelector('#btn-reset-tpl').addEventListener('click', function () {
      var d = ERec.seed.defaultTemplates(stg.type, pipe.typeLabel(stg.type));
      fSub.value = d.mailSubject; fMail.value = d.mailBody; fSms.value = d.smsBody;
      repaint();
      ui.toast('Standard text restored — remember to save');
    });

    /* ---- dispatch ---- */
    function dispatch(rows) {
      saveTpl(true);
      var records = [];
      rows.forEach(function (row) {
        var a = store.applicant(row.applicantId);
        var v = varsFor(stg, row);
        records.push({
          applicantId: a.id, applicantName: a.name, circularId: c.id, stageId: stg.id,
          kind: 'ADMIT', channel: 'MAIL', to: a.email,
          subject: fmt.merge(fSub.value, v), body: fmt.merge(fMail.value, v)
        });
        records.push({
          applicantId: a.id, applicantName: a.name, circularId: c.id, stageId: stg.id,
          kind: 'ADMIT', channel: 'SMS', to: a.mobile,
          subject: '', body: fmt.merge(fSms.value, v)
        });
      });
      store.notify(records);
      store.update('stages', stg.id, { status: 'IN_PROGRESS' });
      var prior = done ? (state.mail || 0) : 0;
      store.markStep(stg.id, 'initiate', { mail: prior + rows.length, sms: prior + rows.length });
      store.audit('INITIATE_EXAM', 'stage', stg.id,
        pipe.typeLabel(stg.type) + ' notice sent to ' + fmt.plural(rows.length, 'candidate'));
      ui.toast(rows.length * 2 + ' notifications dispatched');
      ERec.router.refresh();
    }

    function confirmSend(rows, title, extraLine) {
      var noVenue = rows.filter(function (r) { return !r.venueId; }).length;
      ui.confirm({
        title: title,
        body: fmt.plural(rows.length, 'candidate') + ' will receive the e-mail and SMS shown in the preview, ' +
          'and their admit cards become printable.' + (extraLine || '') +
          (noVenue ? ' <strong class="text-danger">' + fmt.plural(noVenue, 'candidate') +
            ' have no venue allocated.</strong>' : ''),
        okText: 'Send now'
      }).then(function (ok) { if (ok) dispatch(rows); });
    }

    var sendBtn = view.querySelector('#btn-send');
    if (sendBtn) sendBtn.addEventListener('click', function () {
      confirmSend(roster, 'Send the ' + pipe.typeLabel(stg.type) + ' examination notice');
    });

    var sendPending = view.querySelector('#btn-send-pending');
    if (sendPending) sendPending.addEventListener('click', function () {
      confirmSend(pendingRows, 'Send to the newly called candidates',
        ' Candidates who were already notified are not contacted again.');
    });

    var printAdmit = view.querySelector('#btn-print-admit');
    if (printAdmit) printAdmit.addEventListener('click', function () {
      ERec.exp.printDoc('admit', stg.id);
    });

    var resend = view.querySelector('#btn-resend');
    if (resend) resend.addEventListener('click', function () {
      ui.confirm({
        title: 'Send again to everyone',
        body: 'The current e-mail and SMS text will be sent again to all ' +
          fmt.plural(roster.length, 'candidate') + ', including those who already received it.',
        okText: 'Send again'
      }).then(function (ok) { if (ok) dispatch(roster); });
    });
  }

  ERec.pages.initiate = { render: render, varsFor: varsFor };
})(window);
