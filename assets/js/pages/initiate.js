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

    var chips = PLACEHOLDERS.map(function (p) {
      return '<span class="ph-chip" data-ph="' + p[0] + '" title="' + fmt.esc(p[1]) + '">{{' + p[0] + '}}</span>';
    }).join('');

    body += '<div class="row g-3">' +
      '<div class="col-lg-8">' +
        ui.card({
          title: 'Preview',
          hint: 'Merged against a real candidate from this roster.',
          actions: '<div class="d-flex align-items-center gap-2">' +
            (roster.length > 1
              ? '<select class="form-select form-select-sm" id="f-who" style="width:200px">' +
                roster.slice(0, 60).map(function (r, i) {
                  var a = store.applicant(r.applicantId);
                  return '<option value="' + r.id + '"' + (i === 0 ? ' selected' : '') + '>' +
                    fmt.esc((r.rollNo ? r.rollNo + ' · ' : '') + a.name) + '</option>';
                }).join('') + '</select>'
              : '') +
            '<button class="btn btn-sm btn-outline-primary btn-icon" id="btn-edit-tpl"><i class="bi bi-pencil-square"></i> Edit</button>' +
          '</div>',
          body: roster.length
            ? '<div class="fs-12 muted mb-1">E-MAIL TO <span class="mono" id="p-to"></span></div>' +
              '<div class="preview-box mb-3"><strong id="p-sub"></strong><hr class="hr-soft my-2"><span id="p-mail"></span></div>' +
              '<div class="d-flex justify-content-between align-items-center mb-1">' +
                '<div class="fs-12 muted">SMS TO <span class="mono" id="p-mob"></span></div>' +
                '<span class="fs-12 text-muted" id="p-sms-count"></span>' +
              '</div>' +
              '<div class="preview-box" id="p-sms"></div>'
            : ui.empty('No candidate on this roster')
        }) +
      '</div>' +
      '<div class="col-lg-4">' +
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

    function currentRow() {
      var sel = view.querySelector('#f-who');
      if (sel && sel.value) {
        var r = store.find('stageApplicants', sel.value);
        if (r) return r;
      }
      return roster[0];
    }

    function repaint() {
      var row = currentRow();
      if (!row) return;
      var v = varsFor(stg, row);
      var a = store.applicant(row.applicantId);
      var mergedSms = fmt.merge(tpl.smsBody, v);
      var p = fmt.smsParts(mergedSms);

      var pTo = view.querySelector('#p-to');
      var pMob = view.querySelector('#p-mob');
      var pSub = view.querySelector('#p-sub');
      var pMail = view.querySelector('#p-mail');
      var pSms = view.querySelector('#p-sms');
      var pCount = view.querySelector('#p-sms-count');

      if (pTo) pTo.textContent = a.email;
      if (pMob) pMob.textContent = a.mobile;
      if (pSub) pSub.textContent = fmt.merge(tpl.mailSubject, v);
      if (pMail) pMail.textContent = fmt.merge(tpl.mailBody, v);
      if (pSms) pSms.textContent = mergedSms;
      if (pCount) {
        pCount.textContent = p.len + ' characters · ' + fmt.plural(p.parts, 'SMS part');
        pCount.classList.toggle('text-danger', p.parts > 1);
      }
    }

    var who = view.querySelector('#f-who');
    if (who) who.addEventListener('change', repaint);
    if (roster.length) repaint();

    function openEditModal() {
      ui.modal({
        title: 'Edit notification content',
        size: 'lg',
        body:
          '<div class="mb-3">' +
            '<div class="fs-12 text-muted mb-2">Click a placeholder to insert it at the cursor:</div>' +
            chips +
          '</div>' +
          '<div class="mb-3">' +
            '<label class="form-label fw-semibold">E-mail subject</label>' +
            '<input class="form-control" id="m-subject" value="' + fmt.esc(tpl.mailSubject) + '">' +
          '</div>' +
          '<div class="mb-3">' +
            '<label class="form-label fw-semibold">E-mail body</label>' +
            '<textarea class="form-control" id="m-mail" rows="8">' + fmt.esc(tpl.mailBody) + '</textarea>' +
          '</div>' +
          '<div class="mb-3">' +
            '<label class="form-label fw-semibold">SMS body</label>' +
            '<textarea class="form-control" id="m-sms" rows="4">' + fmt.esc(tpl.smsBody) + '</textarea>' +
            '<div class="d-flex justify-content-between mt-1">' +
              '<span class="sms-count" id="m-sms-count"></span>' +
              '<span class="form-text">Merged length is what actually gets sent</span>' +
            '</div>' +
          '</div>',
        footer:
          '<button class="btn btn-sm btn-light" id="m-btn-reset">Reset to standard text</button>' +
          '<div class="ms-auto d-flex gap-2">' +
            '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
            '<button class="btn btn-sm btn-primary" id="m-btn-save"><i class="bi bi-check2 me-1"></i> Save changes</button>' +
          '</div>',
        onShow: function (api) {
          var mSub = api.find('#m-subject');
          var mMail = api.find('#m-mail');
          var mSms = api.find('#m-sms');
          var mCount = api.find('#m-sms-count');
          var lastField = mMail;

          function updateSmsCount() {
            var row = currentRow();
            var v = row ? varsFor(stg, row) : {};
            var merged = fmt.merge(mSms.value, v);
            var p = fmt.smsParts(merged);
            if (mCount) {
              mCount.textContent = p.len + ' characters · ' + fmt.plural(p.parts, 'SMS part');
              mCount.classList.toggle('over', p.parts > 1);
            }
          }

          [mSub, mMail, mSms].forEach(function (el) {
            if (!el) return;
            el.addEventListener('focus', function () { lastField = el; });
            el.addEventListener('input', function () {
              if (el === mSms) updateSmsCount();
            });
          });

          api.findAll('[data-ph]').forEach(function (chip) {
            chip.addEventListener('click', function () {
              var token = '{{' + chip.dataset.ph + '}}';
              var el = lastField || mMail;
              var s = el.selectionStart || 0, t = el.selectionEnd || 0;
              el.value = el.value.slice(0, s) + token + el.value.slice(t);
              el.focus();
              el.selectionStart = el.selectionEnd = s + token.length;
              if (el === mSms) updateSmsCount();
            });
          });

          updateSmsCount();

          api.find('#m-btn-reset').addEventListener('click', function () {
            var d = ERec.seed.defaultTemplates(stg.type, pipe.typeLabel(stg.type));
            mSub.value = d.mailSubject;
            mMail.value = d.mailBody;
            mSms.value = d.smsBody;
            updateSmsCount();
            ui.toast('Standard text restored — remember to save changes');
          });

          api.find('#m-btn-save').addEventListener('click', function () {
            tpl.mailSubject = mSub.value;
            tpl.mailBody = mMail.value;
            tpl.smsBody = mSms.value;
            store.update('templates', tpl.id, {
              mailSubject: tpl.mailSubject,
              mailBody: tpl.mailBody,
              smsBody: tpl.smsBody
            });
            repaint();
            api.close();
            ui.toast('Notification content updated');
          });
        }
      });
    }

    var editBtn = view.querySelector('#btn-edit-tpl');
    if (editBtn) {
      editBtn.addEventListener('click', openEditModal);
    }

    /* ---- dispatch ---- */
    function dispatch(rows) {
      var records = [];
      rows.forEach(function (row) {
        var a = store.applicant(row.applicantId);
        var v = varsFor(stg, row);
        records.push({
          applicantId: a.id, applicantName: a.name, circularId: c.id, stageId: stg.id,
          kind: 'ADMIT', channel: 'MAIL', to: a.email,
          subject: fmt.merge(tpl.mailSubject, v), body: fmt.merge(tpl.mailBody, v)
        });
        records.push({
          applicantId: a.id, applicantName: a.name, circularId: c.id, stageId: stg.id,
          kind: 'ADMIT', channel: 'SMS', to: a.mobile,
          subject: '', body: fmt.merge(tpl.smsBody, v)
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
