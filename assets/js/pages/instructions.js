/* Exam instructions - printed on the admit card for this stage.
   One instruction per line; the preview shows exactly how it will appear. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  function lines(text) {
    return (text || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function admitPreview(stg, text) {
    var c = store.circular(stg.circularId);
    var roster = store.rosterOf(stg.id);
    var r = roster[0];
    var a = r ? store.applicant(r.applicantId) : null;
    var v = r && r.venueId ? store.find('venues', r.venueId) : store.venuesOf(stg.id)[0];

    return '<div class="doc-page" style="width:auto;min-height:0;padding:14px 16px;box-shadow:none">' +
      '<div class="doc-head" style="padding-bottom:7px;margin-bottom:10px">' +
      '<div class="org" style="font-size:15px">PUBALI BANK PLC.</div>' +
      '<div class="addr">Human Resources Division · Head Office, Dhaka</div>' +
      '<div class="doc-title" style="font-size:11px;margin-top:6px">Admit Card · ' + fmt.esc(pipe.typeLabel(stg.type)) + '</div>' +
      '</div>' +
      '<div class="doc-photo" style="width:22mm;height:26mm">' +
      (a ? '<span class="initials" style="font-size:15px">' + fmt.esc(fmt.initials(a.name)) + '</span>' : 'Photo') +
      '</div>' +
      '<dl class="doc-grid" style="grid-template-columns:110px 1fr">' +
      '<dt>Roll Number</dt><dd>' + fmt.esc(r && r.rollNo ? r.rollNo : 'not generated') + '</dd>' +
      '<dt>Candidate</dt><dd>' + fmt.esc(a ? a.name : 'Sample Candidate') + '</dd>' +
      '<dt>Post</dt><dd>' + fmt.esc(c.post) + '</dd>' +
      '<dt>Date &amp; Time</dt><dd>' + (v ? fmt.date(v.examDate) + ', ' + fmt.time12(v.startTime) : 'venue not set') + '</dd>' +
      '<dt>Venue</dt><dd>' + fmt.esc(v ? v.name : 'venue not set') + '</dd>' +
      '</dl>' +
      '<div class="doc-section-title" style="margin:10px 0 5px">Instructions to the candidate</div>' +
      (lines(text).length
        ? '<div class="doc-instructions"><ol>' + lines(text).map(function (l) {
          return '<li>' + fmt.esc(l) + '</li>';
        }).join('') + '</ol></div>'
        : '<div class="fs-12 text-danger">No instruction added yet — the admit card will print an empty block.</div>') +
      '<div style="clear:both"></div></div>';
  }

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var done = store.isStepDone(stg, 'instructions');
    var text = stg.instructions || '';

    var body = ui.lockedNotice(stg, 'instructions');

    body += ui.alert('info',
      '<strong>These instructions are mandatory before the exam can be initiated.</strong> ' +
      'They are printed on every admit card for the ' + fmt.esc(pipe.typeLabel(stg.type)) + ' stage. Write one instruction per line.');

    body += '<div class="row g-3"><div class="col-lg-6">' + ui.card({
      title: 'Instructions',
      hint: 'One per line — they are numbered automatically on the admit card.',
      actions: '<button class="btn btn-sm btn-light btn-icon" id="btn-preset"><i class="bi bi-magic"></i> Load standard ' +
        fmt.esc(pipe.typeLabel(stg.type)) + ' set</button>',
      body: '<textarea class="form-control" id="f-text" rows="16" placeholder="Candidates must reach the venue 30 minutes before the exam.">' +
        fmt.esc(text) + '</textarea>' +
        '<div class="d-flex justify-content-between mt-2"><span class="form-text" id="line-count"></span>' +
        '<span class="form-text">Saved to this stage only</span></div>',
    }) + '</div><div class="col-lg-6">' + ui.card({
      title: 'Admit card preview',
      hint: 'Rendered with the first candidate on this stage roster.',
      body: '<div id="preview">' + admitPreview(stg, text) + '</div>'
    }) + '</div></div>';

    ui.stagePage(view, stg, 'instructions', {
      body: body,
      action: {
        note: done ? 'Saved — these will print on the admit card' : '',
        secondary: done ? [{ id: 'btn-clear-done', label: 'Mark as not ready' }] : [],
        primary: { id: 'btn-save', tone: 'success', icon: 'bi-save', label: done ? 'Save changes' : 'Save instructions' }
      }
    });

    var ta = view.querySelector('#f-text');

    function repaint() {
      view.querySelector('#preview').innerHTML = admitPreview(stg, ta.value);
      view.querySelector('#line-count').textContent = fmt.plural(lines(ta.value).length, 'instruction');
    }
    ta.addEventListener('input', repaint);
    repaint();

    view.querySelector('#btn-preset').addEventListener('click', function () {
      ta.value = ERec.seed.DEFAULT_INSTRUCTIONS[stg.type] || '';
      repaint();
      ui.toast('Standard instructions loaded — edit as needed');
    });

    view.querySelector('#btn-save').addEventListener('click', function () {
      if (!lines(ta.value).length) { ui.toast('Add at least one instruction', 'warning'); return; }
      store.update('stages', stg.id, { instructions: ta.value });
      store.markStep(stg.id, 'instructions', { count: lines(ta.value).length });
      store.audit('SET_INSTRUCTIONS', 'stage', stg.id,
        fmt.plural(lines(ta.value).length, 'instruction') + ' saved for ' + pipe.typeLabel(stg.type));
      ui.toast('Instructions saved');
      ERec.router.refresh();
    });

    var cd = view.querySelector('#btn-clear-done');
    if (cd) cd.addEventListener('click', function () {
      store.clearStep(stg.id, 'instructions');
      ERec.router.refresh();
    });
  }

  ERec.pages.instructions = { render: render, lines: lines };
})(window);
