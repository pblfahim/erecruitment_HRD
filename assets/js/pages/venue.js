/* Venue setup - circular + stage wise: where, when, and which roll range
   sits in which hall. Candidates are allocated to a venue by roll range. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  /* Roll numbers share a prefix and width, so string compare is enough. */
  function inRange(roll, from, to) {
    if (!roll) return false;
    return String(roll) >= String(from) && String(roll) <= String(to);
  }

  function allocate(stg) {
    var venues = store.venuesOf(stg.id);
    var roster = store.rosterOf(stg.id);
    roster.forEach(function (r) {
      var v = venues.find(function (x) { return inRange(r.rollNo, x.rollFrom, x.rollTo); });
      r.venueId = v ? v.id : null;
    });
    store.save();
  }

  function analyse(stg) {
    var venues = store.venuesOf(stg.id);
    var roster = store.rosterOf(stg.id);
    var issues = [];

    var unallocated = roster.filter(function (r) { return !r.venueId; });
    if (unallocated.length) {
      issues.push({
        tone: 'warn',
        text: fmt.plural(unallocated.length, 'candidate') + ' fall outside every roll range (' +
          unallocated.slice(0, 5).map(function (r) { return r.rollNo || '(no roll)'; }).join(', ') +
          (unallocated.length > 5 ? '…' : '') + ')'
      });
    }
    venues.forEach(function (v, i) {
      var n = roster.filter(function (r) { return r.venueId === v.id; }).length;
      if (n > v.capacity) {
        issues.push({ tone: 'err', text: v.name + ' is over capacity — ' + n + ' allocated against ' + v.capacity + ' seats' });
      }
      venues.slice(i + 1).forEach(function (w) {
        if (String(v.rollFrom) <= String(w.rollTo) && String(w.rollFrom) <= String(v.rollTo)) {
          issues.push({ tone: 'err', text: 'Roll ranges of ' + v.name + ' and ' + w.name + ' overlap' });
        }
      });
      if (!v.examDate) issues.push({ tone: 'warn', text: v.name + ' has no examination date' });
    });
    return { issues: issues, unallocated: unallocated };
  }

  function venueForm(stg, venue) {
    var c = store.circular(stg.circularId);
    var roster = store.rosterOf(stg.id);
    var rolls = roster.map(function (r) { return r.rollNo; }).filter(Boolean);
    var v = venue || {
      name: '', address: '', examDate: stg.examDate || '',
      reportingTime: '09:30', startTime: '10:00', endTime: '12:00',
      rollFrom: rolls[0] || '', rollTo: rolls[rolls.length - 1] || '', capacity: 100
    };

    ui.modal({
      title: (venue ? 'Edit' : 'Add') + ' venue · ' + pipe.typeLabel(stg.type),
      size: 'lg',
      body:
        '<div class="row g-3">' +
          '<div class="col-md-6"><label class="form-label">Venue name</label>' +
            '<input class="form-control" id="v-name" value="' + fmt.esc(v.name) + '" placeholder="City Model College"></div>' +
          '<div class="col-md-6"><label class="form-label">Address</label>' +
            '<input class="form-control" id="v-addr" value="' + fmt.esc(v.address) + '" placeholder="24 Green Road, Dhaka-1205"></div>' +
          '<div class="col-md-4"><label class="form-label">Examination date</label>' +
            '<input type="date" class="form-control" id="v-date" value="' + fmt.esc(v.examDate || '') + '"></div>' +
          '<div class="col-md-4"><label class="form-label">Reporting time</label>' +
            '<input type="time" class="form-control" id="v-report" value="' + fmt.esc(v.reportingTime || fmt.shiftTime(v.startTime, -30)) + '">' +
            '<div class="form-text">Printed on the admit card.</div></div>' +
          '<div class="col-md-4"><label class="form-label">Exam start time</label>' +
            '<input type="time" class="form-control" id="v-start" value="' + fmt.esc(v.startTime) + '"></div>' +
          '<div class="col-md-4"><label class="form-label">End time</label>' +
            '<input type="time" class="form-control" id="v-end" value="' + fmt.esc(v.endTime) + '"></div>' +
          '<div class="col-md-4"><label class="form-label">Roll number from</label>' +
            '<input class="form-control mono" id="v-from" value="' + fmt.esc(v.rollFrom) + '"></div>' +
          '<div class="col-md-4"><label class="form-label">Roll number to</label>' +
            '<input class="form-control mono" id="v-to" value="' + fmt.esc(v.rollTo) + '"></div>' +
          '<div class="col-md-4"><label class="form-label">Seat capacity</label>' +
            '<input type="number" min="1" class="form-control" id="v-cap" value="' + v.capacity + '"></div>' +
          '<div class="col-12"><div class="preview-box fs-12" id="v-info">—</div></div>' +
        '</div>',
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" data-act="save">' + (venue ? 'Save changes' : 'Add venue') + '</button>',
      onShow: function (api) {
        function info() {
          var from = api.find('#v-from').value.trim(), to = api.find('#v-to').value.trim();
          var cap = parseInt(api.find('#v-cap').value, 10) || 0;
          var n = roster.filter(function (r) { return inRange(r.rollNo, from, to); }).length;
          api.find('#v-info').innerHTML = from && to
            ? '<strong>' + n + '</strong> candidate(s) fall in <span class="mono">' + fmt.esc(from) + ' – ' + fmt.esc(to) + '</span>' +
              (n > cap ? ' <span class="text-danger fw-semibold">— exceeds the ' + cap + ' seat capacity</span>' : '')
            : 'Enter a roll range to see how many candidates it covers.';
        }
        ['#v-from', '#v-to', '#v-cap'].forEach(function (s) { api.find(s).addEventListener('input', info); });
        api.find('#v-start').addEventListener('change', function (e) {
          var rep = api.find('#v-report');
          if (!rep.dataset.touched) rep.value = fmt.shiftTime(e.target.value, -30);
        });
        api.find('#v-report').addEventListener('input', function (e) { e.target.dataset.touched = '1'; });
        info();

        api.find('[data-act="save"]').addEventListener('click', function () {
          var rec = {
            circularId: stg.circularId, stageId: stg.id,
            name: api.find('#v-name').value.trim(),
            address: api.find('#v-addr').value.trim(),
            examDate: api.find('#v-date').value,
            reportingTime: api.find('#v-report').value,
            startTime: api.find('#v-start').value,
            endTime: api.find('#v-end').value,
            rollFrom: api.find('#v-from').value.trim(),
            rollTo: api.find('#v-to').value.trim(),
            capacity: parseInt(api.find('#v-cap').value, 10) || 0
          };
          if (!rec.name || !rec.examDate || !rec.rollFrom || !rec.rollTo) {
            ui.toast('Name, date and roll range are required', 'warning'); return;
          }
          if (String(rec.rollFrom) > String(rec.rollTo)) {
            ui.toast('"Roll from" must not be greater than "Roll to"', 'warning'); return;
          }
          if (venue) store.update('venues', venue.id, rec);
          else store.insert('venues', Object.assign({ id: fmt.uid('ven') }, rec));

          if (!stg.examDate) store.update('stages', stg.id, { examDate: rec.examDate });
          allocate(stg);
          store.audit(venue ? 'EDIT_VENUE' : 'ADD_VENUE', 'stage', stg.id, rec.name + ' · ' + pipe.typeLabel(stg.type));
          api.close();
          ui.toast('Venue saved');
          ERec.router.refresh();
        });
      }
    });
  }

  function autoSplit(stg) {
    var roster = store.rosterOf(stg.id).filter(function (r) { return r.rollNo; });
    if (!roster.length) { ui.toast('Generate roll numbers first', 'warning'); return; }
    ui.modal({
      title: 'Auto-split roll ranges',
      body: '<label class="form-label">Number of venues</label>' +
        '<input type="number" min="1" max="10" class="form-control" id="s-n" value="2">' +
        '<div class="form-text">Existing venues for this stage are replaced. ' +
        fmt.plural(roster.length, 'candidate') + ' will be divided into equal roll ranges.</div>',
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" data-act="go">Create venues</button>',
      onShow: function (api) {
        api.find('[data-act="go"]').addEventListener('click', function () {
          var n = Math.max(1, Math.min(10, parseInt(api.find('#s-n').value, 10) || 1));
          store.venuesOf(stg.id).forEach(function (v) { store.remove('venues', v.id); });
          var size = Math.ceil(roster.length / n);
          for (var i = 0; i < n; i++) {
            var chunk = roster.slice(i * size, (i + 1) * size);
            if (!chunk.length) continue;
            store.insert('venues', {
              id: fmt.uid('ven'), circularId: stg.circularId, stageId: stg.id,
              name: 'Examination Centre ' + (i + 1),
              address: 'To be confirmed',
              examDate: stg.examDate || fmt.addDays(fmt.isoDate(), 21),
              reportingTime: '09:30', startTime: '10:00', endTime: stg.type === 'VIVA' ? '17:00' : '12:00',
              rollFrom: chunk[0].rollNo, rollTo: chunk[chunk.length - 1].rollNo,
              capacity: Math.max(chunk.length, 50)
            });
          }
          allocate(stg);
          api.close();
          ui.toast(n + ' venue(s) created — edit the names and addresses');
          ERec.router.refresh();
        });
      }
    });
  }

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var c = store.circular(stg.circularId);
    var roster = store.rosterOf(stg.id);
    var venues = store.venuesOf(stg.id);
    var done = store.isStepDone(stg, 'venue');

    allocate(stg);
    var check = analyse(stg);

    var body = ui.lockedNotice(stg, 'venue');

    if (!roster.length) {
      body += ui.alert('warn', '<strong>No candidates in this stage.</strong> Confirm the applicant list first.');
    }

    /* One grouped notice rather than a stack of alerts. */
    if (check.issues.length) {
      var errs = check.issues.filter(function (i) { return i.tone === 'err'; });
      var warns = check.issues.filter(function (i) { return i.tone !== 'err'; });
      var list = errs.concat(warns);
      body += ui.alert(errs.length ? 'err' : 'warn',
        '<strong>' + fmt.plural(list.length, 'thing') + ' to check before you confirm</strong>' +
        '<ul class="mb-0 mt-1 ps-3">' + list.map(function (i) {
          return '<li>' + fmt.esc(i.text) + '</li>';
        }).join('') + '</ul>');
    }

    if (done && !check.issues.length) {
      body += ui.alert('ok', '<strong>Venue plan confirmed.</strong> ' + fmt.plural(venues.length, 'venue') +
        ' · ' + fmt.plural(roster.length - check.unallocated.length, 'candidate') + ' allocated.');
    }

    var rows = venues.map(function (v) {
      var n = roster.filter(function (r) { return r.venueId === v.id; }).length;
      return '<tr>' +
        '<td><div class="fw-semibold">' + fmt.esc(v.name) + '</div>' +
          '<div class="fs-12 muted">' + fmt.esc(v.address || 'Address not set') + '</div></td>' +
        '<td class="nowrap">' + fmt.date(v.examDate) + '</td>' +
        '<td class="nowrap fs-12"><span class="pill amber">Report ' + fmt.time12(v.reportingTime || fmt.shiftTime(v.startTime, -30)) + '</span>' +
          '<div class="mt-1">Exam ' + fmt.time12(v.startTime) + ' – ' + fmt.time12(v.endTime) + '</div></td>' +
        '<td class="mono nowrap">' + fmt.esc(v.rollFrom) + '<br><span class="fs-12">to ' + fmt.esc(v.rollTo) + '</span></td>' +
        '<td class="num">' + n + ' <span class="muted fs-12">/ ' + v.capacity + '</span>' +
          (n > v.capacity ? ' <i class="bi bi-exclamation-triangle-fill text-danger"></i>' : '') + '</td>' +
        '<td class="text-end nowrap">' +
          '<button class="btn btn-sm btn-light" data-seat="' + v.id + '" title="Seat plan"><i class="bi bi-list-ol"></i></button> ' +
          '<button class="btn btn-sm btn-light" data-edit="' + v.id + '"><i class="bi bi-pencil"></i></button> ' +
          '<button class="btn btn-sm btn-outline-danger" data-del="' + v.id + '"><i class="bi bi-trash"></i></button>' +
        '</td></tr>';
    }).join('');

    body += ui.card({
      title: 'Examination venues · ' + pipe.typeLabel(stg.type),
      hint: 'Circular and stage wise. Candidates are seated by roll number range.',
      actions:
        '<button class="btn btn-sm btn-light btn-icon" id="btn-split"><i class="bi bi-diagram-2"></i> Auto-split</button>' +
        '<button class="btn btn-sm btn-primary btn-icon ms-2" id="btn-add"><i class="bi bi-plus-lg"></i> Add venue</button>',
      tight: true,
      body: venues.length
        ? '<table class="table-x"><thead><tr><th>Venue</th><th>Date</th><th>Time</th><th>Roll range</th>' +
          '<th class="num">Allocated</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
        : ui.empty('No venue set up for this stage', 'Add a venue, or auto-split the roll range across centres.', 'bi-geo-alt')
    });

    ui.stagePage(view, stg, 'venue', {
      body: body,
      action: done
        ? {
          note: check.unallocated.length
            ? '<span class="text-warning fw-semibold">' + fmt.plural(check.unallocated.length, 'candidate') + ' still without a seat</span>'
            : fmt.plural(venues.length, 'venue') + ' confirmed',
          secondary: [{ id: 'btn-unconfirm', label: 'Change the venue plan' }],
          primary: check.unallocated.length
            ? { id: 'btn-confirm', tone: 'success', icon: 'bi-check2-circle', label: 'Re-confirm venue plan' }
            : null
        }
        : {
          primary: {
            id: 'btn-confirm', tone: 'success', icon: 'bi-check2-circle',
            label: 'Confirm venue plan', disabled: !venues.length
          }
        }
    });

    view.querySelector('#btn-add').addEventListener('click', function () { venueForm(stg, null); });
    view.querySelector('#btn-split').addEventListener('click', function () { autoSplit(stg); });

    ui.on(view, '[data-edit]', 'click', function (e, b) { venueForm(stg, store.find('venues', b.dataset.edit)); });

    ui.on(view, '[data-del]', 'click', function (e, b) {
      var v = store.find('venues', b.dataset.del);
      ui.confirm({ title: 'Remove venue', body: 'Remove <strong>' + fmt.esc(v.name) + '</strong> from this stage?', okText: 'Remove', danger: true })
        .then(function (ok) {
          if (!ok) return;
          store.remove('venues', v.id);
          allocate(stg);
          ui.toast('Venue removed');
          ERec.router.refresh();
        });
    });

    ui.on(view, '[data-seat]', 'click', function (e, b) {
      var v = store.find('venues', b.dataset.seat);
      var seated = roster.filter(function (r) { return r.venueId === v.id; });
      ui.modal({
        title: 'Seat plan · ' + fmt.esc(v.name),
        size: 'lg',
        body: '<div class="fs-13 mb-2 muted">' + fmt.date(v.examDate) + ' · ' + fmt.time12(v.startTime) +
          ' – ' + fmt.time12(v.endTime) + ' · ' + fmt.plural(seated.length, 'candidate') + '</div>' +
          (seated.length ? '<table class="table-x"><thead><tr><th>Roll</th><th>Candidate</th><th>Mobile</th></tr></thead><tbody>' +
            seated.map(function (r) {
              var a = store.applicant(r.applicantId);
              return '<tr><td class="mono">' + fmt.esc(r.rollNo) + '</td><td>' + fmt.esc(a.name) +
                '</td><td class="mono fs-12">' + fmt.esc(a.mobile) + '</td></tr>';
            }).join('') + '</tbody></table>' : ui.empty('No candidate falls in this roll range')),
        footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Close</button>' +
          '<button class="btn btn-sm btn-primary" data-act="print"><i class="bi bi-printer"></i> Print attendance sheet</button>',
        onShow: function (api) {
          api.find('[data-act="print"]').addEventListener('click', function () {
            api.close();
            ERec.exp.printDoc('attendance', stg.id, 'venue=' + v.id);
          });
        }
      });
    });

    var conf = view.querySelector('#btn-confirm');
    if (conf) conf.addEventListener('click', function () {
      var msg = fmt.plural(venues.length, 'venue') + ' will be locked in for ' + fmt.esc(pipe.typeLabel(stg.type)) + '.';
      if (check.unallocated.length) {
        msg += ' <strong class="text-danger">' + fmt.plural(check.unallocated.length, 'candidate') +
          ' are not covered by any roll range and will have no venue on their admit card.</strong>';
      }
      ui.confirm({ title: 'Confirm venue plan', body: msg, okText: 'Confirm' }).then(function (ok) {
        if (!ok) return;
        store.markStep(stg.id, 'venue', { count: venues.length, allocated: roster.length - check.unallocated.length });
        store.audit('CONFIRM_VENUE', 'stage', stg.id, fmt.plural(venues.length, 'venue') + ' confirmed for ' + pipe.typeLabel(stg.type));
        ui.toast('Venue plan confirmed');
        ERec.router.refresh();
      });
    });

    var unconf = view.querySelector('#btn-unconfirm');
    if (unconf) unconf.addEventListener('click', function () {
      store.clearStep(stg.id, 'venue');
      ui.toast('Venue plan re-opened');
      ERec.router.refresh();
    });
  }

  ERec.pages.venue = { render: render, allocate: allocate, inRange: inRange };
})(window);
