/* Exam instructions - printed on the admit card for this stage.
   One instruction per line; the preview shows exactly how it will appear. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  function lines(text) {
    return (text || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function admitPreview(stg, text, row) {
    var c = store.circular(stg.circularId);
    var roster = store.rosterOf(stg.id);
    var r = row || roster[0];
    var a = r ? store.applicant(r.applicantId) : null;
    var v = r && r.venueId ? store.find('venues', r.venueId) : store.venuesOf(stg.id)[0];

    return '<div class="doc-page" style="width:auto;min-height:0;padding:18px 22px;box-shadow:none">' +
      '<div class="doc-head" style="padding-bottom:8px;margin-bottom:12px">' +
      '<div class="org" style="font-size:16px">PUBALI BANK PLC.</div>' +
      '<div class="addr">Human Resources Division · Head Office, Dhaka</div>' +
      '<div class="doc-title" style="font-size:12px;margin-top:6px">Admit Card · ' + fmt.esc(pipe.typeLabel(stg.type)) + '</div>' +
      '</div>' +
      '<div class="doc-photo" style="width:24mm;height:28mm">' +
      (a ? '<span class="initials" style="font-size:16px">' + fmt.esc(fmt.initials(a.name)) + '</span>' : 'Photo') +
      '</div>' +
      '<dl class="doc-grid" style="grid-template-columns:120px 1fr">' +
      '<dt>Roll Number</dt><dd>' + fmt.esc(r && r.rollNo ? r.rollNo : 'not generated') + '</dd>' +
      '<dt>Candidate</dt><dd>' + fmt.esc(a ? a.name : 'Sample Candidate') + '</dd>' +
      '<dt>Post</dt><dd>' + fmt.esc(c.post) + '</dd>' +
      '<dt>Date &amp; Time</dt><dd>' + (v ? fmt.date(v.examDate) + ', ' + fmt.time12(v.startTime) : 'venue not set') + '</dd>' +
      '<dt>Venue</dt><dd>' + fmt.esc(v ? v.name : 'venue not set') + '</dd>' +
      '</dl>' +
      '<div class="doc-section-title" style="margin:14px 0 8px">Instructions to the candidate</div>' +
      (lines(text).length
        ? '<div class="doc-instructions"><ol>' + lines(text).map(function (l) {
          return '<li>' + fmt.esc(l) + '</li>';
        }).join('') + '</ol></div>'
        : '<div class="alert alert-warning py-2.5 px-3 fs-13 mb-0 d-flex align-items-center gap-2">' +
          '<i class="bi bi-exclamation-triangle fs-6 text-warning"></i>' +
          '<span>No instruction added yet — click <strong>Edit instructions</strong> to configure instructions.</span>' +
          '</div>') +
      '<div style="clear:both"></div></div>';
  }

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var c = store.circular(stg.circularId);
    var roster = store.rosterOf(stg.id);
    var done = store.isStepDone(stg, 'instructions');
    var text = stg.instructions || '';
    var next = pipe.step(stg, 'initiate');

    var body = ui.lockedNotice(stg, 'instructions');

    body += '<div class="row justify-content-center">' +
      '<div class="col-lg-10 col-xl-9">' +
        ui.card({
          title: 'Admit card preview',
          hint: 'Rendered with candidate details and formatted instructions as they will appear on print.',
          actions: '<div class="d-flex align-items-center gap-2">' +
            (roster.length > 1
              ? '<select class="form-select form-select-sm" id="f-who" style="width:200px">' +
                roster.slice(0, 60).map(function (r, i) {
                  var a = store.applicant(r.applicantId);
                  return '<option value="' + r.id + '"' + (i === 0 ? ' selected' : '') + '>' +
                    fmt.esc((r.rollNo ? r.rollNo + ' · ' : '') + a.name) + '</option>';
                }).join('') + '</select>'
              : '') +
            '<button class="btn btn-sm btn-outline-primary btn-icon" id="btn-edit-inst">' +
              '<i class="bi bi-pencil-square"></i> Edit instructions' +
            '</button>' +
          '</div>',
          body: '<div id="preview">' + admitPreview(stg, text, roster[0]) + '</div>'
        }) +
      '</div>' +
    '</div>';

    var numInst = lines(text).length;
    var action = {
      note: done ? fmt.plural(numInst, 'instruction') + ' saved · Ready for exam notice' : 'No instructions saved yet',
      secondary: done ? [
        { id: 'btn-bar-edit', label: 'Edit instructions', icon: 'bi-pencil' },
        { id: 'btn-clear-done', label: 'Mark as not ready' }
      ] : [],
      primary: done && next
        ? { nav: next.key, label: 'Continue: ' + next.label, icon: 'bi-chevron-right' }
        : { id: 'btn-bar-edit', tone: 'primary', icon: 'bi-pencil', label: done ? 'Edit instructions' : 'Configure instructions' }
    };

    ui.stagePage(view, stg, 'instructions', { body: body, action: action });

    function currentRow() {
      var sel = view.querySelector('#f-who');
      if (sel && sel.value) {
        var r = store.find('stageApplicants', sel.value);
        if (r) return r;
      }
      return roster[0];
    }

    function repaint() {
      var prevEl = view.querySelector('#preview');
      if (prevEl) {
        prevEl.innerHTML = admitPreview(stg, text, currentRow());
      }
    }

    var who = view.querySelector('#f-who');
    if (who) who.addEventListener('change', repaint);

    function openEditModal() {
      ui.modal({
        title: 'Edit instructions · ' + fmt.esc(pipe.typeLabel(stg.type)),
        size: 'lg',
        body:
          '<div class="mb-3">' +
            '<label class="form-label fw-semibold">Exam instructions</label>' +
            '<p class="form-text mt-0 mb-2">Write one instruction per line — they are automatically numbered on the admit card.</p>' +
            '<textarea class="form-control" id="m-text" rows="12" placeholder="Candidates must reach the venue 30 minutes before the exam...">' +
              fmt.esc(text) +
            '</textarea>' +
            '<div class="d-flex justify-content-between align-items-center mt-2">' +
              '<span class="form-text fw-semibold text-primary" id="m-line-count"></span>' +
              '<span class="form-text text-muted">Printed on every candidate admit card</span>' +
            '</div>' +
          '</div>',
        footer:
          '<button class="btn btn-sm btn-light btn-icon" id="m-btn-preset"><i class="bi bi-magic me-1"></i> Load standard ' +
            fmt.esc(pipe.typeLabel(stg.type)) + ' set</button>' +
          '<div class="ms-auto d-flex gap-2">' +
            '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
            '<button class="btn btn-sm btn-primary" id="m-btn-save"><i class="bi bi-check2 me-1"></i> Save instructions</button>' +
          '</div>',
        onShow: function (api) {
          var mText = api.find('#m-text');
          var mCount = api.find('#m-line-count');

          function updateCount() {
            var n = lines(mText.value).length;
            mCount.textContent = fmt.plural(n, 'instruction');
          }

          mText.addEventListener('input', updateCount);
          updateCount();

          api.find('#m-btn-preset').addEventListener('click', function () {
            mText.value = ERec.seed.DEFAULT_INSTRUCTIONS[stg.type] || '';
            updateCount();
            ui.toast('Standard instructions loaded — click Save instructions to apply');
          });

          api.find('#m-btn-save').addEventListener('click', function () {
            var val = mText.value;
            if (!lines(val).length) {
              ui.toast('Add at least one instruction', 'warning');
              return;
            }
            text = val;
            stg.instructions = val;
            store.update('stages', stg.id, { instructions: val });
            store.markStep(stg.id, 'instructions', { count: lines(val).length });
            store.audit('SET_INSTRUCTIONS', 'stage', stg.id,
              fmt.plural(lines(val).length, 'instruction') + ' saved for ' + pipe.typeLabel(stg.type));
            repaint();
            api.close();
            ui.toast('Instructions saved');
            ERec.router.refresh();
          });
        }
      });
    }

    var editBtn = view.querySelector('#btn-edit-inst');
    if (editBtn) editBtn.addEventListener('click', openEditModal);

    var barEditBtn = view.querySelector('#btn-bar-edit');
    if (barEditBtn) barEditBtn.addEventListener('click', openEditModal);

    var cd = view.querySelector('#btn-clear-done');
    if (cd) cd.addEventListener('click', function () {
      store.clearStep(stg.id, 'instructions');
      ERec.router.refresh();
    });
  }

  ERec.pages.instructions = { render: render, lines: lines };
})(window);
