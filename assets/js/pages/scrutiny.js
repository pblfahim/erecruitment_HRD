/* Scrutiny - viva stages only.
   The application on file is matched against the hard copies the candidate
   brings on the day. Outcome is Accepted, Conditionally Accepted (documents
   to be produced before joining) or Rejected; conditional cases can be
   re-reviewed later and finally accepted or rejected. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var TABS = [
    ['ALL', 'All'], ['PENDING', 'Not scrutinised'], ['ACCEPTED', 'Accepted'],
    ['CONDITIONAL', 'Conditional'], ['REJECTED', 'Rejected']
  ];

  var tab = 'ALL';

  function statusOf(row) { return (row.scrutiny && row.scrutiny.status) || 'PENDING'; }

  function counts(roster) {
    var c = { PENDING: 0, ACCEPTED: 0, CONDITIONAL: 0, REJECTED: 0 };
    roster.forEach(function (r) { c[statusOf(r)] = (c[statusOf(r)] || 0) + 1; });
    return c;
  }

  function checklistFor(row, a) {
    if (row.scrutiny && row.scrutiny.checklist) return row.scrutiny.checklist;
    return a.documents.map(function (d) { return { name: d.name, ok: null }; });
  }

  /* ---------- scrutiny drawer ---------- */

  function openScrutiny(stg, row, onDone) {
    var a = store.applicant(row.applicantId);
    var checklist = checklistFor(row, a).map(function (d) { return { name: d.name, ok: d.ok }; });
    var existing = row.scrutiny || {};

    ui.drawer({
      title: 'Scrutiny · ' + fmt.esc(a.name),
      body:
        '<div class="d-flex gap-3 mb-3">' + ui.avatar(a.name, 'lg primary') +
          '<div><div class="fw-semibold" style="font-size:15px">' + fmt.esc(a.name) + '</div>' +
          '<div class="fs-12 muted mono">Roll ' + fmt.esc(row.rollNo || '—') + ' · ' + fmt.esc(a.appNo) + '</div>' +
          '<div class="mt-2">' + ui.statusPill(statusOf(row)) + '</div></div></div>' +

        '<div class="section-title">Declared in the application</div>' +
        '<dl class="kv">' +
          '<dt>Date of birth</dt><dd>' + fmt.date(a.dob) + '</dd>' +
          '<dt>National ID</dt><dd class="mono">' + fmt.esc(a.nid) + '</dd>' +
          '<dt>Highest degree</dt><dd>' + fmt.esc(ERec.pages.applicants.highestEdu(a)) + '</dd>' +
          '<dt>Experience</dt><dd>' + (a.experience.length
            ? fmt.esc(a.experience[0].role + ' — ' + a.experience[0].org + ' (' + a.experience[0].years + ' yrs)')
            : 'None declared') + '</dd>' +
        '</dl>' +

        '<div class="section-title">Hard copy verification</div>' +
        '<div class="fs-12 muted mb-2">Tick each document produced in original on the day.</div>' +
        '<div id="chk">' + checklist.map(function (d, i) {
          return '<div class="doc-row">' +
            '<div class="nm">' + fmt.esc(d.name) + '</div>' +
            '<div class="btn-group btn-group-sm" role="group">' +
              '<button class="btn btn-outline-success' + (d.ok === true ? ' active' : '') + '" data-ok="' + i + '"><i class="bi bi-check-lg"></i></button>' +
              '<button class="btn btn-outline-danger' + (d.ok === false ? ' active' : '') + '" data-no="' + i + '"><i class="bi bi-x-lg"></i></button>' +
            '</div></div>';
        }).join('') + '</div>' +
        '<div class="d-flex gap-2 mt-2">' +
          '<button class="btn btn-sm btn-light" id="chk-all">Mark all produced</button>' +
          '<span class="fs-12 muted align-self-center" id="chk-count"></span>' +
        '</div>' +

        '<div class="section-title">Remarks</div>' +
        '<textarea class="form-control" id="f-rem" rows="3" placeholder="e.g. Master\'s transcript not produced; undertaking taken.">' +
        fmt.esc(existing.remarks || '') + '</textarea>' +

        '<div class="mt-3" id="cond-wrap" hidden>' +
          '<label class="form-label">Produce remaining documents by</label>' +
          '<input type="date" class="form-control" id="f-deadline" value="' +
            fmt.esc(existing.deadline || fmt.addDays(fmt.isoDate(), 30)) + '">' +
        '</div>',
      footer:
        '<button class="btn btn-sm btn-success btn-icon" data-act="ACCEPTED"><i class="bi bi-check-lg"></i> Accept</button>' +
        '<button class="btn btn-sm btn-warning btn-icon" data-act="CONDITIONAL"><i class="bi bi-hourglass-split"></i> Conditional</button>' +
        '<button class="btn btn-sm btn-outline-danger btn-icon" data-act="REJECTED"><i class="bi bi-x-lg"></i> Reject</button>' +
        '<button class="btn btn-sm btn-light ms-auto" data-close-drawer>Close</button>',
      onShow: function (host) {
        function paintCount() {
          var okN = checklist.filter(function (d) { return d.ok === true; }).length;
          host.querySelector('#chk-count').textContent = okN + ' of ' + checklist.length + ' produced';
          host.querySelector('#cond-wrap').hidden = okN === checklist.length;
        }
        ui.on(host, '[data-ok]', 'click', function (e, b) {
          checklist[+b.dataset.ok].ok = true;
          b.classList.add('active');
          b.nextElementSibling.classList.remove('active');
          paintCount();
        });
        ui.on(host, '[data-no]', 'click', function (e, b) {
          checklist[+b.dataset.no].ok = false;
          b.classList.add('active');
          b.previousElementSibling.classList.remove('active');
          paintCount();
        });
        host.querySelector('#chk-all').addEventListener('click', function () {
          checklist.forEach(function (d) { d.ok = true; });
          host.querySelectorAll('[data-ok]').forEach(function (b) {
            b.classList.add('active'); b.nextElementSibling.classList.remove('active');
          });
          paintCount();
        });
        host.querySelector('[data-close-drawer]').addEventListener('click', ui.closeDrawer);
        paintCount();

        ui.on(host, '[data-act]', 'click', function (e, b) {
          var decision = b.dataset.act;
          var remarks = host.querySelector('#f-rem').value.trim();
          var missing = checklist.filter(function (d) { return d.ok !== true; });

          if (decision === 'REJECTED' && !remarks) {
            ui.toast('Remarks are required when rejecting', 'warning'); return;
          }
          if (decision === 'CONDITIONAL' && !missing.length) {
            ui.toast('All documents are produced — accept instead', 'warning'); return;
          }
          if (decision === 'ACCEPTED' && missing.length) {
            ui.confirm({
              title: 'Accept with missing documents?',
              body: fmt.plural(missing.length, 'document') + ' not marked as produced. ' +
                'Conditional acceptance is usually the right call here.',
              okText: 'Accept anyway'
            }).then(function (ok) { if (ok) commit(decision, remarks, checklist, host); });
            return;
          }
          commit(decision, remarks, checklist, host);
        });

        function commit(decision, remarks, list, host) {
          row.scrutiny = {
            status: decision,
            checklist: list,
            remarks: remarks,
            deadline: decision === 'CONDITIONAL' ? host.querySelector('#f-deadline').value : null,
            at: new Date().toISOString(),
            by: store.actingUser().name
          };
          if (decision === 'REJECTED') {
            row.resultStatus = 'FAILED';
            store.update('applicants', a.id, { status: 'REJECTED' });
          } else if (a.status === 'REJECTED') {
            store.update('applicants', a.id, { status: 'ACTIVE' });
          }
          store.save();
          store.audit('SCRUTINY', 'applicant', a.id, a.name + ' — scrutiny ' + decision.toLowerCase());
          ui.closeDrawer();
          ui.toast(a.name + ' marked ' + decision.toLowerCase());
          if (onDone) onDone();
        }
      }
    });
  }

  /* ---------- page ---------- */

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    if (stg.type !== 'VIVA') {
      ERec.router.go('#/circular/' + stg.circularId + '/stage/' + stg.id + '/marks');
      return;
    }
    var roster = store.rosterOf(stg.id);
    var cnt = counts(roster);
    var done = store.isStepDone(stg, 'scrutiny');

    var shown = roster.filter(function (r) { return tab === 'ALL' || statusOf(r) === tab; });

    var body = ui.lockedNotice(stg, 'scrutiny');

    body += ui.alert('info',
      '<strong>Match each candidate\'s application against the documents produced on the viva day.</strong> ' +
      'Accept, accept conditionally with a deadline to produce the remaining documents before joining, or reject. ' +
      'Conditional cases can be re-opened later and finally accepted or rejected.');

    if (cnt.CONDITIONAL) {
      body += ui.alert('warn', '<strong>' + fmt.plural(cnt.CONDITIONAL, 'candidate') +
        ' conditionally accepted</strong> — documents still to be produced. They are re-checked again at joining.');
    }

    body += '<div class="stat-grid">' +
      '<div class="stat"><div class="k">On roster</div><div class="v">' + roster.length + '</div></div>' +
      '<div class="stat"><div class="k">Not scrutinised</div><div class="v">' + cnt.PENDING + '</div></div>' +
      '<div class="stat"><div class="k">Accepted</div><div class="v text-success">' + cnt.ACCEPTED + '</div></div>' +
      '<div class="stat"><div class="k">Conditional</div><div class="v text-warning">' + cnt.CONDITIONAL + '</div></div>' +
      '<div class="stat"><div class="k">Rejected</div><div class="v text-danger">' + cnt.REJECTED + '</div></div>' +
      '</div>';

    var tabsHtml = '<div class="btn-group btn-group-sm" role="group">' + TABS.map(function (t) {
      var n = t[0] === 'ALL' ? roster.length : (cnt[t[0]] || 0);
      return '<button class="btn btn-' + (tab === t[0] ? 'primary' : 'light') + '" data-tab="' + t[0] + '">' +
        t[1] + ' <span class="badge rounded-pill text-bg-' + (tab === t[0] ? 'light text-dark' : 'secondary') + '">' + n + '</span></button>';
    }).join('') + '</div>';

    var rows = shown.map(function (r) {
      var a = store.applicant(r.applicantId);
      var st = statusOf(r);
      var sc = r.scrutiny;
      var okN = sc && sc.checklist ? sc.checklist.filter(function (d) { return d.ok === true; }).length : 0;
      var total = sc && sc.checklist ? sc.checklist.length : a.documents.length;
      return '<tr class="clickable" data-row="' + r.id + '">' +
        '<td class="mono nowrap">' + fmt.esc(r.rollNo || '—') + '</td>' +
        '<td><div class="name-cell">' + ui.avatar(a.name, 'sm') +
          '<div><div class="n">' + fmt.esc(a.name) + '</div><div class="m">' + fmt.esc(a.fatherName) + '</div></div></div></td>' +
        '<td class="fs-12">' + fmt.esc(ERec.pages.applicants.highestEdu(a)) + '</td>' +
        '<td class="num">' + (sc ? okN + ' / ' + total : '<span class="muted">' + total + ' declared</span>') + '</td>' +
        '<td>' + ui.statusPill(st) +
          (sc && sc.deadline && st === 'CONDITIONAL' ? '<div class="fs-12 muted mt-1">by ' + fmt.date(sc.deadline) + '</div>' : '') + '</td>' +
        '<td class="fs-12">' + (sc && sc.remarks ? fmt.esc(sc.remarks) : '<span class="muted">—</span>') + '</td>' +
        '<td class="text-end nowrap">' +
          '<button class="btn btn-sm btn-light" data-open="' + r.id + '">' +
          (st === 'PENDING' ? 'Scrutinise' : (st === 'CONDITIONAL' ? 'Re-review' : 'Revise')) + '</button></td>' +
        '</tr>';
    }).join('');

    body += ui.card({
      title: 'Document scrutiny',
      hint: 'Click a row to open the verification checklist.',
      actions: tabsHtml +
        '<button class="btn btn-sm btn-light btn-icon ms-2" id="btn-csv"><i class="bi bi-filetype-csv"></i> Export</button>',
      tight: true,
      body: shown.length
        ? '<div class="table-scroll"><table class="table-x"><thead><tr><th>Roll</th><th>Candidate</th>' +
          '<th>Degree</th><th class="num">Docs produced</th><th>Scrutiny</th><th>Remarks</th><th></th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        : ui.empty('Nothing in this view', 'Switch the filter above.', 'bi-folder-check')
    });

    ui.stagePage(view, stg, 'scrutiny', {
      body: body,
      action: done
        ? {
          note: cnt.PENDING
            ? '<span class="text-warning fw-semibold">' + fmt.plural(cnt.PENDING, 'candidate') + ' still to scrutinise</span>'
            : 'Scrutiny complete',
          secondary: [{ id: 'btn-reopen', label: 'Re-open scrutiny' }],
          primary: cnt.PENDING
            ? { id: 'btn-close', tone: 'success', icon: 'bi-check2-circle', label: 'Update scrutiny result' }
            : null
        }
        : {
          note: cnt.PENDING ? fmt.plural(cnt.PENDING, 'candidate') + ' not yet checked' : '',
          primary: { id: 'btn-close', tone: 'success', icon: 'bi-check2-circle', label: 'Finish scrutiny' }
        }
    });

    ui.on(view, '[data-tab]', 'click', function (e, b) { tab = b.dataset.tab; ERec.router.refresh(); });

    function openRow(id) {
      openScrutiny(stg, store.find('stageApplicants', id), function () { ERec.router.refresh(); });
    }
    ui.on(view, '[data-open]', 'click', function (e, b) { openRow(b.dataset.open); });
    ui.on(view, 'tr[data-row]', 'click', function (e, tr) {
      if (e.target.closest('button')) return;
      openRow(tr.dataset.row);
    });

    view.querySelector('#btn-csv').addEventListener('click', function () {
      ERec.exp.csv('scrutiny_' + stg.id + '.csv',
        ['Roll', 'Name', 'Scrutiny', 'Docs Produced', 'Deadline', 'Remarks', 'Scrutinised By'],
        roster.map(function (r) {
          var a = store.applicant(r.applicantId);
          var sc = r.scrutiny || {};
          var okN = sc.checklist ? sc.checklist.filter(function (d) { return d.ok === true; }).length : '';
          return [r.rollNo, a.name, statusOf(r), okN, sc.deadline || '', sc.remarks || '', sc.by || ''];
        }));
    });

    var close = view.querySelector('#btn-close');
    if (close) close.addEventListener('click', function () {
      ui.confirm({
        title: 'Complete scrutiny',
        body: cnt.PENDING
          ? '<strong class="text-danger">' + fmt.plural(cnt.PENDING, 'candidate') +
            ' have not been scrutinised.</strong> They will still appear in mark upload.'
          : 'Scrutiny is complete for all ' + fmt.plural(roster.length, 'candidate') +
            '. Rejected candidates are excluded from mark upload.',
        okText: 'Complete'
      }).then(function (ok) {
        if (!ok) return;
        store.markStep(stg.id, 'scrutiny', {
          accepted: cnt.ACCEPTED, conditional: cnt.CONDITIONAL, rejected: cnt.REJECTED, pending: cnt.PENDING
        });
        store.audit('CLOSE_SCRUTINY', 'stage', stg.id,
          'Scrutiny closed — ' + cnt.ACCEPTED + ' accepted, ' + cnt.CONDITIONAL + ' conditional, ' + cnt.REJECTED + ' rejected');
        ui.toast('Scrutiny completed');
        ERec.router.refresh();
      });
    });

    var reopen = view.querySelector('#btn-reopen');
    if (reopen) reopen.addEventListener('click', function () {
      store.clearStep(stg.id, 'scrutiny');
      ui.toast('Scrutiny re-opened');
      ERec.router.refresh();
    });
  }

  ERec.pages.scrutiny = { render: render, statusOf: statusOf, openScrutiny: openScrutiny };
})(window);
