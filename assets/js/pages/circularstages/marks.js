/* Mark upload + selection, and the forward-to-next-stage step.

   Selection has two bases:
     CUTOFF     - everyone at or above a cut-off mark
     PRIVILEGED - selected under a privilege/quota, bypassing the cut-off */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var cutoffs = {}; // per stage: cut-off mark value

  /* Viva candidates rejected at scrutiny never reach the mark sheet. */
  function eligible(stg) {
    return store.rosterOf(stg.id).filter(function (r) {
      if (stg.type !== 'VIVA') return true;
      return !(r.scrutiny && r.scrutiny.status === 'REJECTED');
    });
  }

  function recalc(stg, row) {
    if (row.attendance === 'ABSENT') { row.marks = null; row.resultStatus = 'FAILED'; return; }
    if (row.marks === null || row.marks === undefined || row.marks === '') { row.resultStatus = 'PENDING'; return; }
    row.resultStatus = Number(row.marks) >= Number(stg.passMarks) ? 'PASSED' : 'FAILED';
  }

  function summary(stg) {
    var rows = eligible(stg);
    rows.forEach(function (r) { if (!r.resultStatus) recalc(stg, r); });

    var present = rows.filter(function (r) { return r.attendance === 'PRESENT'; });
    var absent = rows.filter(function (r) { return r.attendance === 'ABSENT'; });
    var marked = rows.filter(function (r) { return r.marks !== null && r.marks !== undefined && r.marks !== ''; });
    var pendingMarks = rows.filter(function (r) { return r.attendance !== 'ABSENT' && (r.marks === null || r.marks === undefined || r.marks === ''); });
    var passed = rows.filter(function (r) { return r.resultStatus === 'PASSED'; });
    var failed = rows.filter(function (r) { return r.resultStatus === 'FAILED'; });
    var selected = rows.filter(function (r) { return r.selectedForNext; });

    return {
      rows: rows,
      total: rows.length,
      present: present.length,
      absent: absent.length,
      marked: marked.length,
      pendingMarks: pendingMarks.length,
      passed: passed.length,
      failed: failed.length,
      selected: selected.length,
      selectedRows: selected,
      highest: marked.length ? Math.max.apply(null, marked.map(function (r) { return Number(r.marks); })) : 0,
      average: marked.length ? Math.round(marked.reduce(function (s, r) { return s + Number(r.marks); }, 0) / marked.length) : 0
    };
  }

  /* ---------- mark import: Excel file, CSV file, or pasted rows ---------- */

  /* SheetJS is fetched only when an .xlsx is actually chosen, so the app
     still works offline as long as marks come in as CSV. */
  function loadXlsx() {
    return new Promise(function (resolve, reject) {
      if (global.XLSX) { resolve(global.XLSX); return; }
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = function () { global.XLSX ? resolve(global.XLSX) : reject(new Error('loaded but unavailable')); };
      s.onerror = function () { reject(new Error('could not be downloaded')); };
      document.head.appendChild(s);
    });
  }

  /* Both readers end up as an array of [roll, marks] pairs. */
  function rowsFromCsv(text) {
    return text.split(/\r?\n/).map(function (line) {
      return line.split(/[,;\t]/).map(function (c) { return c.trim().replace(/^"|"$/g, ''); });
    }).filter(function (c) { return c.length && c.join(''); });
  }

  function downloadTemplate(stg) {
    var rows = eligible(stg).map(function (r) {
      var a = store.applicant(r.applicantId);
      return [r.rollNo || '', a.name, ''];
    });
    ERec.exp.csv('marks_template_' + stg.id + '.csv', ['Roll', 'Candidate', 'Marks'], rows);
  }

  function importModal(stg, after) {
    ui.modal({
      title: 'Import marks',
      size: 'lg',
      body:
        ui.alert('info', 'Upload the filled mark sheet as <strong>Excel (.xlsx/.xls)</strong> or ' +
          '<strong>CSV</strong>, or paste the rows below. The first two columns must be ' +
          '<strong>roll number</strong> and <strong>marks</strong>; a header row is ignored. ' +
          'Write <code>absent</code> in place of a mark to record absence.') +
        '<div class="mb-3"><label class="form-label">Choose a file</label>' +
        '<input type="file" class="form-control" id="f-file" accept=".xlsx,.xls,.csv,text/csv"></div>' +
        '<label class="form-label">…or paste rows</label>' +
        '<textarea class="form-control mono" id="f-paste" rows="8" placeholder="26010001,72&#10;26010002,absent&#10;26010003,65"></textarea>' +
        '<div class="preview-box mt-2 fs-12" id="p-out">Nothing read yet.</div>',
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" data-act="go">Apply to mark sheet</button>',
      onShow: function (api) {
        var rows = eligible(stg);
        var parsed = [];

        function evaluate(cells) {
          var out = [], bad = [];
          cells.forEach(function (c) {
            if (c.length < 2) return;
            var roll = String(c[0]).trim();
            var mark = String(c[1]).trim();
            if (!roll || /^roll/i.test(roll)) return; // header row
            var row = rows.find(function (r) { return String(r.rollNo) === roll; });
            if (!row) { bad.push(roll + ' (not on this list)'); return; }
            if (/^(a|ab|absent)$/i.test(mark)) out.push({ row: row, absent: true });
            else if (mark !== '' && !isNaN(parseFloat(mark))) out.push({ row: row, marks: parseFloat(mark) });
            else if (mark !== '') bad.push(roll + ' (“' + mark + '” is not a mark)');
          });
          parsed = out;
          var over = out.filter(function (o) { return !o.absent && o.marks > stg.fullMarks; }).length;
          api.find('#p-out').innerHTML =
            '<strong>' + out.length + '</strong> row(s) ready to apply' +
            (over ? '<br><span class="text-warning">' + over + ' above the full mark of ' + stg.fullMarks + ' — they will be capped.</span>' : '') +
            (bad.length ? '<br><span class="text-danger">' + bad.length + ' row(s) skipped: ' +
              fmt.esc(bad.slice(0, 3).join(' · ')) + (bad.length > 3 ? '…' : '') + '</span>' : '');
          return out;
        }

        api.find('#f-paste').addEventListener('input', function (e) {
          evaluate(rowsFromCsv(e.target.value));
        });

        api.find('#f-file').addEventListener('change', function (e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;
          var isExcel = /\.xls[xm]?$/i.test(file.name);
          api.find('#p-out').textContent = 'Reading ' + file.name + '…';

          if (!isExcel) {
            var fr = new FileReader();
            fr.onload = function () { evaluate(rowsFromCsv(String(fr.result))); };
            fr.onerror = function () { api.find('#p-out').innerHTML = '<span class="text-danger">Could not read that file.</span>'; };
            fr.readAsText(file);
            return;
          }

          loadXlsx().then(function (XLSX) {
            var fr = new FileReader();
            fr.onload = function () {
              try {
                var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
                var sheet = wb.Sheets[wb.SheetNames[0]];
                var aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
                evaluate(aoa.map(function (r) { return r.map(function (c) { return c === undefined ? '' : c; }); }));
              } catch (err) {
                api.find('#p-out').innerHTML = '<span class="text-danger">That workbook could not be read: ' +
                  fmt.esc(err.message) + '</span>';
              }
            };
            fr.readAsArrayBuffer(file);
          }).catch(function (err) {
            api.find('#p-out').innerHTML = '<span class="text-danger">The Excel reader ' + fmt.esc(err.message) +
              ' (it is downloaded on demand and needs internet). Save the sheet as <strong>CSV</strong> ' +
              'and upload that instead.</span>';
          });
        });

        api.find('[data-act="go"]').addEventListener('click', function () {
          if (!parsed.length) { ui.toast('Nothing to import yet', 'warning'); return; }
          parsed.forEach(function (o) {
            if (o.absent) { o.row.attendance = 'ABSENT'; o.row.marks = null; }
            else {
              o.row.attendance = 'PRESENT';
              o.row.marks = Math.max(0, Math.min(Number(stg.fullMarks), o.marks));
            }
            recalc(stg, o.row);
          });
          store.save();
          store.audit('IMPORT_MARKS', 'stage', stg.id, fmt.plural(parsed.length, 'mark') + ' imported');
          var n = parsed.length;
          api.close();
          ui.toast(fmt.plural(n, 'mark') + ' imported');
          after();
        });
      }
    });
  }

  /* ---------- mark upload page ---------- */

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var c = store.circular(stg.circularId);
    var s = summary(stg);
    var done = store.isStepDone(stg, 'marks');
    var cut = cutoffs[stg.id] = (cutoffs[stg.id] === undefined ? stg.passMarks : cutoffs[stg.id]);
    var isLast = pipe.context(stg).isLast;

    var body = ui.lockedNotice(stg, 'marks');

    /* 6 Modern Metric KPI Cards Row */
    body += '<div class="row g-3 mb-3">' +
      // Stat 1: Total Candidates
      '<div class="col-12 col-sm-6 col-lg-4 col-xl-2">' +
      '<div class="stat-card-modern shadow-2xs h-100 bg-white border p-3 rounded-3">' +
      '<div class="d-flex align-items-center justify-content-between">' +
      '<div>' +
      '<span class="text-secondary fw-semibold small text-uppercase" style="letter-spacing:0.5px; font-size:11px;">Total</span>' +
      '<h3 class="fw-bold mb-0 mt-1 text-dark">' + s.total + '</h3>' +
      '</div>' +
      '<div class="stat-icon-badge bg-primary-subtle text-primary">' +
      '<i class="bi bi-people-fill"></i>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      // Stat 2: Present
      '<div class="col-12 col-sm-6 col-lg-4 col-xl-2">' +
      '<div class="stat-card-modern shadow-2xs h-100 bg-white border p-3 rounded-3">' +
      '<div class="d-flex align-items-center justify-content-between">' +
      '<div>' +
      '<span class="text-secondary fw-semibold small text-uppercase" style="letter-spacing:0.5px; font-size:11px;">Present</span>' +
      '<h3 class="fw-bold mb-0 mt-1 text-success">' + s.present + '</h3>' +
      '</div>' +
      '<div class="stat-icon-badge bg-success-subtle text-success">' +
      '<i class="bi bi-person-check-fill"></i>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      // Stat 3: Absent
      '<div class="col-12 col-sm-6 col-lg-4 col-xl-2">' +
      '<div class="stat-card-modern shadow-2xs h-100 bg-white border p-3 rounded-3">' +
      '<div class="d-flex align-items-center justify-content-between">' +
      '<div>' +
      '<span class="text-secondary fw-semibold small text-uppercase" style="letter-spacing:0.5px; font-size:11px;">Absent</span>' +
      '<h3 class="fw-bold mb-0 mt-1 ' + (s.absent ? 'text-danger' : 'text-muted') + '">' + s.absent + '</h3>' +
      '</div>' +
      '<div class="stat-icon-badge ' + (s.absent ? 'bg-danger-subtle text-danger' : 'bg-light text-muted') + '">' +
      '<i class="bi bi-person-x-fill"></i>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      // Stat 4: Marks Entered
      '<div class="col-12 col-sm-6 col-lg-4 col-xl-2">' +
      '<div class="stat-card-modern shadow-2xs h-100 bg-white border p-3 rounded-3">' +
      '<div class="d-flex align-items-center justify-content-between">' +
      '<div>' +
      '<span class="text-secondary fw-semibold small text-uppercase" style="letter-spacing:0.5px; font-size:11px;">Marks Entered</span>' +
      '<h3 class="fw-bold mb-0 mt-1 text-primary">' + s.marked + ' <small class="fs-12 text-muted fw-normal">/ ' + s.total + '</small></h3>' +
      '</div>' +
      '<div class="stat-icon-badge bg-info-subtle text-info">' +
      '<i class="bi bi-pencil-square"></i>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      // Stat 5: Passed
      '<div class="col-12 col-sm-6 col-lg-4 col-xl-2">' +
      '<div class="stat-card-modern shadow-2xs h-100 bg-white border p-3 rounded-3">' +
      '<div class="d-flex align-items-center justify-content-between">' +
      '<div>' +
      '<span class="text-secondary fw-semibold small text-uppercase" style="letter-spacing:0.5px; font-size:11px;">Passed</span>' +
      '<h3 class="fw-bold mb-0 mt-1 text-success">' + s.passed + '</h3>' +
      '</div>' +
      '<div class="stat-icon-badge bg-success-subtle text-success">' +
      '<i class="bi bi-award-fill"></i>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      // Stat 6: Selected
      '<div class="col-12 col-sm-6 col-lg-4 col-xl-2">' +
      '<div class="stat-card-modern shadow-2xs h-100 bg-white border p-3 rounded-3">' +
      '<div class="d-flex align-items-center justify-content-between">' +
      '<div>' +
      '<span class="text-secondary fw-semibold small text-uppercase" style="letter-spacing:0.5px; font-size:11px;">Selected</span>' +
      '<h3 class="fw-bold mb-0 mt-1 text-primary">' + s.selected + '</h3>' +
      '</div>' +
      '<div class="stat-icon-badge bg-primary-subtle text-primary">' +
      '<i class="bi bi-check-circle-fill"></i>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>';

    /* Mark sheet rows HTML (With selection checkbox column) */
    var allSelected = s.rows.length > 0 && s.rows.every(function (r) { return r.selectedForNext; });
    var rowsHtml = s.rows.map(function (r) {
      var a = store.applicant(r.applicantId) || {};
      var absent = r.attendance === 'ABSENT';
      var initials = (a.name || 'C').charAt(0).toUpperCase();

      var basisPill = r.selectedForNext
        ? (r.selectionBasis === 'PRIVILEGED'
          ? '<span class="badge bg-purple-subtle text-purple border border-purple-subtle rounded-pill px-2 py-0.5 fs-11 fw-semibold" title="' + fmt.esc(r.privilegeNote || '') + '"><i class="bi bi-star-fill text-warning me-1"></i>Privilege</span>'
          : '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5 fs-11 fw-semibold"><i class="bi bi-funnel me-1"></i>Cut-off</span>')
        : '<span class="text-muted fs-12">—</span>';

      var resultBadge = r.resultStatus === 'PASSED'
        ? '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5 fs-11 fw-semibold"><i class="bi bi-check2 me-1"></i>PASSED</span>'
        : (r.resultStatus === 'FAILED'
          ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2 py-0.5 fs-11 fw-semibold"><i class="bi bi-x me-1"></i>FAILED</span>'
          : '<span class="badge bg-secondary-subtle text-secondary rounded-pill px-2 py-0.5 fs-11 fw-normal">PENDING</span>');

      return '<tr data-row="' + r.id + '"' + (r.selectedForNext ? ' class="row-sel"' : '') + '>' +
        '<td class="text-center">' +
        '<input type="checkbox" class="form-check-input" data-sel="' + r.id + '"' + (r.selectedForNext ? ' checked' : '') + '>' +
        '</td>' +
        '<td class="mono fw-semibold text-dark nowrap">' + fmt.esc(r.rollNo || '—') + '</td>' +
        '<td>' +
        '<div class="d-flex align-items-center gap-2">' +
        '<div class="avatar sm rounded-circle bg-light text-primary border fw-bold fs-12 d-flex align-items-center justify-content-center" style="width:30px; height:30px; min-width:30px;">' +
        initials +
        '</div>' +
        '<div class="text-truncate" style="max-width: 220px;">' +
        '<div class="fw-semibold text-dark fs-13 text-truncate">' + fmt.esc(a.name || '—') + '</div>' +
        '<div class="text-muted fs-11 text-truncate">' + fmt.esc(a.fatherName || 'Father: —') + '</div>' +
        '</div>' +
        '</div>' +
        '</td>' +
        (stg.type === 'VIVA' ? '<td>' + (r.scrutiny ? ui.statusPill(r.scrutiny.status) : '<span class="text-muted fs-12">not scrutinised</span>') + '</td>' : '') +
        '<td>' +
        '<select class="form-select form-select-sm fw-semibold ' + (r.attendance === 'PRESENT' ? 'text-success border-success-subtle' : (absent ? 'text-danger border-danger-subtle' : 'text-muted')) + '" data-att="' + r.id + '" style="width:110px">' +
        '<option value=""' + (!r.attendance ? ' selected' : '') + '>— Select —</option>' +
        '<option value="PRESENT"' + (r.attendance === 'PRESENT' ? ' selected' : '') + ' class="text-success">Present</option>' +
        '<option value="ABSENT"' + (absent ? ' selected' : '') + ' class="text-danger">Absent</option>' +
        '</select>' +
        '</td>' +
        '<td>' +
        '<div class="d-flex align-items-center gap-1" style="max-width: 110px;">' +
        '<input type="number" min="0" max="' + stg.fullMarks + '" class="form-control form-control-sm text-center fw-bold font-monospace" ' +
        'data-mark="' + r.id + '" value="' + (r.marks === null || r.marks === undefined ? '' : r.marks) + '"' +
        'placeholder="—"' + (absent ? ' disabled' : '') + '>' +
        '<span class="fs-11 text-muted">/' + stg.fullMarks + '</span>' +
        '</div>' +
        '</td>' +
        '<td>' + resultBadge + '</td>' +
        '<td>' + basisPill + '</td>' +
        '<td class="text-center">' +
        '<button class="btn btn-sm ' + (r.selectionBasis === 'PRIVILEGED' ? 'btn-warning text-dark' : 'btn-outline-secondary') + '" data-priv="' + r.id + '" title="' + (r.selectionBasis === 'PRIVILEGED' ? 'Privilege: ' + fmt.esc(r.privilegeNote || '') : 'Select on privilege / quota') + '">' +
        '<i class="bi bi-star' + (r.selectionBasis === 'PRIVILEGED' ? '-fill' : '') + '"></i>' +
        '</button>' +
        '</td>' +
        '</tr>';
    }).join('');

    /* Mark Sheet Card */
    body += ui.card({
      title: 'Mark sheet · ' + fmt.esc(pipe.typeLabel(stg.type)),
      hint: 'Type a mark against each candidate, or import them in bulk.',
      actions:
        '<div class="d-flex align-items-center gap-2 flex-wrap">' +
        '<div class="marks-cfg d-flex align-items-center gap-2">' +
        '<span>Full marks</span>' +
        '<input type="number" min="1" class="form-control form-control-sm font-monospace text-center fw-bold" style="width:60px;" data-cfg="full" value="' + stg.fullMarks + '">' +
        '<span>Pass marks</span>' +
        '<input type="number" min="0" class="form-control form-control-sm font-monospace text-center fw-bold" style="width:60px;" data-cfg="pass" value="' + stg.passMarks + '">' +
        '</div>' +
        '<div class="marks-cfg d-flex align-items-center gap-2">' +
        '<span>Cut-off</span>' +
        '<input type="number" min="0" max="' + stg.fullMarks + '" class="form-control form-control-sm font-monospace text-center fw-bold" style="width:60px;" id="f-cut" value="' + cut + '">' +
        '<button class="btn btn-sm btn-primary btn-icon px-2 py-1 fs-12" id="btn-apply-cut" title="Apply cut-off mark to select candidates">' +
        '<i class="bi bi-funnel-fill"></i> Apply' +
        '</button>' +
        '</div>' +
        '<div id="cut-preview" class="d-inline-block"></div>' +
        '<button class="btn btn-sm btn-outline-secondary btn-icon ms-1" id="btn-csv"><i class="bi bi-filetype-csv"></i> Export CSV</button>' +
        '<button class="btn btn-sm btn-outline-secondary btn-icon ms-1" id="btn-print"><i class="bi bi-printer"></i> Result sheet</button>' +
        '</div>',
      tight: true,
      body:
        /* Bulk upload banner (Download template button removed) */
        '<div class="import-strip p-3 bg-light border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">' +
        '<div class="d-flex align-items-center gap-3">' +
        '<div class="avatar md rounded-circle bg-white text-success border d-flex align-items-center justify-content-center shadow-2xs">' +
        '<i class="bi bi-file-earmark-arrow-up fs-5"></i>' +
        '</div>' +
        '<div>' +
        '<div class="fw-bold text-dark fs-13">Upload the filled mark sheet</div>' +
        '<div class="text-muted fs-11">Excel (.xlsx / .xls) or CSV — or type the marks into the grid below.</div>' +
        '</div>' +
        '</div>' +
        '<div>' +
        '<button class="btn btn-sm btn-green-solid btn-icon" id="btn-import">' +
        '<i class="bi bi-upload"></i> Import marks' +
        '</button>' +
        '</div>' +
        '</div>' +

        '<div class="p-3">' +
        (s.rows.length
          ? '<div class="table-scroll"><table class="table table-striped table-hover align-middle table-x mb-0" id="table-marks"><thead><tr>' +
          '<th style="width:34px" class="text-center" data-orderable="false">' +
          '<input type="checkbox" class="form-check-input" id="th-select-all" title="Select / Deselect all"' + (allSelected ? ' checked' : '') + '>' +
          '</th>' +
          '<th>Roll</th>' +
          '<th>Candidate</th>' +
          (stg.type === 'VIVA' ? '<th>Scrutiny</th>' : '') +
          '<th>Attendance</th>' +
          '<th>Marks</th>' +
          '<th>Result</th>' +
          '<th>Selection</th>' +
          '<th data-orderable="false" class="text-center">Quota</th>' +
          '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>'
          : ui.empty('No candidate on this roster', 'Confirm the applicant list first.', 'bi-clipboard-data')) +
        '</div>'
    });

    var awaiting = s.total - s.marked - s.absent;
    ui.stagePage(view, stg, 'marks', {
      body: body,
      action: done
        ? {
          note: awaiting
            ? '<span class="text-warning fw-semibold">' + fmt.plural(awaiting, 'candidate') + ' still without a mark</span>'
            : fmt.plural(s.selected, 'candidate') + ' selected',
          secondary: [{ id: 'btn-reopen', label: 'Take more / fewer candidates' }],
          primary: awaiting
            ? { id: 'btn-accept', tone: 'success', icon: 'bi-check2-circle', label: 'Update the selection' }
            : null
        }
        : {
          note: awaiting ? fmt.plural(awaiting, 'candidate') + ' still without a mark' : '',
          primary: {
            id: 'btn-accept', tone: 'success', icon: 'bi-check2-circle',
            label: 'Accept ' + fmt.plural(s.selected, 'selected candidate'), disabled: !s.selected
          }
        }
    });

    if (s.rows.length) {
      ui.dataTable(view.querySelector('#table-marks'), { pageLength: 25 });
    }

    /* ---- full / pass marks, edited in context ---- */
    ui.on(view, '[data-cfg]', 'change', function (e, inp) {
      var patch = {};
      var v = parseInt(inp.value, 10);
      if (isNaN(v) || v < 0) { ui.toast('Enter a valid number', 'warning'); ERec.router.refresh(); return; }
      patch[inp.dataset.cfg === 'full' ? 'fullMarks' : 'passMarks'] = v;
      store.update('stages', stg.id, patch);
      s.rows.forEach(function (r) { recalc(store.stage(stg.id), r); });
      store.save();
      ui.toast((inp.dataset.cfg === 'full' ? 'Full' : 'Pass') + ' marks set to ' + v);
      ERec.router.refresh();
    });

    /* ---- mark entry ---- */
    ui.on(view, '[data-mark]', 'change', function (e, inp) {
      var r = store.find('stageApplicants', inp.dataset.mark);
      var v = inp.value === '' ? null : Math.max(0, Math.min(Number(stg.fullMarks), Number(inp.value)));
      r.marks = v;
      if (v !== null && !r.attendance) r.attendance = 'PRESENT';
      recalc(stg, r);
      store.save();
      ERec.router.refresh();
    });

    ui.on(view, '[data-att]', 'change', function (e, sel) {
      var r = store.find('stageApplicants', sel.dataset.att);
      r.attendance = sel.value || null;
      if (r.attendance === 'ABSENT') { r.marks = null; r.selectedForNext = false; r.selectionBasis = null; }
      recalc(stg, r);
      store.save();
      ERec.router.refresh();
    });

    /* ---- cut-off preview & apply ---- */
    var cutInput = view.querySelector('#f-cut');
    if (cutInput) {
      function preview() {
        var v = Number(cutInput.value);
        var qualifying = s.rows.filter(function (r) {
          return r.attendance === 'PRESENT' && r.marks !== null && Number(r.marks) >= v;
        }).length;
        var prevEl = view.querySelector('#cut-preview');
        if (prevEl) {
          prevEl.innerHTML =
            '<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 fs-12 fw-semibold">' +
            '<i class="bi bi-check2-all me-1"></i><strong>' + qualifying + '</strong> candidates qualify' +
            (c.vacancies ? ' &middot; Vacancies: <span class="fw-bold text-dark">' + c.vacancies + '</span>' : '') +
            '</span>';
        }
      }
      cutInput.addEventListener('input', function () { cutoffs[stg.id] = Number(cutInput.value); preview(); });
      preview();
    }

    var applyCut = view.querySelector('#btn-apply-cut');
    if (applyCut) applyCut.addEventListener('click', function () {
      var v = Number(cutInput.value);
      var n = 0;
      s.rows.forEach(function (r) {
        /* privilege selections survive a cut-off run */
        if (r.selectionBasis === 'PRIVILEGED' && r.selectedForNext) { n++; return; }
        var pass = r.attendance === 'PRESENT' && r.marks !== null && Number(r.marks) >= v;
        r.selectedForNext = pass;
        r.selectionBasis = pass ? 'CUTOFF' : null;
        if (pass) n++;
      });
      cutoffs[stg.id] = v;
      store.save();
      ui.toast(fmt.plural(n, 'candidate') + ' selected at cut-off ' + v);
      ERec.router.refresh();
    });

    ui.on(view, '[data-priv]', 'click', function (e, b) {
      var r = store.find('stageApplicants', b.dataset.priv);
      var a = store.applicant(r.applicantId);
      if (r.selectionBasis === 'PRIVILEGED') {
        r.selectedForNext = false; r.selectionBasis = null; r.privilegeNote = '';
        store.save(); ui.toast('Privilege selection removed'); ERec.router.refresh();
        return;
      }
      ui.modal({
        title: 'Select on privilege · ' + fmt.esc(a.name),
        body: '<p class="fs-13">Selecting this candidate for the next stage regardless of the cut-off mark. ' +
          'The basis is recorded against the candidate.</p>' +
          '<label class="form-label">Ground / quota</label>' +
          '<input class="form-control" id="f-note" placeholder="e.g. Freedom fighter quota, departmental candidate">',
        footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
          '<button class="btn btn-sm btn-primary" data-act="go">Select on privilege</button>',
        onShow: function (api) {
          api.find('[data-act="go"]').addEventListener('click', function () {
            var note = api.find('#f-note').value.trim();
            if (!note) { ui.toast('State the ground for privilege selection', 'warning'); return; }
            r.selectedForNext = true; r.selectionBasis = 'PRIVILEGED'; r.privilegeNote = note;
            store.save();
            store.audit('PRIVILEGE_SELECT', 'applicant', a.id, a.name + ' selected on privilege — ' + note);
            api.close();
            ui.toast(a.name + ' selected on privilege');
            ERec.router.refresh();
          });
        }
      });
    });

    /* ---- select all / individual row checkboxes ---- */
    ui.on(view, '#th-select-all', 'change', function (e, chk) {
      var isChecked = chk.checked;
      s.rows.forEach(function (r) {
        r.selectedForNext = isChecked;
        if (isChecked) {
          if (r.selectionBasis !== 'PRIVILEGED') r.selectionBasis = 'CUTOFF';
        } else {
          if (r.selectionBasis !== 'PRIVILEGED') r.selectionBasis = null;
        }
      });
      store.save();
      ui.toast(isChecked ? fmt.plural(s.rows.length, 'candidate') + ' selected' : 'Selections cleared');
      ERec.router.refresh();
    });

    ui.on(view, '[data-sel]', 'change', function (e, cb) {
      var r = store.find('stageApplicants', cb.dataset.sel);
      if (!r) return;
      r.selectedForNext = cb.checked;
      if (cb.checked) {
        if (r.selectionBasis !== 'PRIVILEGED') r.selectionBasis = 'CUTOFF';
      } else {
        if (r.selectionBasis !== 'PRIVILEGED') r.selectionBasis = null;
      }
      store.save();
      ERec.router.refresh();
    });

    var selectAllEl = view.querySelector('#th-select-all');
    if (selectAllEl) {
      var anySelected = s.rows.some(function (r) { return r.selectedForNext; });
      var allSelectedState = s.rows.length > 0 && s.rows.every(function (r) { return r.selectedForNext; });
      selectAllEl.checked = allSelectedState;
      selectAllEl.indeterminate = !allSelectedState && anySelected;
    }

    /* ---- import / export ---- */
    view.querySelector('#btn-import').addEventListener('click', function () {
      importModal(stg, function () { ERec.router.refresh(); });
    });
    view.querySelector('#btn-csv').addEventListener('click', function () {
      ERec.exp.csv(c.post.replace(/\W+/g, '_') + '_' + pipe.typeLabel(stg.type) + '_marks.csv',
        ['Roll', 'Name', 'Attendance', 'Marks', 'Full Marks', 'Result', 'Selected', 'Basis'],
        s.rows.map(function (r) {
          var a = store.applicant(r.applicantId);
          return [r.rollNo, a.name, r.attendance || '', r.marks === null ? '' : r.marks,
          stg.fullMarks, r.resultStatus, r.selectedForNext ? 'Yes' : 'No', r.selectionBasis || ''];
        }));
    });
    view.querySelector('#btn-print').addEventListener('click', function () {
      ERec.exp.printDoc('result', stg.id);
    });

    /* ---- accept ---- */
    var accept = view.querySelector('#btn-accept');
    if (accept) accept.addEventListener('click', function () {
      var unmarked = s.total - s.marked - s.absent;
      ui.confirm({
        title: 'Accept mark upload',
        body: fmt.plural(s.selected, 'candidate') + ' will be carried to the next step.' +
          (unmarked > 0 ? ' <strong class="text-danger">' + fmt.plural(unmarked, 'candidate') +
            ' still have no mark or attendance recorded.</strong>' : ''),
        okText: 'Accept'
      }).then(function (ok) {
        if (!ok) return;
        store.markStep(stg.id, 'marks', {
          entered: s.marked, selected: s.selected,
          basis: 'CUTOFF', cutOff: cutoffs[stg.id]
        });
        store.update('stages', stg.id, { status: 'COMPLETED' });
        store.audit('UPLOAD_MARKS', 'stage', stg.id,
          pipe.typeLabel(stg.type) + ' marks accepted — ' + s.selected + ' selected');
        ui.toast('Mark upload accepted');
        var next = pipe.context(stg).isLast ? 'result' : 'forward';
        ERec.router.go('#/circular/' + c.id + '/stage/' + stg.id + '/' + next);
      });
    });

    var reopen = view.querySelector('#btn-reopen');
    if (reopen) reopen.addEventListener('click', function () {
      ui.confirm({
        title: 'Update the selected list',
        body: 'Re-open mark upload so you can take more or fewer candidates. ' +
          'Anything already forwarded stays until you forward again.',
        okText: 'Re-open'
      }).then(function (ok) {
        if (!ok) return;
        store.clearStep(stg.id, 'marks');
        ui.toast('Mark upload re-opened');
        ERec.router.refresh();
      });
    });
  }

  /* ---------- forward to next stage ---------- */

  function renderForward(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var c = store.circular(stg.circularId);
    var targets = pipe.forwardTargets(stg);
    var s = summary(stg);
    var state = store.stepState(stg, 'forward');
    var done = !!(state && state.done);
    var panels = store.panelsOf(stg.id);

    var chosenTarget = (state && state.targetStageId) || (targets[0] && targets[0].id);

    var body = ui.lockedNotice(stg, 'forward');

    body += '<div class="row g-3"><div class="col-lg-5">' + ui.card({
      title: 'Forward to',
      body: targets.length
        ? targets.map(function (t) {
          return '<div class="form-check mb-2">' +
            '<input class="form-check-input" type="radio" name="tgt" value="' + t.id + '" id="t-' + t.id + '"' +
            (t.id === chosenTarget ? ' checked' : '') + (done ? ' disabled' : '') + '>' +
            '<label class="form-check-label" for="t-' + t.id + '">' +
            '<span class="fw-semibold">Stage ' + t.seq + ' · ' + fmt.esc(pipe.typeLabel(t.type)) + '</span>' +
            '<span class="d-block fs-12 muted">' + fmt.plural(store.rosterOf(t.id).length, 'candidate') + ' already on that roster</span>' +
            '</label></div>';
        }).join('')
        : ui.empty('No later stage configured')
    }) + ui.card({
      title: 'Interview panels',
      hint: 'Optional — split the call list into panels with their own date and slot.',
      actions: '<button class="btn btn-sm btn-light btn-icon" id="btn-panel"><i class="bi bi-people"></i> Generate panels</button>',
      body: panels.length
        ? panels.map(function (p) {
          return '<div class="d-flex align-items-center gap-2 border rounded p-2 mb-2">' +
            '<span class="pill blue">' + fmt.esc(p.name) + '</span>' +
            '<div class="flex-grow-1 fs-12"><div>' + fmt.plural(p.applicantIds.length, 'candidate') + '</div>' +
            '<div class="muted">' + fmt.date(p.slotDate) + ' · ' + fmt.esc(p.members.join(', ')) + '</div></div>' +
            '<button class="btn btn-sm btn-outline-danger" data-delpanel="' + p.id + '"><i class="bi bi-trash"></i></button>' +
            '</div>';
        }).join('')
        : '<div class="fs-13 muted">No panel created. Candidates will be called as one list.</div>'
    }) + '</div><div class="col-lg-7">' + ui.card({
      title: 'Selected candidates',
      hint: 'This is the list that moves forward.',
      actions: '<button class="btn btn-sm btn-light btn-icon" id="btn-csv2"><i class="bi bi-filetype-csv"></i> Export</button>',
      tight: true,
      body: s.selectedRows.length
        ? '<div class="table-scroll"><table class="table table-striped table-hover align-middle table-x" id="table-forward-marks"><thead><tr><th>Roll</th><th>Candidate</th>' +
        '<th class="num">Marks</th><th>Basis</th><th>Panel</th></tr></thead><tbody>' +
        fmt.sortBy(s.selectedRows, function (r) { return -Number(r.marks || 0); }).map(function (r) {
          var a = store.applicant(r.applicantId);
          var p = panels.find(function (x) { return x.applicantIds.indexOf(r.applicantId) >= 0; });
          return '<tr><td class="mono">' + fmt.esc(r.rollNo) + '</td>' +
            '<td>' + fmt.esc(a.name) + '</td>' +
            '<td class="num">' + (r.marks === null ? '—' : r.marks + ' / ' + stg.fullMarks) + '</td>' +
            '<td>' + (r.selectionBasis === 'PRIVILEGED'
              ? ui.pill('Privilege', 'purple', 'bi-star-fill') + '<div class="fs-12 muted mt-1">' + fmt.esc(r.privilegeNote || '') + '</div>'
              : ui.pill('Cut-off', 'green')) + '</td>' +
            '<td class="fs-12">' + (p ? fmt.esc(p.name) : '<span class="muted">—</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : ui.empty('Nothing selected yet', 'Go back to Mark Upload and select candidates.', 'bi-people')
    }) + '</div></div>';

    ui.stagePage(view, stg, 'forward', {
      body: body,
      action: done
        ? {
          note: fmt.plural(state.count, 'candidate') + ' already sent forward',
          secondary: [{ id: 'btn-undo', label: 'Send more forward' }]
        }
        : {
          primary: {
            id: 'btn-forward', tone: 'success', icon: 'bi-arrow-right-circle',
            label: 'Send ' + fmt.plural(s.selected, 'candidate') + ' forward',
            disabled: !targets.length || !s.selected
          }
        }
    });

    if (s.selectedRows.length) {
      ui.dataTable(view.querySelector('#table-forward-marks'), { pageLength: 10 });
    }

    ui.on(view, 'input[name="tgt"]', 'change', function (e, r) { chosenTarget = r.value; });

    var fwd = view.querySelector('#btn-forward');
    if (fwd) fwd.addEventListener('click', function () {
      var target = store.stage(chosenTarget);
      ui.confirm({
        title: 'Forward candidates',
        body: fmt.plural(s.selected, 'candidate') + ' will be enrolled into <strong>' +
          fmt.esc(pipe.typeLabel(target.type)) + '</strong>. Their roll numbers carry over.',
        okText: 'Forward'
      }).then(function (ok) {
        if (!ok) return;
        var added = 0;
        s.selectedRows.forEach(function (r) {
          if (store.rosterRow(target.id, r.applicantId)) return;
          store.insert('stageApplicants', {
            id: fmt.uid('sa'), stageId: target.id, applicantId: r.applicantId, rollNo: r.rollNo,
            venueId: null, attendance: null, marks: null, resultStatus: 'PENDING',
            selectedForNext: false, selectionBasis: null, scrutiny: null, panelId: null
          });
          added++;
        });
        store.markStep(stg.id, 'forward', { targetStageId: target.id, count: s.selected });
        store.markStep(target.id, 'search', { count: store.rosterOf(target.id).length });
        store.audit('FORWARD', 'stage', stg.id,
          fmt.plural(added, 'candidate') + ' forwarded from ' + pipe.typeLabel(stg.type) + ' to ' + pipe.typeLabel(target.type));
        ui.toast(fmt.plural(added, 'candidate') + ' forwarded to ' + pipe.typeLabel(target.type));
        ERec.router.go('#/circular/' + c.id + '/stage/' + target.id);
      });
    });

    var undo = view.querySelector('#btn-undo');
    if (undo) undo.addEventListener('click', function () {
      ui.confirm({
        title: 'Revise forwarded list',
        body: 'The forward step is re-opened. Candidates already on the next stage are not removed — ' +
          'forwarding again only adds the ones that are missing.',
        okText: 'Re-open'
      }).then(function (ok) {
        if (!ok) return;
        store.clearStep(stg.id, 'forward');
        ERec.router.refresh();
      });
    });

    var panelBtn = view.querySelector('#btn-panel');
    if (panelBtn) panelBtn.addEventListener('click', function () {
      if (!s.selectedRows.length) { ui.toast('Select candidates first', 'warning'); return; }
      ui.modal({
        title: 'Generate interview panels',
        body: '<div class="row g-3">' +
          '<div class="col-6"><label class="form-label">Number of panels</label>' +
          '<input type="number" min="1" max="8" class="form-control" id="p-n" value="2"></div>' +
          '<div class="col-6"><label class="form-label">First panel date</label>' +
          '<input type="date" class="form-control" id="p-date" value="' + fmt.addDays(fmt.isoDate(), 14) + '"></div>' +
          '<div class="col-12"><label class="form-label">Board members (comma separated)</label>' +
          '<input class="form-control" id="p-mem" value="Chairman, Member (HR), Member (Technical)"></div>' +
          '</div><div class="form-text mt-2">Candidates are distributed in roll order, one panel per day.</div>',
        footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
          '<button class="btn btn-sm btn-primary" data-act="go">Create panels</button>',
        onShow: function (api) {
          api.find('[data-act="go"]').addEventListener('click', function () {
            var n = Math.max(1, Math.min(8, parseInt(api.find('#p-n').value, 10) || 1));
            var date = api.find('#p-date').value;
            var members = api.find('#p-mem').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
            store.panelsOf(stg.id).forEach(function (p) { store.remove('panels', p.id); });
            var ordered = fmt.sortBy(s.selectedRows, 'rollNo');
            var size = Math.ceil(ordered.length / n);
            for (var i = 0; i < n; i++) {
              var chunk = ordered.slice(i * size, (i + 1) * size);
              if (!chunk.length) continue;
              var pid = fmt.uid('pnl');
              store.insert('panels', {
                id: pid, stageId: stg.id, name: 'Panel ' + String.fromCharCode(65 + i),
                members: members, slotDate: fmt.addDays(date, i),
                applicantIds: chunk.map(function (x) { return x.applicantId; })
              });
              chunk.forEach(function (x) { x.panelId = pid; });
            }
            store.save();
            api.close();
            ui.toast(n + ' panel(s) created');
            ERec.router.refresh();
          });
        }
      });
    });

    ui.on(view, '[data-delpanel]', 'click', function (e, b) {
      store.remove('panels', b.dataset.delpanel);
      ui.toast('Panel removed');
      ERec.router.refresh();
    });

    var csv2 = view.querySelector('#btn-csv2');
    if (csv2) csv2.addEventListener('click', function () {
      ERec.exp.csv(c.post.replace(/\W+/g, '_') + '_selected_for_next_stage.csv',
        ['Roll', 'Name', 'Marks', 'Basis', 'Ground', 'Panel'],
        s.selectedRows.map(function (r) {
          var a = store.applicant(r.applicantId);
          var p = panels.find(function (x) { return x.applicantIds.indexOf(r.applicantId) >= 0; });
          return [r.rollNo, a.name, r.marks, r.selectionBasis, r.privilegeNote || '', p ? p.name : ''];
        }));
    });
  }

  ERec.pages.marks = { render: render, renderForward: renderForward, eligible: eligible, summary: summary };
})(window);
