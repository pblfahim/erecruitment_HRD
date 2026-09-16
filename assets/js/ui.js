/* Shared renderers and overlays. Pages build HTML strings and hand them here
   so the chrome (step header, cards, drawer, modals, toasts, action bar)
   stays consistent, polished, and matches the Pubali Bank PLC design language. */
(function (global) {
  'use strict';

  var ERec = global.ERec = global.ERec || {};
  var fmt = ERec.fmt;

  /* ---------- toasts ---------- */

  var TONE_ICON = {
    success: 'bi-check-circle-fill',
    danger: 'bi-x-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill'
  };

  function toast(message, tone) {
    tone = tone || 'success';
    var host = document.getElementById('toast-host');
    var el = document.createElement('div');
    el.className = 'toast align-items-center text-bg-' + (tone === 'success' ? 'success' : tone) + ' border-0 show mb-2 shadow';
    el.setAttribute('role', 'alert');
    el.innerHTML =
      '<div class="d-flex">' +
      '<div class="toast-body"><i class="bi ' + (TONE_ICON[tone] || TONE_ICON.info) + ' me-2"></i>' + fmt.esc(message) + '</div>' +
      '<button type="button" class="btn-close btn-close-white me-2 m-auto"></button>' +
      '</div>';
    host.appendChild(el);
    el.querySelector('.btn-close').addEventListener('click', function () { el.remove(); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 300);
    }, 3800);
  }

  /* ---------- modal ---------- */

  var lastModal = { key: '', at: 0 };

  function modal(opts) {
    var host = document.getElementById('modal-host');

    /* Belt and braces against the same dialog opening twice from one click.
       Intentional stacking (a confirm on top of a form) still works because
       the guard only catches an identical title within the same moment. */
    var key = String(opts.title || '');
    var now = Date.now();
    if (key && key === lastModal.key && now - lastModal.at < 500) {
      return { el: null, close: function () {}, find: function () { return null; } };
    }
    lastModal = { key: key, at: now };

    var wrap = document.createElement('div');
    wrap.className = 'modal fade';
    wrap.tabIndex = -1;
    wrap.innerHTML =
      '<div class="modal-dialog ' + (opts.size ? 'modal-' + opts.size : '') + ' modal-dialog-centered modal-dialog-scrollable">' +
      '<div class="modal-content border-0 shadow-lg">' +
      '<div class="modal-header py-3 px-4 border-bottom bg-light">' +
      '<h5 class="modal-title fs-6 fw-bold text-dark mb-0">' + (opts.title || '') + '</h5>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
      '</div>' +
      '<div class="modal-body p-4">' + (opts.body || '') + '</div>' +
      (opts.footer === null ? '' : '<div class="modal-footer py-3 px-4 bg-light border-top">' + (opts.footer || '') + '</div>') +
      '</div>' +
      '</div>';
    host.appendChild(wrap);
    var inst = new global.bootstrap.Modal(wrap, { backdrop: opts.static ? 'static' : true });
    wrap.addEventListener('hidden.bs.modal', function () {
      wrap.remove();
      /* Bootstrap strips modal-open from <body> whenever any dialog closes.
         When one modal was opened on top of another (correcting a field from
         inside the scrutiny sheet), put it back so the dialog underneath can
         still scroll. */
      if (document.querySelector('.modal.show')) document.body.classList.add('modal-open');
    });
    inst.show();
    var api = {
      el: wrap,
      close: function () { inst.hide(); },
      find: function (sel) { return wrap.querySelector(sel); }
    };
    if (opts.onShow) opts.onShow(api);
    return api;
  }

  function confirm(opts) {
    return new Promise(function (resolve) {
      var settled = false;
      modal({
        title: opts.title || 'Please confirm',
        body: '<div class="fs-13 text-secondary lh-base">' + (opts.body || '') + '</div>',
        footer:
          '<button class="btn btn-sm btn-outline-secondary px-3" data-act="no">' + (opts.cancelText || 'Cancel') + '</button>' +
          '<button class="btn btn-sm ' + (opts.danger ? 'btn-danger' : 'btn-green-solid') + ' px-4" data-act="yes">' +
          (opts.okText || 'Confirm') + '</button>',
        onShow: function (api) {
          api.el.querySelector('[data-act="yes"]').addEventListener('click', function () {
            settled = true; resolve(true); api.close();
          });
          api.el.querySelector('[data-act="no"]').addEventListener('click', function () { api.close(); });
          api.el.addEventListener('hidden.bs.modal', function () { if (!settled) resolve(false); });
        }
      });
    });
  }

  /* ---------- drawer ---------- */

  function drawer(opts) {
    closeDrawer();
    var host = document.getElementById('drawer-host');
    host.innerHTML =
      '<div class="drawer-backdrop" data-close></div>' +
      '<aside class="drawer">' +
      '<div class="drawer-head border-bottom">' +
      '<h3 class="flex-grow-1 fw-bold text-dark mb-0">' + (opts.title || '') + '</h3>' +
      '<button class="btn btn-sm btn-light rounded-circle" data-close><i class="bi bi-x-lg"></i></button>' +
      '</div>' +
      '<div class="drawer-body">' + (opts.body || '') + '</div>' +
      (opts.footer ? '<div class="drawer-foot border-top bg-light">' + opts.footer + '</div>' : '') +
      '</aside>';
    host.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', closeDrawer);
    });
    /* Hand back the panel, not the persistent host: delegated listeners must
       die with the drawer rather than accumulating on #drawer-host. */
    var panel = host.querySelector('.drawer');
    if (opts.onShow) opts.onShow(panel);
    return panel;
  }

  function closeDrawer() {
    var host = document.getElementById('drawer-host');
    if (host) host.innerHTML = '';
  }

  /* ---------- small html builders ---------- */

  function pill(text, tone, icon) {
    return '<span class="pill ' + (tone || 'grey') + '">' +
      (icon ? '<i class="bi ' + icon + '"></i>' : '') + fmt.esc(text) + '</span>';
  }

  var STATUS_TONE = {
    APPLIED: ['blue', 'Applied'], ACTIVE: ['blue', 'Active'], CLOSED: ['grey', 'Closed'],
    PENDING: ['amber', 'Pending'], APPROVED: ['green', 'Approved'], REJECTED: ['red', 'Rejected'],
    DRAFT: ['grey', 'Not sent'],
    PASSED: ['green', 'Passed'], FAILED: ['red', 'Failed'],
    PRESENT: ['green', 'Present'], ABSENT: ['red', 'Absent'],
    ACCEPTED: ['green', 'Accepted'], CONDITIONAL: ['amber', 'Conditional'],
    NOT_STARTED: ['grey', 'Not started'], IN_PROGRESS: ['blue', 'In progress'], COMPLETED: ['green', 'Completed'],
    SELECTED: ['green', 'Selected'], JOINED: ['purple', 'Joined'], OFFERED: ['blue', 'Offer issued']
  };

  function statusPill(status, fallbackTone) {
    var m = STATUS_TONE[status];
    if (!m) return pill(status || '—', fallbackTone || 'grey');
    return pill(m[1], m[0]);
  }

  function avatar(name, cls) {
    return '<span class="avatar ' + (cls || '') + '">' + fmt.esc(fmt.initials(name)) + '</span>';
  }

  function empty(text, sub, icon) {
    return '<div class="empty py-5"><i class="bi ' + (icon || 'bi-inbox') + ' text-success opacity-50 mb-3" style="font-size:2.5rem"></i>' +
      '<div class="fw-bold text-dark fs-6">' + fmt.esc(text) + '</div>' +
      (sub ? '<div class="fs-12 text-muted mt-1">' + fmt.esc(sub) + '</div>' : '') + '</div>';
  }

  function alert(tone, html, icon) {
    var ic = { info: 'bi-info-circle', warn: 'bi-exclamation-triangle', ok: 'bi-check-circle', err: 'bi-x-octagon' };
    return '<div class="alert-x ' + tone + '"><i class="bi ' + (icon || ic[tone]) + ' me-1"></i><div>' + html + '</div></div>';
  }

  function card(opts) {
    return '<div class="card' + (opts.cls ? ' ' + opts.cls : '') + '"' + (opts.id ? ' id="' + opts.id + '"' : '') + '>' +
      (opts.title ?
        '<div class="card-header"><div><h2>' + opts.title + '</h2>' +
        (opts.hint ? '<p class="hint">' + opts.hint + '</p>' : '') + '</div>' +
        '<div class="spacer"></div>' + (opts.actions || '') + '</div>' : '') +
      '<div class="card-body' + (opts.tight ? ' tight' : '') + '">' + (opts.body || '') + '</div>' +
      (opts.foot ? '<div class="card-footer">' + opts.foot + '</div>' : '') +
      '</div>';
  }

  function pageHead(opts) {
    return '<div class="page-head"><div>' +
      '<h1>' + opts.title + '</h1>' +
      (opts.sub ? '<p class="sub">' + opts.sub + '</p>' : '') +
      '</div><div class="spacer"></div>' + (opts.actions || '') + '</div>';
  }

  function progressBar(pct) {
    return '<div class="progress-thin"><span style="width:' + Math.max(0, Math.min(100, pct)) + '%"></span></div>';
  }

  /* ---------- stage step header ----------
     Pubali Bank PLC Multi-Stage Pipeline Progress Tracker */

  function stepHeader(stg, activeKey) {
    var steps = ERec.pipeline.steps(stg);
    var p = ERec.pipeline.progress(stg);
    var cur = steps.find(function (s) { return s.key === activeKey; }) || steps[0];
    var c = ERec.store.circular(stg.circularId);

    var chips = steps.map(function (s, i) {
      var cls = 'step';
      if (s.key === activeKey) cls += ' is-current';
      else if (s.skipped) cls += ' is-skipped';
      else if (s.done) cls += ' is-done';
      else if (!s.enabled) cls += ' is-locked';
      if (s.pending) cls += ' has-pending';

      var dot = s.done && !s.skipped ? '<i class="bi bi-check-lg text-white"></i>'
        : s.skipped ? '<i class="bi bi-dash-lg"></i>'
          : (!s.enabled ? '<i class="bi bi-lock-fill"></i>' : String(s.number));

      var sub = s.pending ? s.pending + ' waiting'
        : (s.hint || (s.optional ? 'Optional' : (!s.enabled ? 'Locked' : '')));

      return '<div class="' + cls + '">' +
        (i > 0 ? '<span class="step-line"></span>' : '') +
        '<button class="step-btn" data-step="' + s.key + '"' +
        (s.enabled ? '' : ' disabled title="' + fmt.esc(s.blockedReason) + '"') + '>' +
        '<span class="step-dot">' + dot +
        (s.pending ? '<span class="step-badge">' + s.pending + '</span>' : '') + '</span>' +
        '<span class="step-label"><span class="t">' + fmt.esc(s.label) + '</span>' +
        (sub ? '<span class="s">' + fmt.esc(sub) + '</span>' : '') + '</span>' +
        '</button></div>';
    }).join('');

    return '<div class="stage-head">' +
      '<div class="stage-head-top">' +
      '<a class="stage-back shadow-sm" href="#/circular/' + c.id + '"><i class="bi bi-chevron-left text-success"></i> ' +
      fmt.esc(c.post) + '</a>' +
      '<span class="stage-tag"><i class="bi bi-layers-fill me-1"></i>' + fmt.esc(ERec.pipeline.stageName(stg)) + '</span>' +
      '<div class="spacer"></div>' +
      '<span class="stage-count fw-semibold text-secondary"><i class="bi bi-clock-history me-1 text-success"></i>Step ' + cur.number + ' of ' + cur.total +
      ' &middot; ' + p.done + ' of ' + p.total + ' required completed</span>' +
      '</div>' +
      '<div class="stepper-wrap"><div class="stepper">' + chips + '</div></div>' +
      '<h1 class="stage-title">' + fmt.esc(cur.label) +
      (cur.done && !cur.skipped ? ' <span class="pill green"><i class="bi bi-check2-circle"></i> Completed</span>' : '') +
      (cur.skipped ? ' <span class="pill outline">Skipped</span>' : '') +
      (cur.optional && !cur.done ? ' <span class="pill outline">Optional</span>' : '') +
      (cur.pending ? ' <span class="pill amber"><i class="bi bi-people"></i>' +
        cur.pending + ' candidates waiting</span>' : '') +
      '</h1>' +
      '<p class="stage-help">' + fmt.esc(cur.help || '') + '</p>' +
      '</div>';
  }

  /* ---------- one obvious button, always in the same place ---------- */

  function actionBar(stg, key, opts) {
    opts = opts || {};
    var steps = ERec.pipeline.steps(stg);
    var i = steps.findIndex(function (s) { return s.key === key; });
    var prev = i > 0 ? steps[i - 1] : null;
    var next = i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;

    var html = '<div class="action-bar"><div class="ab-inner">';
    if (prev) {
      html += '<button class="btn btn-outline-secondary btn-back btn-sm d-inline-flex align-items-center gap-1" data-nav="' + prev.key + '">' +
        '<i class="bi bi-chevron-left"></i> <span class="d-none d-sm-inline">' + fmt.esc(prev.label) + '</span></button>';
    }
    html += '<div class="spacer"></div>';
    if (opts.note) html += '<span class="ab-note text-secondary fw-medium"><i class="bi bi-info-circle text-success me-1"></i>' + opts.note + '</span>';

    (opts.secondary || []).forEach(function (b) {
      html += '<button class="btn btn-sm btn-' + (b.tone || 'outline-secondary') + '" id="' + b.id + '"' +
        (b.disabled ? ' disabled' : '') + '>' +
        (b.icon ? '<i class="bi ' + b.icon + ' me-1"></i>' : '') + fmt.esc(b.label) + '</button>';
    });

    if (opts.primary) {
      html += '<button class="btn btn-green-solid btn-go' + (opts.primary.tone === 'success' ? ' btn-go-ok' : '') + '"' +
        (opts.primary.nav ? ' data-nav="' + opts.primary.nav + '"' : ' id="' + opts.primary.id + '"') +
        (opts.primary.disabled ? ' disabled' : '') + '>' +
        (opts.primary.icon ? '<i class="bi ' + opts.primary.icon + ' me-1"></i>' : '') +
        fmt.esc(opts.primary.label) + '</button>';
    } else if (next) {
      html += '<button class="btn btn-green-solid btn-go" data-nav="' + next.key + '"' +
        (next.enabled ? '' : ' disabled title="' + fmt.esc(next.blockedReason) + '"') + '>' +
        'Continue: ' + fmt.esc(next.label) + ' <i class="bi bi-chevron-right ms-1"></i></button>';
    }
    return html + '</div></div>';
  }

  /* ---------- stage page shell ---------- */

  function stagePage(view, stg, stepKey, opts) {
    var c = ERec.store.circular(stg.circularId);
    var step = ERec.pipeline.step(stg, stepKey);
    ERec.router.setCrumbs([
      { label: 'Job Circulars', href: '#/circulars' },
      { label: c.post, href: '#/circular/' + c.id },
      { label: step ? step.label : '' }
    ]);

    view.innerHTML =
      stepHeader(stg, stepKey) +
      (opts.body || '') +
      actionBar(stg, stepKey, opts.action || {});

    view.querySelectorAll('[data-step]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ERec.router.go('#/circular/' + stg.circularId + '/stage/' + stg.id + '/' + btn.dataset.step);
      });
    });
    view.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ERec.router.go('#/circular/' + stg.circularId + '/stage/' + stg.id + '/' + btn.dataset.nav);
      });
    });
    return view;
  }

  /* Guard used by every step screen: a locked step must not be operable. */
  function lockedNotice(stg, stepKey) {
    var step = ERec.pipeline.step(stg, stepKey);
    if (!step || step.enabled) return '';
    return alert('warn', '<strong>Prerequisite required:</strong> ' + fmt.esc(step.blockedReason) + '.');
  }

  /* ---------- event delegation ---------- */

  function on(root, selector, evt, handler) {
    root.addEventListener(evt, function (e) {
      var t = e.target.closest(selector);
      if (t && root.contains(t)) handler(e, t);
    });
  }

  ERec.ui = {
    toast: toast, modal: modal, confirm: confirm,
    stagePage: stagePage, lockedNotice: lockedNotice,
    stepHeader: stepHeader, actionBar: actionBar,
    drawer: drawer, closeDrawer: closeDrawer,
    pill: pill, statusPill: statusPill, avatar: avatar, empty: empty, alert: alert,
    card: card, pageHead: pageHead, progressBar: progressBar,
    on: on
  };
})(window);
