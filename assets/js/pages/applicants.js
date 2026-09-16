/* Step 1 - Search applicants under a circular and confirm the roster for
   this stage. On a later stage the roster arrives from the previous stage's
   forward, so the list is shown read-only. */
(function (global) {
  'use strict';

  var ERec = global.ERec;
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt, pipe = ERec.pipeline;

  var filters = {};   // kept per stage so going back preserves the search
  var picks = {};     // ditto for the tick boxes - a filter change must not wipe a selection

  function highestEdu(a) {
    var e = a.education[a.education.length - 1];
    return e ? (e.level + (e.subject ? ' (' + e.subject + ')' : '')) : '—';
  }

  function matches(a, f) {
    if (f.q) {
      var q = f.q.toLowerCase();
      var hay = [a.name, a.appNo, a.rollNo, a.mobile, a.email, a.fatherName].join(' ').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    if (f.gender && a.gender !== f.gender) return false;
    if (f.district && a.district !== f.district) return false;
    if (f.edu && highestEdu(a).indexOf(f.edu) < 0) return false;
    if (f.status && a.status !== f.status) return false;
    return true;
  }

  /* The complete application as submitted. Shared with the scrutiny screen,
     which shows it side by side with the verification panel. */
  function fullProfileHtml(a) {
    var circ = store.circular(a.circularId);
    function block(title, rows) {
      return '<div class="cv-block"><div class="t">' + title + '</div>' +
        '<dl class="kv">' + rows.map(function (r) {
          return '<dt>' + r[0] + '</dt><dd' + (r[2] ? ' class="' + r[2] + '"' : '') + '>' +
            (r[1] === '' || r[1] === null || r[1] === undefined ? '<span class="muted">—</span>' : r[1]) + '</dd>';
        }).join('') + '</dl></div>';
    }

    return block('Applied for', [
      ['Post', fmt.esc(circ.post)],
      ['Circular no.', fmt.esc(circ.code), 'mono'],
      ['Application no.', fmt.esc(a.appNo), 'mono'],
      ['Applied on', fmt.date(a.appliedAt)],
      ['Roll number', a.rollNo ? fmt.esc(a.rollNo) : '', 'mono']
    ]) +
      block('Personal information', [
        ['Full name', fmt.esc(a.name)],
        ['Father\'s name', fmt.esc(a.fatherName)],
        ['Mother\'s name', fmt.esc(a.motherName)],
        ['Date of birth', fmt.date(a.dob)],
        ['Gender', fmt.esc(a.gender)],
        ['Marital status', fmt.esc(a.maritalStatus)],
        ['Religion', fmt.esc(a.religion)],
        ['Nationality', fmt.esc(a.nationality)],
        ['Blood group', fmt.esc(a.bloodGroup)],
        ['National ID', fmt.esc(a.nid), 'mono'],
        ['Quota claimed', fmt.esc(a.quota)]
      ]) +
      block('Contact', [
        ['Mobile', fmt.esc(a.mobile), 'mono'],
        ['Alternate contact', fmt.esc(a.altContact), 'mono'],
        ['E-mail', fmt.esc(a.email)],
        ['Present address', fmt.esc(a.presentAddress || a.address)],
        ['Permanent address', fmt.esc(a.permanentAddress)],
        ['Home district', fmt.esc(a.district)]
      ]) +
      '<div class="cv-block"><div class="t">Academic record</div>' +
      '<table class="table-x"><thead><tr><th>Examination</th><th>Institution / board</th>' +
      '<th>Year</th><th>Result</th></tr></thead><tbody>' +
      a.education.map(function (e) {
        return '<tr><td>' + fmt.esc(e.level) +
          (e.subject ? '<div class="fs-12 muted">' + fmt.esc(e.subject) + '</div>' : '') + '</td>' +
          '<td>' + fmt.esc(e.board) + '</td><td>' + e.year + '</td><td>' + fmt.esc(e.result) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="cv-block"><div class="t">Employment history</div>' +
      (a.experience.length
        ? '<table class="table-x"><thead><tr><th>Organisation</th><th>Designation</th><th>Years</th></tr></thead><tbody>' +
        a.experience.map(function (x) {
          return '<tr><td>' + fmt.esc(x.org) + '</td><td>' + fmt.esc(x.role) + '</td><td>' + x.years + '</td></tr>';
        }).join('') + '</tbody></table>'
        : '<div class="fs-13 muted">No experience declared (fresher).</div>') + '</div>' +
      block('Other information', [
        ['Computer skills', fmt.esc(a.computerSkills)],
        ['Languages', fmt.esc(a.languages)],
        ['Expected salary', a.expectedSalary ? fmt.money(a.expectedSalary) : '']
      ]);
  }

  /* ---------- applicant profile drawer ---------- */

  function profileDrawer(a) {
    var circ = store.circular(a.circularId);
    var rows = store.where('stageApplicants', function (r) { return r.applicantId === a.id; });

    var history = rows.map(function (r) {
      var s = store.stage(r.stageId);
      if (!s) return '';
      return '<tr><td>' + fmt.esc(pipe.typeLabel(s.type)) + '</td>' +
        '<td class="mono">' + fmt.esc(r.rollNo || '—') + '</td>' +
        '<td class="num">' + (r.marks === null || r.marks === undefined ? '—' : r.marks + ' / ' + s.fullMarks) + '</td>' +
        '<td>' + (r.attendance ? ui.statusPill(r.attendance) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + ui.statusPill(r.resultStatus) + '</td></tr>';
    }).join('');

    ui.drawer({
      title: fmt.esc(a.name),
      body:
        '<div class="d-flex gap-3 mb-3">' + ui.avatar(a.name, 'lg primary') +
        '<div><div class="fw-semibold" style="font-size:16px">' + fmt.esc(a.name) + '</div>' +
        '<div class="fs-12 muted mono">' + fmt.esc(a.appNo) + (a.rollNo ? ' · Roll ' + fmt.esc(a.rollNo) : '') + '</div>' +
        '<div class="mt-2">' + ui.statusPill(a.status) + '</div></div></div>' +

        fullProfileHtml(a) +

        (history ? '<div class="cv-block"><div class="t">Examination record</div>' +
          '<table class="table-x"><thead><tr><th>Stage</th><th>Roll</th><th class="num">Marks</th><th>Attendance</th><th>Result</th></tr></thead>' +
          '<tbody>' + history + '</tbody></table></div>' : ''),
      footer:
        '<button class="btn btn-sm btn-primary btn-icon" data-print="' + a.id + '"><i class="bi bi-printer"></i> Print profile (PDF)</button>' +
        '<button class="btn btn-sm btn-light ms-auto" data-close-drawer>Close</button>',
      onShow: function (host) {
        host.querySelector('[data-print]').addEventListener('click', function () {
          ui.closeDrawer();
          ERec.exp.printDoc('profile', a.id);
        });
        host.querySelector('[data-close-drawer]').addEventListener('click', ui.closeDrawer);
      }
    });
  }

  /* Top up a circular with more sample applications - used when a circular
     was created with none, or when you want a bigger list to play with. */
  function addDemoApplicants(c, after) {
    var existing = store.applicantsOf(c.id).length;
    ui.modal({
      title: 'Add demo applicants',
      body: '<p class="fs-13 muted">Generates sample applications against <strong>' + fmt.esc(c.post) +
        '</strong> so this circular can be walked through. ' +
        (existing ? 'There are already ' + fmt.plural(existing, 'applicant') + '.' : 'There are none yet.') + '</p>' +
        '<label class="form-label">How many to add</label>' +
        '<input type="number" min="1" max="300" class="form-control" id="f-n" value="40">',
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" data-act="go">Generate</button>',
      onShow: function (api) {
        api.find('[data-act="go"]').addEventListener('click', function () {
          var n = parseInt(api.find('#f-n').value, 10);
          if (isNaN(n) || n < 1) { ui.toast('Enter how many to add', 'warning'); return; }
          ERec.seed.makeApplicants({
            circularId: c.id, count: n, startIndex: existing,
            prefix: (c.code || c.id).replace(/\W+/g, '').slice(-6).toUpperCase() || 'APP',
            appliedAt: c.applyStart
          }).forEach(function (a) { store.insert('applicants', a); });
          store.audit('ADD_APPLICANTS', 'circular', c.id, fmt.plural(n, 'demo applicant') + ' generated');
          api.close();
          ui.toast(fmt.plural(n, 'applicant') + ' added');
          if (after) after();
        });
      }
    });
  }

  /* ---------- supplementary call ----------
     "I called 50 for the viva, now I want 10 more from the written pool."
     Candidates are pulled from the previous stage's leftovers, added to this
     stage as a later call round, and every downstream step (venue, admit
     card, scrutiny, marks) starts reporting them as outstanding work. */

  function nextRound(stageId) {
    var max = 1;
    store.rosterOf(stageId).forEach(function (r) { max = Math.max(max, r.callRound || 1); });
    return max + 1;
  }

  function callMoreModal(stg, after) {
    var prev = pipe.previousStage(stg);
    if (!prev) { ui.toast('This is the first stage — use the candidate list instead', 'warning'); return; }

    /* everyone who sat the previous exam but is not on this stage's list */
    var pool = store.rosterOf(prev.id)
      .filter(function (r) { return !store.rosterRow(stg.id, r.applicantId); })
      .filter(function (r) { return r.attendance !== 'ABSENT'; })
      .sort(function (a, b) { return Number(b.marks || 0) - Number(a.marks || 0); });

    var panels = store.panelsOf(stg.id);
    var chosen = {};

    if (!pool.length) {
      ui.modal({
        title: 'Call more candidates',
        body: ui.empty('Nobody left to call',
          'Every candidate who appeared in the ' + pipe.typeLabel(prev.type) +
          ' examination is already on this list.', 'bi-person-x'),
        footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Close</button>'
      });
      return;
    }

    ui.modal({
      title: 'Call more candidates for ' + fmt.esc(pipe.typeLabel(stg.type)),
      size: 'xl',
      body:
        ui.alert('info', 'These candidates appeared in the <strong>' + fmt.esc(pipe.typeLabel(prev.type)) +
          '</strong> examination but were not called for ' + fmt.esc(pipe.typeLabel(stg.type)) +
          '. They are listed highest mark first. Whoever you add keeps their existing roll number and ' +
          'will show up as pending on venue, admit card, scrutiny and marks.') +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-3"><label class="form-label">Take the top</label>' +
        '<div class="input-group input-group-sm">' +
        '<input type="number" min="1" max="' + pool.length + '" class="form-control" id="cm-top" value="10">' +
        '<button class="btn btn-outline-primary" id="cm-take">Select</button></div></div>' +
        '<div class="col-md-4"><label class="form-label">Interview panel <span class="muted">(optional)</span></label>' +
        '<select class="form-select form-select-sm" id="cm-panel">' +
        '<option value="">Not assigned</option>' +
        panels.map(function (p) {
          return '<option value="' + p.id + '">' + fmt.esc(p.name) + ' · ' + fmt.date(p.slotDate) + '</option>';
        }).join('') +
        '<option value="__new">+ Create a new panel</option>' +
        '</select></div>' +
        '<div class="col-md-5" id="cm-newpanel" hidden>' +
        '<label class="form-label">New panel name &amp; date</label>' +
        '<div class="input-group input-group-sm">' +
        '<input class="form-control" id="cm-pname" value="Supplementary Panel">' +
        '<input type="date" class="form-control" id="cm-pdate" value="' + fmt.addDays(fmt.isoDate(), 10) + '">' +
        '</div></div>' +
        '</div>' +
        '<label class="form-label">Reason for the supplementary call</label>' +
        '<input class="form-control form-control-sm mb-3" id="cm-note" ' +
        'placeholder="e.g. 4 selected candidates did not join — calling 10 more from the waiting pool">' +
        '<div class="table-scroll" style="max-height:340px">' +
        '<table class="table-x"><thead><tr><th style="width:34px"></th><th>Rank</th><th>Roll</th>' +
        '<th>Candidate</th><th class="num">' + fmt.esc(pipe.typeLabel(prev.type)) + ' marks</th>' +
        '<th>Result</th></tr></thead><tbody>' +
        pool.map(function (r, i) {
          var a = store.applicant(r.applicantId);
          return '<tr data-pool="' + r.id + '"><td><input type="checkbox" class="form-check-input" data-cm="' + r.id + '"></td>' +
            '<td class="num muted">' + (i + 1) + '</td>' +
            '<td class="mono nowrap">' + fmt.esc(r.rollNo || '—') + '</td>' +
            '<td>' + fmt.esc(a.name) + '<div class="fs-12 muted">' + fmt.esc(a.fatherName) + '</div></td>' +
            '<td class="num">' + (r.marks === null || r.marks === undefined ? '—' : r.marks + ' / ' + prev.fullMarks) + '</td>' +
            '<td>' + ui.statusPill(r.resultStatus) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>' +
        '<div class="mt-2 fs-13"><strong id="cm-count">0</strong> selected</div>',
      footer: '<button class="btn btn-sm btn-light" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn btn-sm btn-primary" data-act="go">Add to this stage</button>',
      onShow: function (api) {
        function count() {
          var n = Object.keys(chosen).filter(function (k) { return chosen[k]; }).length;
          api.find('#cm-count').textContent = n;
        }
        ui.on(api.el, '[data-cm]', 'change', function (e, cb) {
          chosen[cb.dataset.cm] = cb.checked;
          cb.closest('tr').classList.toggle('row-sel', cb.checked);
          count();
        });
        api.find('#cm-take').addEventListener('click', function () {
          var n = parseInt(api.find('#cm-top').value, 10) || 0;
          api.el.querySelectorAll('[data-cm]').forEach(function (cb, i) {
            cb.checked = i < n;
            chosen[cb.dataset.cm] = i < n;
            cb.closest('tr').classList.toggle('row-sel', i < n);
          });
          count();
        });
        api.find('#cm-panel').addEventListener('change', function (e) {
          api.find('#cm-newpanel').hidden = e.target.value !== '__new';
        });

        api.find('[data-act="go"]').addEventListener('click', function () {
          var ids = Object.keys(chosen).filter(function (k) { return chosen[k]; });
          if (!ids.length) { ui.toast('Select at least one candidate', 'warning'); return; }
          var note = api.find('#cm-note').value.trim();
          var round = nextRound(stg.id);

          var panelId = api.find('#cm-panel').value;
          if (panelId === '__new') {
            var p = store.insert('panels', {
              id: fmt.uid('pnl'), stageId: stg.id,
              name: api.find('#cm-pname').value.trim() || 'Supplementary Panel',
              members: ['Chairman', 'Member (HR)'],
              slotDate: api.find('#cm-pdate').value, applicantIds: []
            });
            panelId = p.id;
          }

          ids.forEach(function (rowId) {
            var src = store.find('stageApplicants', rowId);
            store.insert('stageApplicants', {
              id: fmt.uid('sa'), stageId: stg.id, applicantId: src.applicantId, rollNo: src.rollNo,
              venueId: null, attendance: null, marks: null, resultStatus: 'PENDING',
              selectedForNext: false, selectionBasis: null, scrutiny: null,
              panelId: panelId || null, callRound: round, callNote: note
            });
            /* keep the previous stage's record honest about who was taken */
            src.selectedForNext = true;
            if (!src.selectionBasis) src.selectionBasis = 'SUPPLEMENTARY';
            if (panelId) {
              var pn = store.find('panels', panelId);
              if (pn && pn.applicantIds.indexOf(src.applicantId) < 0) pn.applicantIds.push(src.applicantId);
            }
          });

          var search = store.stepState(stg, 'search');
          store.markStep(stg.id, 'search', {
            count: store.rosterOf(stg.id).length,
            rounds: round,
            lastCall: { at: new Date().toISOString(), added: ids.length, note: note }
          });
          store.save();
          store.audit('SUPPLEMENTARY_CALL', 'stage', stg.id,
            fmt.plural(ids.length, 'more candidate') + ' called for ' + pipe.typeLabel(stg.type) +
            ' (call ' + round + ')' + (note ? ' — ' + note : ''));
          api.close();
          ui.toast(fmt.plural(ids.length, 'candidate') + ' added — check Venue, Exam Notice, Scrutiny and Marks');
          if (after) after();
        });
      }
    });
  }

  /* ---------- main ---------- */

  function render(view, params) {
    var stg = store.stage(params.sid);
    if (!stg) { ERec.router.go('#/circulars'); return; }
    var c = store.circular(stg.circularId);
    var ctx = pipe.context(stg);
    var confirmed = store.isStepDone(stg, 'search');
    var roster = store.rosterOf(stg.id);
    var f = filters[stg.id] = filters[stg.id] || { q: '', gender: '', district: '', edu: '', status: '' };

    /* Later stages inherit their roster from the previous stage. */
    var inherited = !ctx.isFirst;
    var source;
    if (inherited) {
      source = roster.map(function (r) { return store.applicant(r.applicantId); }).filter(Boolean);
    } else {
      source = store.applicantsOf(c.id);
    }
    var list = source.filter(function (a) { return matches(a, f); });

    /* Selection state: once confirmed the roster IS the selection; otherwise
       it is remembered per stage and starts as every active applicant. */
    var selected;
    if (confirmed) {
      selected = {};
      roster.forEach(function (r) { selected[r.applicantId] = true; });
    } else if (inherited) {
      selected = {};
    } else {
      if (!picks[stg.id]) {
        picks[stg.id] = {};
        source.forEach(function (a) { if (a.status === 'APPLIED') picks[stg.id][a.id] = true; });
      }
      selected = picks[stg.id];
    }
    var selTotal = Object.keys(selected).filter(function (k) { return selected[k]; }).length;

    var districts = Array.from(new Set(store.all('applicants').map(function (a) { return a.district; }))).sort();

    var body = ui.lockedNotice(stg, 'search');

    if (!inherited && !source.length) {
      body += ui.alert('warn', '<strong>This circular has no applications yet.</strong> ' +
        'Use <em>Add demo applicants</em> to generate a sample list so you can walk the circular through.');
    }

    if (inherited && !roster.length) {
      body += ui.alert('warn',
        '<strong>No candidates have reached this stage yet.</strong> Complete the mark upload and ' +
        '<em>Forward to next stage</em> on ' + fmt.esc(pipe.typeLabel(ctx.all[ctx.index - 1].type)) + ' first.');
    } else if (inherited) {
      var rounds = {};
      roster.forEach(function (r) { rounds[r.callRound || 1] = (rounds[r.callRound || 1] || 0) + 1; });
      var roundKeys = Object.keys(rounds);
      body += ui.alert('info',
        '<strong>' + fmt.plural(roster.length, 'candidate') + ' called from ' +
        fmt.esc(pipe.typeLabel(ctx.all[ctx.index - 1].type)) + '.</strong> ' +
        (roundKeys.length > 1
          ? roundKeys.map(function (k) {
            return (k === '1' ? 'First call' : 'Call ' + k) + ': ' + rounds[k];
          }).join(' · ') + '. '
          : '') +
        'Need a few more? Use <strong>Call more candidates</strong> below — they are picked from the ' +
        'candidates who sat the previous examination but were not called.');
    }

    var filterBar =
      '<div class="filter-bar">' +
      '<div class="fg" style="min-width:230px"><label>Search</label>' +
      '<input class="form-control" id="f-q" placeholder="Name, application no., roll, mobile" value="' + fmt.esc(f.q) + '"></div>' +
      '<div class="fg"><label>Gender</label><select class="form-select" id="f-gender">' +
      ['', 'Male', 'Female'].map(function (g) {
        return '<option value="' + g + '"' + (f.gender === g ? ' selected' : '') + '>' + (g || 'All') + '</option>';
      }).join('') + '</select></div>' +
      '<div class="fg"><label>Home district</label><select class="form-select" id="f-district">' +
      '<option value="">All</option>' + districts.map(function (d) {
        return '<option value="' + fmt.esc(d) + '"' + (f.district === d ? ' selected' : '') + '>' + fmt.esc(d) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="fg"><label>Highest degree</label><select class="form-select" id="f-edu">' +
      '<option value="">All</option>' + ['BBA', 'MBA', 'B.Sc.', 'M.Sc.', 'LL.B.', 'LL.M.', 'B.A.', 'M.Com.'].map(function (d) {
        return '<option value="' + d + '"' + (f.edu === d ? ' selected' : '') + '>' + d + '</option>';
      }).join('') + '</select></div>' +
      '<div class="fg"><label>Status</label><select class="form-select" id="f-status">' +
      [['', 'All'], ['APPLIED', 'Applied'], ['REJECTED', 'Rejected'], ['SELECTED', 'Selected'], ['JOINED', 'Joined']].map(function (s) {
        return '<option value="' + s[0] + '"' + (f.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>';
      }).join('') + '</select></div>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-sm btn-light" id="f-clear"><i class="bi bi-x-circle"></i> Clear</button>' +
      '</div>';

    var rows = list.map(function (a) {
      var r = store.rosterRow(stg.id, a.id);
      return '<tr data-aid="' + a.id + '" class="clickable' + (selected[a.id] ? ' row-sel' : '') + '">' +
        '<td><input type="checkbox" class="form-check-input" data-pick="' + a.id + '"' +
        (selected[a.id] ? ' checked' : '') + (confirmed || inherited ? ' disabled' : '') + '></td>' +
        '<td class="mono nowrap">' + fmt.esc((r && r.rollNo) || a.rollNo || '—') + '</td>' +
        '<td class="mono nowrap fs-12">' + fmt.esc(a.appNo) + '</td>' +
        '<td><div class="name-cell">' + ui.avatar(a.name, 'sm') +
        '<div><div class="n">' + fmt.esc(a.name) +
        (r && r.callRound > 1 ? ' ' + ui.pill('Call ' + r.callRound, 'amber') : '') + '</div>' +
        '<div class="m">' + fmt.esc(a.fatherName) + '</div></div></div></td>' +
        '<td class="fs-12">' + fmt.esc(highestEdu(a)) + '</td>' +
        '<td class="fs-12">' + fmt.esc(a.district) + '</td>' +
        '<td class="mono fs-12">' + fmt.esc(a.mobile) + '</td>' +
        '<td>' + ui.statusPill(a.status) + '</td>' +
        '<td class="text-end nowrap">' +
        '<button class="btn btn-sm btn-light" data-view="' + a.id + '" title="View application"><i class="bi bi-eye"></i></button> ' +
        '<button class="btn btn-sm btn-light" data-pdf="' + a.id + '" title="Print profile"><i class="bi bi-printer"></i></button>' +
        '</td></tr>';
    }).join('');

    body += ui.card({
      title: inherited ? 'Stage roster' : 'Applicants under this circular',
      hint: inherited ? 'Candidates carried forward from the previous stage.'
        : 'Select the candidates who will sit for this examination, then confirm the list.',
      actions:
        (!inherited && !confirmed
          ? '<button class="btn btn-sm btn-light btn-icon" id="btn-add-demo"><i class="bi bi-person-plus"></i> Add demo applicants</button>'
          : '') +
        '<button class="btn btn-sm btn-light btn-icon ms-2" id="btn-csv"><i class="bi bi-filetype-csv"></i> Export Excel (CSV)</button>' +
        '<button class="btn btn-sm btn-light btn-icon ms-2" id="btn-print-list"><i class="bi bi-printer"></i> Print list (PDF)</button>',
      tight: true,
      body:
        filterBar +
        (confirmed || inherited ? '' :
          '<div class="selbar"><span id="sel-count"><strong>' + selTotal + '</strong> of ' + source.length +
          ' applicants selected<span class="muted"> · ' + list.length + ' shown by the current filter</span></span>' +
          '<div class="spacer"></div>' +
          '<button class="btn btn-sm btn-light" id="btn-all">Select all filtered</button>' +
          '<button class="btn btn-sm btn-light" id="btn-none">Clear all selections</button></div>') +
        (list.length ?
          '<div class="table-scroll"><table class="table-x"><thead><tr>' +
          '<th style="width:34px"><input type="checkbox" class="form-check-input" id="pick-all"' +
          (confirmed || inherited ? ' disabled' : '') + '></th>' +
          '<th>Roll</th><th>Application no.</th><th>Candidate</th><th>Highest degree</th>' +
          '<th>District</th><th>Mobile</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : ui.empty('No applicant matches this search', 'Adjust or clear the filters.', 'bi-search'))
    });

    /* one obvious button per state */
    var action = {};
    if (inherited) {
      action.note = fmt.plural(roster.length, 'candidate') + ' on this list';
      action.secondary = [{ id: 'btn-call-more', label: 'Call more candidates', icon: 'bi-person-plus', tone: 'outline-primary' }];
    } else if (confirmed) {
      action.note = fmt.plural(roster.length, 'candidate') + ' confirmed';
      action.secondary = [{ id: 'btn-reopen', label: 'Change this list' }];
    } else {
      action.primary = {
        id: 'btn-confirm', tone: 'success', icon: 'bi-check2-circle',
        label: 'Confirm ' + fmt.plural(selTotal, 'candidate'), disabled: selTotal === 0
      };
    }

    ui.stagePage(view, stg, 'search', { body: body, action: action });

    /* ---- filter wiring ---- */
    function setFilter(key, val) { f[key] = val; ERec.router.refresh(); }
    var q = view.querySelector('#f-q');
    if (q) {
      var t = null;
      q.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { setFilter('q', q.value); }, 260);
      });
      q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(t); setFilter('q', q.value); } });
    }
    ['gender', 'district', 'edu', 'status'].forEach(function (k) {
      var el = view.querySelector('#f-' + k);
      if (el) el.addEventListener('change', function () { setFilter(k, el.value); });
    });
    var clr = view.querySelector('#f-clear');
    if (clr) clr.addEventListener('click', function () {
      filters[stg.id] = { q: '', gender: '', district: '', edu: '', status: '' };
      ERec.router.refresh();
    });

    /* ---- selection ---- */
    function refreshCount() {
      var n = Object.keys(selected).filter(function (k) { return selected[k]; }).length;
      var el = view.querySelector('#sel-count');
      if (el) {
        el.innerHTML = '<strong>' + n + '</strong> of ' + source.length +
          ' applicants selected<span class="muted"> · ' + list.length + ' shown by the current filter</span>';
      }
      var btn = view.querySelector('#btn-confirm');
      if (btn) btn.disabled = n === 0;
    }
    function setVisible(on) {
      view.querySelectorAll('[data-pick]').forEach(function (cb) {
        cb.checked = on;
        selected[cb.dataset.pick] = on;
        cb.closest('tr').classList.toggle('row-sel', on);
      });
      refreshCount();
    }
    ui.on(view, '[data-pick]', 'change', function (e, cb) {
      selected[cb.dataset.pick] = cb.checked;
      cb.closest('tr').classList.toggle('row-sel', cb.checked);
      refreshCount();
    });
    var pickAll = view.querySelector('#pick-all');
    if (pickAll) pickAll.addEventListener('change', function () { setVisible(pickAll.checked); });
    var bAll = view.querySelector('#btn-all');
    if (bAll) bAll.addEventListener('click', function () { setVisible(true); });
    /* "Clear all" wipes the whole selection, not just the filtered rows -
       otherwise a hidden row could still be enrolled on Confirm. */
    var bNone = view.querySelector('#btn-none');
    if (bNone) bNone.addEventListener('click', function () {
      Object.keys(selected).forEach(function (k) { delete selected[k]; });
      view.querySelectorAll('[data-pick]').forEach(function (cb) {
        cb.checked = false;
        cb.closest('tr').classList.remove('row-sel');
      });
      refreshCount();
    });

    /* ---- row actions ---- */
    ui.on(view, 'tr[data-aid]', 'click', function (e, tr) {
      if (e.target.closest('button') || e.target.closest('input')) return;
      profileDrawer(store.applicant(tr.dataset.aid));
    });
    ui.on(view, '[data-view]', 'click', function (e, b) { profileDrawer(store.applicant(b.dataset.view)); });
    ui.on(view, '[data-pdf]', 'click', function (e, b) { ERec.exp.printDoc('profile', b.dataset.pdf); });

    /* ---- exports ---- */
    view.querySelector('#btn-csv').addEventListener('click', function () {
      ERec.exp.csv(c.post.replace(/\W+/g, '_') + '_' + pipe.typeLabel(stg.type) + '_applicants.csv',
        ['Roll', 'Application No', 'Name', "Father's Name", 'Gender', 'Date of Birth', 'Mobile', 'Email', 'District', 'Highest Degree', 'Status'],
        list.map(function (a) {
          var r = store.rosterRow(stg.id, a.id);
          return [(r && r.rollNo) || a.rollNo || '', a.appNo, a.name, a.fatherName, a.gender, a.dob,
          a.mobile, a.email, a.district, highestEdu(a), a.status];
        }));
    });
    view.querySelector('#btn-print-list').addEventListener('click', function () {
      ERec.exp.printDoc('applicant-list', stg.id);
    });

    /* ---- confirm / re-open ---- */
    var bConfirm = view.querySelector('#btn-confirm');
    if (bConfirm) bConfirm.addEventListener('click', function () {
      var ids = Object.keys(selected).filter(function (k) { return selected[k]; });
      if (!ids.length) { ui.toast('Select at least one candidate', 'warning'); return; }
      ui.confirm({
        title: 'Confirm candidate list',
        body: fmt.plural(ids.length, 'candidate') + ' will be enrolled into <strong>' +
          fmt.esc(pipe.stageName(stg)) + '</strong>. The next steps (roll number, venue, admit card) act on this list.',
        okText: 'Confirm list'
      }).then(function (ok) {
        if (!ok) return;
        ids.forEach(function (aid) {
          if (store.rosterRow(stg.id, aid)) return;
          var a = store.applicant(aid);
          store.insert('stageApplicants', {
            id: fmt.uid('sa'), stageId: stg.id, applicantId: aid, rollNo: a.rollNo,
            venueId: null, attendance: null, marks: null, resultStatus: 'PENDING',
            selectedForNext: false, selectionBasis: null, scrutiny: null, panelId: null
          });
        });
        store.markStep(stg.id, 'search', { count: ids.length });
        store.audit('CONFIRM_LIST', 'stage', stg.id, fmt.plural(ids.length, 'candidate') + ' enrolled in ' + pipe.typeLabel(stg.type));
        ui.toast(fmt.plural(ids.length, 'candidate') + ' enrolled');
        ERec.router.refresh();
      });
    });

    var bDemo = view.querySelector('#btn-add-demo');
    if (bDemo) bDemo.addEventListener('click', function () {
      addDemoApplicants(c, function () {
        delete picks[stg.id];       // let the new applicants be pre-selected too
        ERec.router.refresh();
      });
    });

    var bCall = view.querySelector('#btn-call-more');
    if (bCall) bCall.addEventListener('click', function () {
      callMoreModal(stg, function () { ERec.router.refresh(); });
    });

    var bReopen = view.querySelector('#btn-reopen');
    if (bReopen) bReopen.addEventListener('click', function () {
      ui.confirm({
        title: 'Re-open candidate list',
        body: 'The confirmed list will be cleared so you can select again. Roll numbers, venue allocation and marks captured for this stage will be discarded.',
        okText: 'Re-open', danger: true
      }).then(function (ok) {
        if (!ok) return;
        store.rosterOf(stg.id).forEach(function (r) { store.remove('stageApplicants', r.id); });
        ['search', 'roll', 'venue', 'instructions', 'initiate', 'scrutiny', 'marks', 'forward']
          .forEach(function (k) { store.clearStep(stg.id, k); });
        store.audit('REOPEN_LIST', 'stage', stg.id, 'Candidate list re-opened');
        ui.toast('List re-opened');
        ERec.router.refresh();
      });
    });
  }

  ERec.pages.applicants = {
    render: render, profileDrawer: profileDrawer, highestEdu: highestEdu,
    fullProfileHtml: fullProfileHtml,
    callMoreModal: callMoreModal
  };
})(window);
