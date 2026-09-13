/* Mark upload + selection, and the forward-to-next-stage step.

   Selection has three bases, per the requirement:
     CUTOFF     - everyone at or above a cut-off mark
     MANUAL     - hand picked
     PRIVILEGED - selected under a privilege/quota, bypassing the cut-off */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var mode = {};   // per stage: 'CUTOFF' | 'MANUAL'
  var cutoffs = {};

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
    var present = rows.filter(function (r) { return r.attendance === 'PRESENT'; });
    var absent = rows.filter(function (r) { return r.attendance === 'ABSENT'; });
    var marked = rows.filter(function (r) { return r.marks !== null && r.marks !== undefined && r.marks !== ''; });
    var selected = rows.filter(function (r) { return r.selectedForNext; });
    return {
      rows: rows, total: rows.length, present: present.length, absent: absent.length,
      marked: marked.length, selected: selected.length,
      selectedRows: selected,
      highest: marked.length ? Math.max.apply(null, marked.map(function (r) { return Number(r.marks); })) : 0,
      average: marked.length ? Math.round(marked.reduce(function (s, r) { return s + Number(r.marks); }, 0) / marked.length) : 0
    };
  }

  /* ---------- CSV paste import ---------- */

  function importModal(stg, after) {
    ui.modal({
      title: 'Import marks',
      size: 'lg',
      body: '<p class="fs-13 muted">Paste one row per candidate as <code>roll,marks</code>. ' +
        'Use <code>A</code> or <code>absent</code> in place of a mark to record absence. ' +
        'Header rows are ignored.</p>' +
        '<textarea class="form-control mono" id="f-paste" rows="10" placeholder="26010001,72&#10;26010002,absent&#10;26010003,65"></textarea>' +
        '<div class="preview-box mt-2 fs-12" id="p-out">Nothing parsed yet.</div>',
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" data-act="go">Apply to mark sheet</button>',
      onShow: function (api) {
        var rows = eligible(stg);
        function parse() {
          var out = [], bad = [];
          api.find('#f-paste').value.split('\n').forEach(function (line) {
            line = line.trim();
            if (!line) return;
            var p = line.split(/[,;\t]/).map(function (s) { return s.trim(); });
            if (p.length < 2) { bad.push(line); return; }
            var row = rows.find(function (r) { return String(r.rollNo) === p[0]; });
            if (!row) { bad.push(line + ' (roll not on this roster)'); return; }
            if (/^(a|absent)$/i.test(p[1])) out.push({ row: row, absent: true });
            else if (!isNaN(parseFloat(p[1]))) out.push({ row: row, marks: parseFloat(p[1]) });
            else bad.push(line);
          });
          api.find('#p-out').innerHTML = '<strong>' + out.length + '</strong> row(s) will be applied' +
            (bad.length ? '<br><span class="text-danger">' + bad.length + ' line(s) ignored: ' +
              fmt.esc(bad.slice(0, 3).join(' · ')) + (bad.length > 3 ? '…' : '') + '</span>' : '');
          return out;
        }
        api.find('#f-paste').addEventListener('input', parse);
        api.find('[data-act="go"]').addEventListener('click', function () {
          var out = parse();
          if (!out.length) { ui.toast('Nothing to import', 'warning'); return; }
          out.forEach(function (o) {
            if (o.absent) { o.row.attendance = 'ABSENT'; o.row.marks = null; }
            else { o.row.attendance = 'PRESENT'; o.row.marks = Math.min(Number(stg.fullMarks), o.marks); }
            recalc(stg, o.row);
          });
          store.save();
          api.close();
          ui.toast(out.length + ' mark(s) imported');
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
    var m = mode[stg.id] = mode[stg.id] || 'CUTOFF';
    var cut = cutoffs[stg.id] = (cutoffs[stg.id] === undefined ? stg.passMarks : cutoffs[stg.id]);
    var isLast = pipe.context(stg).isLast;

    var body = ui.lockedNotice(stg, 'marks');

    if (stg.type === 'VIVA') {
      var rejected = store.rosterOf(stg.id).length - s.total;
      if (rejected > 0) {
        body += ui.alert('info', fmt.plural(rejected, 'candidate') +
          ' rejected at scrutiny are excluded from this mark sheet.');
      }
    }

    if (done) {
      var st = store.stepState(stg, 'marks');
      body += ui.alert('ok', '<strong>Mark upload accepted.</strong> ' + fmt.plural(st.selected || 0, 'candidate') +
        ' selected' + (st.basis === 'CUTOFF' ? ' on a cut-off of ' + st.cutOff + ' marks' : ' manually') + '. ' +
        (isLast ? 'Generate the final result next.' : 'Forward them to the next stage next.'));
    }

    body += '<div class="stat-grid">' +
      '<div class="stat"><div class="k">On roster</div><div class="v">' + s.total + '</div></div>' +
      '<div class="stat"><div class="k">Present</div><div class="v">' + s.present + '</div></div>' +
      '<div class="stat"><div class="k">Absent</div><div class="v text-danger">' + s.absent + '</div></div>' +
      '<div class="stat"><div class="k">Marks entered</div><div class="v">' + s.marked + ' <small>/ ' + s.total + '</small></div></div>' +
      '<div class="stat"><div class="k">Highest / average</div><div class="v">' + s.highest + ' <small>/ ' + s.average + '</small></div></div>' +
      '<div class="stat"><div class="k">Selected</div><div class="v text-success">' + s.selected + '</div></div>' +
      '</div>';

    /* selection controls */
    body += ui.card({
      title: 'Selection for the next stage',
      hint: 'Choose by cut-off mark, or pick candidates by hand. A candidate may also be taken on privilege, which bypasses the cut-off.',
      body:
        '<div class="d-flex gap-3 flex-wrap align-items-end">' +
          '<div><label class="form-label">Selection basis</label>' +
            '<div class="btn-group btn-group-sm d-block" role="group">' +
              '<button class="btn btn-' + (m === 'CUTOFF' ? 'primary' : 'light') + '" data-mode="CUTOFF">By cut-off mark</button>' +
              '<button class="btn btn-' + (m === 'MANUAL' ? 'primary' : 'light') + '" data-mode="MANUAL">Manual selection</button>' +
            '</div></div>' +
          (m === 'CUTOFF'
            ? '<div><label class="form-label">Cut-off mark (out of ' + stg.fullMarks + ')</label>' +
              '<input type="number" min="0" max="' + stg.fullMarks + '" class="form-control form-control-sm" ' +
              'id="f-cut" value="' + cut + '" style="width:130px"></div>' +
              '<div><button class="btn btn-sm btn-primary" id="btn-apply-cut">Apply cut-off</button></div>' +
              '<div class="fs-13 muted" id="cut-preview"></div>'
            : '<div class="fs-13 muted">Tick candidates in the list below. Vacancies: <strong>' + c.vacancies + '</strong></div>') +
          '<div class="spacer flex-grow-1"></div>' +
          '<button class="btn btn-sm btn-light" id="btn-clear-sel">Clear all selections</button>' +
        '</div>'
    });

    /* mark sheet */
    var rows = s.rows.map(function (r) {
      var a = store.applicant(r.applicantId);
      var absent = r.attendance === 'ABSENT';
      var basisPill = r.selectedForNext
        ? (r.selectionBasis === 'PRIVILEGED' ? ui.pill('Privilege', 'purple', 'bi-star-fill')
          : r.selectionBasis === 'MANUAL' ? ui.pill('Manual', 'blue') : ui.pill('Cut-off', 'green'))
        : '';
      return '<tr data-row="' + r.id + '"' + (r.selectedForNext ? ' class="row-sel"' : '') + '>' +
        '<td><input type="checkbox" class="form-check-input" data-sel="' + r.id + '"' + (r.selectedForNext ? ' checked' : '') + '></td>' +
        '<td class="mono nowrap">' + fmt.esc(r.rollNo || '—') + '</td>' +
        '<td><div class="name-cell"><div><div class="n">' + fmt.esc(a.name) + '</div>' +
          '<div class="m">' + fmt.esc(a.fatherName) + '</div></div></div></td>' +
        (stg.type === 'VIVA' ? '<td>' + (r.scrutiny ? ui.statusPill(r.scrutiny.status) : '<span class="muted fs-12">not scrutinised</span>') + '</td>' : '') +
        '<td><select class="form-select form-select-sm" data-att="' + r.id + '" style="width:104px">' +
          '<option value=""' + (!r.attendance ? ' selected' : '') + '>—</option>' +
          '<option value="PRESENT"' + (r.attendance === 'PRESENT' ? ' selected' : '') + '>Present</option>' +
          '<option value="ABSENT"' + (absent ? ' selected' : '') + '>Absent</option>' +
        '</select></td>' +
        '<td><input type="number" min="0" max="' + stg.fullMarks + '" class="form-control form-control-sm mark-input" ' +
          'data-mark="' + r.id + '" value="' + (r.marks === null || r.marks === undefined ? '' : r.marks) + '"' +
          (absent ? ' disabled' : '') + '></td>' +
        '<td>' + ui.statusPill(r.resultStatus) + '</td>' +
        '<td>' + basisPill + '</td>' +
        '<td class="text-end nowrap">' +
          '<button class="btn btn-sm btn-light" data-priv="' + r.id + '" title="Select on privilege / quota">' +
          '<i class="bi bi-star' + (r.selectionBasis === 'PRIVILEGED' ? '-fill text-warning' : '') + '"></i></button></td>' +
        '</tr>';
    }).join('');

    body += ui.card({
      title: 'Mark sheet · ' + fmt.esc(pipe.typeLabel(stg.type)),
      hint: 'Type a mark against each candidate, or import them in bulk.',
      actions:
        /* Full and pass marks live here, on the screen where marks are
           actually entered - not buried in the circular setup screen. */
        '<div class="marks-cfg">' +
          '<span>Full marks</span>' +
          '<input type="number" min="1" class="form-control form-control-sm" data-cfg="full" value="' + stg.fullMarks + '">' +
          '<span>Pass marks</span>' +
          '<input type="number" min="0" class="form-control form-control-sm" data-cfg="pass" value="' + stg.passMarks + '">' +
        '</div>' +
        '<button class="btn btn-sm btn-light btn-icon ms-2" id="btn-import"><i class="bi bi-upload"></i> Import marks</button>' +
        '<button class="btn btn-sm btn-light btn-icon ms-2" id="btn-csv"><i class="bi bi-filetype-csv"></i> Export</button>' +
        '<button class="btn btn-sm btn-light btn-icon ms-2" id="btn-print"><i class="bi bi-printer"></i> Result sheet</button>',
      tight: true,
      body: s.rows.length
        ? '<div class="table-scroll"><table class="table-x"><thead><tr>' +
          '<th style="width:34px"></th><th>Roll</th><th>Candidate</th>' +
          (stg.type === 'VIVA' ? '<th>Scrutiny</th>' : '') +
          '<th>Attendance</th><th>Marks</th><th>Result</th><th>Selection</th><th></th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        : ui.empty('No candidate on this roster', 'Confirm the applicant list first.', 'bi-clipboard-data')
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

    /* full / pass marks, edited in context */
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

    /* ---- selection ---- */
    ui.on(view, '[data-mode]', 'click', function (e, b) { mode[stg.id] = b.dataset.mode; ERec.router.refresh(); });

    var cutInput = view.querySelector('#f-cut');
    if (cutInput) {
      function preview() {
        var v = Number(cutInput.value);
        var n = s.rows.filter(function (r) {
          return r.attendance === 'PRESENT' && r.marks !== null && Number(r.marks) >= v;
        }).length;
        view.querySelector('#cut-preview').innerHTML =
          '<strong>' + n + '</strong> candidate(s) at or above ' + v + ' marks';
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

    ui.on(view, '[data-sel]', 'change', function (e, cb) {
      var r = store.find('stageApplicants', cb.dataset.sel);
      r.selectedForNext = cb.checked;
      if (cb.checked) { if (r.selectionBasis !== 'PRIVILEGED') r.selectionBasis = 'MANUAL'; }
      else r.selectionBasis = null;
      store.save();
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

    view.querySelector('#btn-clear-sel').addEventListener('click', function () {
      s.rows.forEach(function (r) { r.selectedForNext = false; r.selectionBasis = null; });
      store.save();
      ui.toast('Selections cleared');
      ERec.router.refresh();
    });

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
          basis: mode[stg.id], cutOff: cutoffs[stg.id]
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

    if (!targets.length) {
      body += ui.alert('warn', 'There is no later stage to forward to. Add one from the circular workspace.');
    } else if (done) {
      var tstg = store.stage(state.targetStageId);
      body += ui.alert('ok', '<strong>' + fmt.plural(state.count, 'candidate') + ' forwarded to ' +
        fmt.esc(tstg ? pipe.typeLabel(tstg.type) : '—') + '.</strong> ' +
        'They now appear on that stage\'s roster. ' +
        '<a href="#/circular/' + c.id + '/stage/' + state.targetStageId + '">Open that stage</a>');
    } else {
      body += ui.alert('info', '<strong>' + fmt.plural(s.selected, 'candidate') +
        ' are selected.</strong> Choose which stage they move to — a candidate list can skip a stage if the ' +
        'circular allows it (for example MCQ straight to Viva-Voce).');
    }

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
        ? '<div class="table-scroll"><table class="table-x"><thead><tr><th>Roll</th><th>Candidate</th>' +
          '<th class="num">Marks</th><th>Basis</th><th>Panel</th></tr></thead><tbody>' +
          fmt.sortBy(s.selectedRows, function (r) { return -Number(r.marks || 0); }).map(function (r) {
            var a = store.applicant(r.applicantId);
            var p = panels.find(function (x) { return x.applicantIds.indexOf(r.applicantId) >= 0; });
            return '<tr><td class="mono">' + fmt.esc(r.rollNo) + '</td>' +
              '<td>' + fmt.esc(a.name) + '</td>' +
              '<td class="num">' + (r.marks === null ? '—' : r.marks + ' / ' + stg.fullMarks) + '</td>' +
              '<td>' + (r.selectionBasis === 'PRIVILEGED'
                ? ui.pill('Privilege', 'purple', 'bi-star-fill') + '<div class="fs-12 muted mt-1">' + fmt.esc(r.privilegeNote || '') + '</div>'
                : ui.pill(r.selectionBasis === 'MANUAL' ? 'Manual' : 'Cut-off', r.selectionBasis === 'MANUAL' ? 'blue' : 'green')) + '</td>' +
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
