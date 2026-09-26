/* Venue setup & Approval - circular + stage wise: where, when, and which roll range
   sits in which hall. Displays the Venue Plan being sent and the Approval Trail
   as configured in the Job Circular Approval Channel. */
(function (global) {
  'use strict';

  var ERec = global.ERec = global.ERec || {};
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
          '<div class="col-md-6"><label class="form-label fw-semibold">Venue name</label>' +
            '<input class="form-control" id="v-name" value="' + fmt.esc(v.name) + '" placeholder="City Model College"></div>' +
          '<div class="col-md-6"><label class="form-label fw-semibold">Address</label>' +
            '<input class="form-control" id="v-addr" value="' + fmt.esc(v.address) + '" placeholder="24 Green Road, Dhaka-1205"></div>' +
          '<div class="col-md-4"><label class="form-label fw-semibold">Examination date</label>' +
            '<input type="date" class="form-control" id="v-date" value="' + fmt.esc(v.examDate || '') + '"></div>' +
          '<div class="col-md-4"><label class="form-label fw-semibold">Reporting time</label>' +
            '<input type="time" class="form-control" id="v-report" value="' + fmt.esc(v.reportingTime || fmt.shiftTime(v.startTime, -30)) + '">' +
            '<div class="form-text">Printed on the candidate admit card.</div></div>' +
          '<div class="col-md-4"><label class="form-label fw-semibold">Exam start time</label>' +
            '<input type="time" class="form-control" id="v-start" value="' + fmt.esc(v.startTime) + '"></div>' +
          '<div class="col-md-4"><label class="form-label fw-semibold">End time</label>' +
            '<input type="time" class="form-control" id="v-end" value="' + fmt.esc(v.endTime) + '"></div>' +
          '<div class="col-md-4"><label class="form-label fw-semibold">Roll number from</label>' +
            '<input class="form-control mono" id="v-from" value="' + fmt.esc(v.rollFrom) + '"></div>' +
          '<div class="col-md-4"><label class="form-label fw-semibold">Roll number to</label>' +
            '<input class="form-control mono" id="v-to" value="' + fmt.esc(v.rollTo) + '"></div>' +
          '<div class="col-md-4"><label class="form-label fw-semibold">Seat capacity</label>' +
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
          ui.toast('Venue saved successfully');
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
      body: '<label class="form-label fw-semibold">Number of venues</label>' +
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
              address: 'Dhaka City Examination Centre',
              examDate: stg.examDate || fmt.addDays(fmt.isoDate(), 21),
              reportingTime: '09:30', startTime: '10:00', endTime: stg.type === 'VIVA' ? '17:00' : '12:00',
              rollFrom: chunk[0].rollNo, rollTo: chunk[chunk.length - 1].rollNo,
              capacity: Math.max(chunk.length, 50)
            });
          }
          allocate(stg);
          api.close();
          ui.toast(n + ' venue(s) created — update details as needed');
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
    var approvers = stg.venueApprovers || [];
    var required = !!stg.requireVenueApproval;
    var ap = store.approvalFor(stg.id, 'VENUE');
    var done = store.isStepDone(stg, 'venue');
    var me = store.actingUser();

    allocate(stg);
    var check = analyse(stg);

    var totalCapacity = venues.reduce(function (sum, v) { return sum + (v.capacity || 0); }, 0);
    var allocatedCount = roster.length - check.unallocated.length;
    var unallocatedCount = check.unallocated.length;
    var summary = fmt.plural(venues.length, 'venue') + ' for ' + pipe.typeLabel(stg.type) + ' — ' + c.post;

    var body = ui.lockedNotice(stg, 'venue');

    if (!roster.length) {
      body += ui.alert('warn', '<strong>No candidates in this stage roster.</strong> Confirm candidate list first.');
    }

    if (check.issues.length) {
      var errs = check.issues.filter(function (i) { return i.tone === 'err'; });
      var warns = check.issues.filter(function (i) { return i.tone !== 'err'; });
      var list = errs.concat(warns);
      body += ui.alert(errs.length ? 'err' : 'warn',
        '<strong>' + fmt.plural(list.length, 'item') + ' to check in venue configuration:</strong>' +
        '<ul class="mb-0 mt-1 ps-3">' + list.map(function (i) {
          return '<li>' + fmt.esc(i.text) + '</li>';
        }).join('') + '</ul>');
    }

    /* Venue Approval Status Banner */
    if (ap && ap.status === 'PENDING') {
      var lvl = ap.chain[ap.currentSeq];
      var isMyTurn = lvl && lvl.userId === me.id;
      if (isMyTurn) {
        body += ui.alert('warn', '<strong>Action Required: Venue plan awaiting your sign-off as ' + fmt.esc(me.name) + ' (' + fmt.esc(me.designation) + ').</strong> ' +
          'Review the venue plan and sign off below.');
      } else {
        body += ui.alert('warn', '<strong>Awaiting Venue Plan approval from ' + fmt.esc(lvl ? lvl.name : '—') + ' (' + fmt.esc(lvl ? lvl.designation : '') + ').</strong> ' +
          'Switch role to act on this request: ' +
          (lvl ? '<button type="button" class="btn btn-sm btn-outline-warning ms-2" data-switch-user="' + lvl.userId + '"><i class="bi bi-person-switch me-1"></i> Switch to ' + fmt.esc(lvl.name) + '</button>' : ''));
      }
    } else if (ap && ap.status === 'APPROVED') {
      body += ui.alert('ok', '<strong>Venue plan approved.</strong> Signed off by ' + fmt.plural(ap.chain.length, 'level') + ' · Examination venues and seating allocation authorized.');
    } else if (ap && ap.status === 'REJECTED') {
      var rej = ap.chain.filter(function (l) { return l.status === 'REJECTED'; })[0];
      body += ui.alert('err', '<strong>Venue plan rejected by ' + fmt.esc(rej ? rej.name : '') + '.</strong> ' +
        (rej && rej.remarks ? '“' + fmt.esc(rej.remarks) + '”' : '') +
        ' Revise seating capacities or schedules and submit revised plan.');
    } else if (!required) {
      body += ui.alert('info', '<strong>Venue approval is optional for this stage.</strong> ' +
        'Configured in Approval Channel. You can dispatch for sign-off or confirm venue plan directly.');
    } else {
      body += ui.alert('warn', '<strong>Venue approval is required for this stage.</strong> ' +
        'Configured in Approval Channel. Venue plan must be approved before subsequent examination notices can be sent.');
    }

    /* 1. Approval Trail Card (configured in pages/createcircular/approval.js) */
    var canSendVenue = venues.length > 0 && approvers.length > 0;
    var myTurn = ap && ap.status === 'PENDING' && ap.chain[ap.currentSeq] &&
      ap.chain[ap.currentSeq].userId === me.id;

    var chainHtml = approvers.length
      ? '<div class="chain mb-2 d-flex flex-wrap align-items-center gap-1">' + approvers.map(function (id, i) {
        var u = store.find('users', id) || { name: id, designation: 'Approver' };
        return (i ? '<span class="arrow text-muted mx-1"><i class="bi bi-chevron-right fs-12"></i></span>' : '') +
          '<span class="pill blue py-1 px-2"><i class="bi bi-person-badge me-1"></i>L' + (i + 1) + ' · ' + fmt.esc(u.name) + '</span>';
      }).join('') + '</div>' +
      '<div class="fs-12 text-muted mb-2">Sequential sign-off configured in Job Circular Approval Channel.</div>'
      : ui.alert('warn', 'No venue approver configured. Please configure approvers in stage settings.');

    var approvalTrailCardHtml = ui.card({
      title: 'Approval trail',
      hint: ap
        ? ('Requested by ' + fmt.esc(ap.createdBy) + ' · ' + fmt.dateTime(ap.createdAt))
        : ('Configured in Approval Channel: ' + approvers.length + ' level(s)'),
      actions: (!ap || ap.status === 'REJECTED'
        ? '<button type="button" class="btn btn-sm btn-outline-success" id="btn-send-venue-approval"' + (canSendVenue ? '' : ' disabled') + '>' +
          '<i class="bi bi-send me-1"></i> ' + (ap ? 'Send revised plan' : 'Send for approval') + '</button>'
        : ''),
      body: chainHtml +
        '<hr class="hr-soft my-2">' +
        (ap ? (ERec.approvals ? ERec.approvals.timeline(ap, me) : '') : (ERec.approvals ? ERec.approvals.renderDraftTimeline(approvers) : '')) +
        (myTurn
          ? '<div class="mt-3 pt-3 border-top d-flex gap-2">' +
            '<button type="button" class="btn btn-sm btn-success flex-fill" id="btn-card-approve"><i class="bi bi-check2-circle me-1"></i> Approve Venue Plan as ' + fmt.esc(me.name.split(' ')[0]) + '</button>' +
            '<button type="button" class="btn btn-sm btn-outline-danger flex-fill" id="btn-card-reject"><i class="bi bi-x-circle me-1"></i> Reject</button>' +
            '</div>'
          : '') +
        '<div class="mt-3 pt-2 border-top d-flex align-items-center justify-content-between text-muted fs-12">' +
          '<span>Acting as: <strong>' + fmt.esc(me.name) + '</strong> (' + fmt.esc(me.designation) + ')</span>' +
          '<span class="badge bg-light text-secondary border">' + fmt.esc(me.role) + '</span>' +
        '</div>'
    });

    /* 2. Venue Plan Being Sent Card */
    var venuePlanPayloadHtml =
      '<div class="row g-2 mb-3">' +
        '<div class="col-sm-3 col-6"><div class="p-2 border rounded bg-light text-center">' +
          '<div class="fs-11 text-muted text-uppercase fw-bold">Venues</div>' +
          '<div class="fs-5 fw-bold text-dark">' + venues.length + '</div>' +
        '</div></div>' +
        '<div class="col-sm-3 col-6"><div class="p-2 border rounded bg-light text-center">' +
          '<div class="fs-11 text-muted text-uppercase fw-bold">Total Seats</div>' +
          '<div class="fs-5 fw-bold text-primary">' + totalCapacity + '</div>' +
        '</div></div>' +
        '<div class="col-sm-3 col-6"><div class="p-2 border rounded bg-light text-center">' +
          '<div class="fs-11 text-muted text-uppercase fw-bold">Seated</div>' +
          '<div class="fs-5 fw-bold text-success">' + allocatedCount + '</div>' +
        '</div></div>' +
        '<div class="col-sm-3 col-6"><div class="p-2 border rounded bg-light text-center">' +
          '<div class="fs-11 text-muted text-uppercase fw-bold">Unallocated</div>' +
          '<div class="fs-5 fw-bold ' + (unallocatedCount ? 'text-danger' : 'text-secondary') + '">' + unallocatedCount + '</div>' +
        '</div></div>' +
      '</div>' +
      (venues.length
        ? '<div class="table-responsive" style="max-height:45vh"><table class="table table-striped table-hover align-middle table-x mb-0"><thead><tr>' +
          '<th>Venue</th><th>Date</th><th>Timing</th><th>Roll range</th><th class="num">Capacity</th></tr></thead><tbody>' +
          venues.map(function (v) {
            var n = roster.filter(function (r) { return r.venueId === v.id; }).length;
            return '<tr>' +
              '<td><div class="fw-semibold">' + fmt.esc(v.name) + '</div><div class="fs-12 text-muted">' + fmt.esc(v.address || '') + '</div></td>' +
              '<td class="nowrap">' + fmt.date(v.examDate) + '</td>' +
              '<td class="nowrap fs-12">' +
                '<span class="pill amber py-0 px-1">Rep ' + fmt.time12(v.reportingTime || fmt.shiftTime(v.startTime, -30)) + '</span>' +
                '<div class="mt-1">' + fmt.time12(v.startTime) + ' – ' + fmt.time12(v.endTime) + '</div>' +
              '</td>' +
              '<td class="mono nowrap">' + fmt.esc(v.rollFrom) + '<br><span class="fs-11 text-muted">to ' + fmt.esc(v.rollTo) + '</span></td>' +
              '<td class="num">' + n + ' <span class="text-muted fs-12">/ ' + v.capacity + '</span>' +
                (n > v.capacity ? ' <i class="bi bi-exclamation-triangle-fill text-danger"></i>' : '') +
              '</td>' +
              '</tr>';
          }).join('') + '</tbody></table></div>'
        : ui.empty('No venue set up yet', 'Add examination venues or auto-split below.', 'bi-geo-alt'));

    var venuePlanBeingSentCardHtml = ui.card({
      title: 'Venue plan being sent',
      hint: summary,
      actions: '<button type="button" class="btn btn-sm btn-light" id="btn-venue-details"><i class="bi bi-eye me-1"></i> View Venue Details</button>',
      body: venuePlanPayloadHtml
    });

    /* Two column row: Approval Trail & Venue Plan Being Sent */
    body += '<div class="row g-3 mb-4">' +
      '<div class="col-lg-5">' + approvalTrailCardHtml + '</div>' +
      '<div class="col-lg-7">' + venuePlanBeingSentCardHtml + '</div>' +
      '</div>';

    /* 3. Examination Venues Management Card (CRUD) */
    var rows = venues.map(function (v) {
      var n = roster.filter(function (r) { return r.venueId === v.id; }).length;
      return '<tr>' +
        '<td><div class="fw-semibold">' + fmt.esc(v.name) + '</div>' +
          '<div class="fs-12 text-muted">' + fmt.esc(v.address || 'Address not set') + '</div></td>' +
        '<td class="nowrap">' + fmt.date(v.examDate) + '</td>' +
        '<td class="nowrap fs-12"><span class="pill amber py-0 px-1">Report ' + fmt.time12(v.reportingTime || fmt.shiftTime(v.startTime, -30)) + '</span>' +
          '<div class="mt-1">Exam ' + fmt.time12(v.startTime) + ' – ' + fmt.time12(v.endTime) + '</div></td>' +
        '<td class="mono nowrap">' + fmt.esc(v.rollFrom) + '<br><span class="fs-12 text-muted">to ' + fmt.esc(v.rollTo) + '</span></td>' +
        '<td class="num">' + n + ' <span class="text-muted fs-12">/ ' + v.capacity + '</span>' +
          (n > v.capacity ? ' <i class="bi bi-exclamation-triangle-fill text-danger"></i>' : '') + '</td>' +
        '<td class="text-end nowrap">' +
          '<button class="btn btn-sm btn-light" data-seat="' + v.id + '" title="Seat plan"><i class="bi bi-list-ol"></i></button> ' +
          '<button class="btn btn-sm btn-light" data-edit="' + v.id + '"><i class="bi bi-pencil"></i></button> ' +
          '<button class="btn btn-sm btn-outline-danger" data-del="' + v.id + '"><i class="bi bi-trash"></i></button>' +
        '</td></tr>';
    }).join('');

    body += ui.card({
      title: 'Examination venues management · ' + pipe.typeLabel(stg.type),
      hint: 'Configure examination halls, roll ranges, and seating allocation.',
      actions:
        '<button class="btn btn-sm btn-light btn-icon" id="btn-split"><i class="bi bi-diagram-2 me-1"></i> Auto-split</button>' +
        '<button class="btn btn-sm btn-primary btn-icon ms-2" id="btn-add"><i class="bi bi-plus-lg me-1"></i> Add venue</button>',
      tight: true,
      body: venues.length
        ? '<div class="table-responsive"><table class="table table-striped table-hover align-middle table-x" id="table-venues"><thead><tr><th>Venue</th><th>Date</th><th>Timing</th><th>Roll range</th>' +
          '<th class="num">Allocated</th><th data-orderable="false"></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : ui.empty('No venue set up for this stage', 'Add a venue, or auto-split the roll range across centres.', 'bi-geo-alt')
    });

    /* Bottom Action Bar */
    var action = {
      secondary: [{ id: 'btn-venue-details-bot', label: 'View venue details', icon: 'bi-list-ul' }]
    };

    if (myTurn) {
      action.primary = {
        id: 'btn-approve-bar', tone: 'success', icon: 'bi-check-lg',
        label: 'Approve Venue Plan as ' + me.name.split(' ')[0]
      };
      action.secondary.push({ id: 'btn-reject-bar', label: 'Reject', tone: 'outline-danger' });
    } else if (!ap || ap.status === 'REJECTED') {
      action.primary = {
        id: 'btn-send-bar', icon: 'bi-send',
        label: ap ? 'Send revised venue plan' : 'Send venue plan for approval',
        disabled: !canSendVenue
      };
      if (!required) {
        action.secondary.push({ id: 'btn-confirm', label: 'Confirm without approval', tone: 'outline-secondary' });
      }
    } else if (ap.status === 'APPROVED') {
      action.note = 'Venue plan approved by senior review';
      action.secondary.push({ id: 'btn-unconfirm', label: 'Re-open venue plan' });
    } else {
      action.note = 'Awaiting sign-off';
      if (!required) {
        action.secondary.push({ id: 'btn-confirm', label: 'Confirm venue plan' });
      }
    }

    ui.stagePage(view, stg, 'venue', { body: body, action: action });

    if (venues.length) {
      ui.dataTable(view.querySelector('#table-venues'), { pageLength: 10 });
    }

    /* Event wiring */
    // Switch acting personnel buttons
    ui.on(view, '[data-switch-user]', 'click', function (e, b) {
      var uid = b.dataset.switchUser;
      if (!uid) return;
      store.setActingUser(uid);
      var nu = store.find('users', uid);
      ui.toast('Acting as ' + (nu ? nu.name : uid) + (nu ? ' (' + nu.designation + ')' : ''), 'info');
      ERec.app.renderAll();
    });

    // Venue details modal
    function openDetails() {
      if (ERec.approvals && ERec.approvals.detailsModal) {
        ERec.approvals.detailsModal(stg, 'VENUE');
      }
    }
    var detBtn = view.querySelector('#btn-venue-details');
    if (detBtn) detBtn.addEventListener('click', openDetails);
    var detBtnBot = view.querySelector('#btn-venue-details-bot');
    if (detBtnBot) detBtnBot.addEventListener('click', openDetails);

    // Send venue plan for approval
    function doSendVenue() {
      if (!canSendVenue) {
        ui.toast('Please configure at least one venue and approver before sending', 'warning');
        return;
      }
      if (ERec.approvals && ERec.approvals.send) {
        ERec.approvals.send(stg, 'VENUE', summary);
        ui.toast('Venue plan sent for approval to ' + (store.find('users', approvers[0]) || {}).name);
        ERec.app.renderAll();
      }
    }
    var sendBtn = view.querySelector('#btn-send-venue-approval');
    if (sendBtn) sendBtn.addEventListener('click', doSendVenue);
    var sendBtnBar = view.querySelector('#btn-send-bar');
    if (sendBtnBar) sendBtnBar.addEventListener('click', doSendVenue);

    // Approve / Reject actions
    function doApprove() {
      if (ERec.approvals && ERec.approvals.decisionModal) {
        ERec.approvals.decisionModal(ap, 'APPROVED', function () { ERec.app.renderAll(); });
      }
    }
    function doReject() {
      if (ERec.approvals && ERec.approvals.decisionModal) {
        ERec.approvals.decisionModal(ap, 'REJECTED', function () { ERec.app.renderAll(); });
      }
    }

    var cardApr = view.querySelector('#btn-card-approve');
    if (cardApr) cardApr.addEventListener('click', doApprove);
    var barApr = view.querySelector('#btn-approve-bar');
    if (barApr) barApr.addEventListener('click', doApprove);

    var cardRej = view.querySelector('#btn-card-reject');
    if (cardRej) cardRej.addEventListener('click', doReject);
    var barRej = view.querySelector('#btn-reject-bar');
    if (barRej) barRej.addEventListener('click', doReject);

    // Venue CRUD
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
          (seated.length ? '<div class="table-responsive"><table class="table table-striped table-hover align-middle table-x" id="table-seat-plan"><thead><tr><th>Roll</th><th>Candidate</th><th>Mobile</th></tr></thead><tbody>' +
            seated.map(function (r) {
              var a = store.applicant(r.applicantId);
              return '<tr><td class="mono">' + fmt.esc(r.rollNo) + '</td><td>' + fmt.esc(a.name) +
                '</td><td class="mono fs-12">' + fmt.esc(a.mobile) + '</td></tr>';
            }).join('') + '</tbody></table></div>' : ui.empty('No candidate falls in this roll range')),
        footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Close</button>' +
          '<button class="btn btn-sm btn-primary" data-act="print"><i class="bi bi-printer"></i> Print attendance sheet</button>',
        onShow: function (api) {
          if (seated.length) {
            ui.dataTable(api.find('#table-seat-plan'), { pageLength: 10 });
          }
          api.find('[data-act="print"]').addEventListener('click', function () {
            api.close();
            ERec.exp.printDoc('attendance', stg.id, 'venue=' + v.id);
          });
        }
      });
    });

    var conf = view.querySelector('#btn-confirm');
    if (conf) conf.addEventListener('click', function () {
      var msg = fmt.plural(venues.length, 'venue') + ' will be confirmed for ' + fmt.esc(pipe.typeLabel(stg.type)) + '.';
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
