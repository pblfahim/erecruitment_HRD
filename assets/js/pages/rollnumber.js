/* Roll number generation - attaches to the FIRST exam stage only, whichever
   type that is (MCQ, Written or a straight Viva-Voce). */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var ORDERS = [
    ['name', 'Candidate name (A → Z)'],
    ['appNo', 'Application number'],
    ['dob', 'Date of birth (oldest first)'],
    ['district', 'Home district, then name']
  ];

  function orderedRoster(stg, orderBy) {
    var rows = store.rosterOf(stg.id).map(function (r) {
      return { row: r, a: store.applicant(r.applicantId) };
    }).filter(function (x) { return x.a; });

    if (orderBy === 'district') {
      return fmt.sortBy(rows, function (x) { return x.a.district + '|' + x.a.name; });
    }
    return fmt.sortBy(rows, function (x) { return x.a[orderBy] || ''; });
  }

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var c = store.circular(stg.circularId);
    var state = store.stepState(stg, 'roll');
    var done = !!(state && state.done);
    var step = pipe.step(stg, 'roll');

    var cfg = {
      prefix: (state && state.prefix) || String(new Date(c.applyStart || Date.now()).getFullYear()).slice(2) +
        (String(store.stagesOf(c.id).length) + '0').slice(0, 2),
      start: (state && state.start) || 1,
      padding: (state && state.padding) || 4,
      orderBy: (state && state.orderBy) || 'name'
    };

    var roster = store.rosterOf(stg.id);
    var body = ui.lockedNotice(stg, 'roll');

    if (!roster.length) {
      body += ui.alert('warn', '<strong>No candidates in this stage yet.</strong> Confirm the applicant list first.');
    }

    if (done) {
      body += ui.alert('ok', '<strong>Roll numbers generated for ' + fmt.plural(state.count || roster.length, 'candidate') + '.</strong> ' +
        'Prefix <span class="mono">' + fmt.esc(state.prefix) + '</span>, ordered by ' +
        fmt.esc((ORDERS.find(function (o) { return o[0] === state.orderBy; }) || ['', state.orderBy])[1].toLowerCase()) + '. ' +
        'Venue allocation and admit cards use these numbers.');
    }

    body += '<div class="row g-3"><div class="col-lg-4">' + ui.card({
      title: 'Generation rule',
      hint: 'Roll = prefix + running serial.',
      body:
        '<label class="form-label">Prefix</label>' +
        '<input class="form-control mono mb-3" id="f-prefix" value="' + fmt.esc(cfg.prefix) + '" maxlength="8">' +
        '<div class="row g-2 mb-3"><div class="col-6">' +
          '<label class="form-label">Start from</label>' +
          '<input type="number" min="1" class="form-control" id="f-start" value="' + cfg.start + '"></div>' +
          '<div class="col-6"><label class="form-label">Serial digits</label>' +
          '<select class="form-select" id="f-pad">' +
          [3, 4, 5, 6].map(function (p) {
            return '<option value="' + p + '"' + (p === cfg.padding ? ' selected' : '') + '>' + p + ' digits</option>';
          }).join('') + '</select></div></div>' +
        '<label class="form-label">Order candidates by</label>' +
        '<select class="form-select mb-3" id="f-order">' +
        ORDERS.map(function (o) {
          return '<option value="' + o[0] + '"' + (o[0] === cfg.orderBy ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select>' +
        '<div class="preview-box fs-13" id="sample">—</div>'
    }) + '</div><div class="col-lg-8">' + ui.card({
      title: done ? 'Allotted roll numbers' : 'Preview',
      hint: done ? 'These numbers are printed on the admit card and drive venue roll ranges.'
        : 'Nothing is saved until you press Generate.',
      actions: done ? '<button class="btn btn-sm btn-light btn-icon" id="btn-csv"><i class="bi bi-filetype-csv"></i> Export CSV</button>' : '',
      tight: true,
      body: '<div class="table-scroll" id="preview-table"></div>'
    }) + '</div></div>';

    ui.stagePage(view, stg, 'roll', {
      body: body,
      action: done
        ? {
          note: fmt.plural(roster.length, 'roll number') + ' allotted',
          secondary: [{ id: 'btn-regen', label: 'Generate again', tone: 'outline-danger' }]
        }
        : {
          primary: {
            id: 'btn-gen', tone: 'success', icon: 'bi-123',
            label: 'Generate roll numbers', disabled: !roster.length
          }
        }
    });

    /* ---- live preview ---- */
    function readCfg() {
      return {
        prefix: view.querySelector('#f-prefix').value.trim(),
        start: parseInt(view.querySelector('#f-start').value, 10) || 1,
        padding: parseInt(view.querySelector('#f-pad').value, 10) || 4,
        orderBy: view.querySelector('#f-order').value
      };
    }

    function rollAt(cfgv, i) { return cfgv.prefix + fmt.pad(cfgv.start + i, cfgv.padding); }

    function paint() {
      var v = readCfg();
      var list = orderedRoster(stg, v.orderBy);
      view.querySelector('#sample').innerHTML = list.length
        ? 'First: <strong class="mono">' + fmt.esc(rollAt(v, 0)) + '</strong><br>' +
          'Last: <strong class="mono">' + fmt.esc(rollAt(v, list.length - 1)) + '</strong><br>' +
          '<span class="muted">' + fmt.plural(list.length, 'candidate') + '</span>'
        : 'No candidates to number.';

      view.querySelector('#preview-table').innerHTML = list.length
        ? '<table class="table-x"><thead><tr><th>#</th><th>Roll</th><th>Candidate</th><th>Application no.</th>' +
          '<th>District</th></tr></thead><tbody>' +
          list.map(function (x, i) {
            var roll = done ? (x.row.rollNo || rollAt(v, i)) : rollAt(v, i);
            return '<tr><td class="num muted">' + (i + 1) + '</td>' +
              '<td class="mono fw-semibold">' + fmt.esc(roll) + '</td>' +
              '<td>' + fmt.esc(x.a.name) + '</td>' +
              '<td class="mono fs-12">' + fmt.esc(x.a.appNo) + '</td>' +
              '<td class="fs-12">' + fmt.esc(x.a.district) + '</td></tr>';
          }).join('') + '</tbody></table>'
        : ui.empty('Nothing to preview');
    }

    ['#f-prefix', '#f-start', '#f-pad', '#f-order'].forEach(function (sel) {
      var el = view.querySelector(sel);
      el.addEventListener('input', paint);
      el.addEventListener('change', paint);
    });
    paint();

    /* ---- generate ---- */
    function generate() {
      var v = readCfg();
      if (!v.prefix) { ui.toast('Prefix is required', 'warning'); return; }
      var list = orderedRoster(stg, v.orderBy);
      list.forEach(function (x, i) {
        var roll = rollAt(v, i);
        x.a.rollNo = roll;
        x.row.rollNo = roll;
      });
      /* Later stages reuse the same roll number for the same candidate. */
      store.all('stageApplicants').forEach(function (r) {
        var a = store.applicant(r.applicantId);
        if (a && a.circularId === c.id && a.rollNo) r.rollNo = a.rollNo;
      });
      store.markStep(stg.id, 'roll', {
        prefix: v.prefix, start: v.start, padding: v.padding, orderBy: v.orderBy, count: list.length
      });
      store.audit('GENERATE_ROLL', 'stage', stg.id, fmt.plural(list.length, 'roll number') + ' generated (' + v.prefix + ')');
      ui.toast(fmt.plural(list.length, 'roll number') + ' generated');
      ERec.router.refresh();
    }

    var gen = view.querySelector('#btn-gen');
    if (gen) gen.addEventListener('click', generate);

    var regen = view.querySelector('#btn-regen');
    if (regen) regen.addEventListener('click', function () {
      var venues = store.venuesOf(stg.id);
      ui.confirm({
        title: 'Re-generate roll numbers',
        body: 'Every candidate gets a new roll number.' +
          (venues.length ? ' <strong class="text-danger">' + fmt.plural(venues.length, 'venue') +
            ' already reference roll ranges and will need to be re-checked.</strong>' : ''),
        okText: 'Re-generate', danger: true
      }).then(function (ok) { if (ok) generate(); });
    });

    var csv = view.querySelector('#btn-csv');
    if (csv) csv.addEventListener('click', function () {
      ERec.exp.csv(c.post.replace(/\W+/g, '_') + '_roll_numbers.csv',
        ['Roll', 'Application No', 'Name', "Father's Name", 'Mobile', 'District'],
        store.rosterOf(stg.id).map(function (r) {
          var a = store.applicant(r.applicantId);
          return [r.rollNo, a.appNo, a.name, a.fatherName, a.mobile, a.district];
        }));
    });
  }

  ERec.pages.rollnumber = { render: render };
})(window);
