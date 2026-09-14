/* Boot: sidebar, topbar role switcher, reset, router start.
   Pubali Bank PLC &middot; HRD Admin Portal Theme Integration */
(function (global) {
  'use strict';

  var ERec = global.ERec = global.ERec || {};
  var store = ERec.store, ui = ERec.ui, fmt = ERec.fmt;

  function currentHtmlPage() {
    var p = global.location.pathname.split('/').pop() || 'index.html';
    var name = p.replace(/\.html$/, '').toLowerCase();
    if (!name || name === 'dashboard') return 'index';
    return name;
  }

  function navItems() {
    var me = store.actingUser();
    var pending = store.pendingApprovalsFor(me.id).length;
    var items = [
      { name: 'dashboard', page: 'index', href: 'index.html', icon: 'bi-grid-1x2', label: 'Dashboard' },
      { name: 'circulars', page: 'circulars', href: 'circulars.html', icon: 'bi-briefcase', label: 'Job Circulars' },
      { name: 'approvals', page: 'approvals', href: 'approvals.html', icon: 'bi-check2-circle', label: 'Approval Inbox', badge: pending || 0 },
      { name: 'outbox', page: 'outbox', href: 'outbox.html', icon: 'bi-envelope-paper', label: 'Mail / SMS Outbox' }
    ];
    return items;
  }

  function renderProfileCard() {
    var me = store.actingUser();
    var nameEls = document.querySelectorAll('#sidebar-user-name');
    var roleEls = document.querySelectorAll('#sidebar-user-role');
    var avatarEls = document.querySelectorAll('#sidebar-user-avatar');

    nameEls.forEach(function (el) { el.textContent = me.name; });
    roleEls.forEach(function (el) {
      el.textContent = me.role === 'HR_ADMIN'
        ? 'HR Admin \u00B7 Senior Officer'
        : 'Approver \u00B7 ' + me.designation.split(',')[0];
    });
    avatarEls.forEach(function (el) {
      el.src = me.role === 'HR_ADMIN' ? 'assets/images/fahim.png' : 'assets/images/fahimsm.png';
    });
  }

  function renderNav() {
    var el = document.getElementById('sidebar-nav');
    var cur = ERec.router.current();
    var page = currentHtmlPage();

    if (el) {
      var html = '<div class="d-flex flex-column">';
      html += navItems().map(function (it) {
        var isActive = (cur.name === it.name) || (page === it.page);
        return '<a class="nav-link-custom nav-link-x' + (isActive ? ' active' : '') + '" href="' + it.href + '" data-nav="' + it.name + '">' +
          '<i class="bi ' + it.icon + '"></i><span>' + it.label + '</span>' +
          (it.badge ? '<span class="badge bg-danger rounded-pill ms-auto">' + it.badge + '</span>' : '') +
          '</a>';
      }).join('');
      html += '</div>';

      html += '<div class="nav-section mt-2">Active Circulars</div>';
      html += '<div class="d-flex flex-column">';
      store.where('circulars', function (c) { return c.status === 'ACTIVE'; }).forEach(function (c) {
        var active = cur.params && (cur.params.cid === c.id || cur.params.id === c.id);
        html += '<a class="nav-link-custom nav-link-x' + (active ? ' active' : '') + '" href="circular.html?cid=' + c.id + '" title="' + fmt.esc(c.title) + '">' +
          '<i class="bi bi-file-earmark-text"></i>' +
          '<span class="text-truncate">' + fmt.esc(c.post) + '</span>' +
          '</a>';
      });
      html += '</div>';

      el.innerHTML = html;
    }

    // Sync mobile drawer navigation as well
    var mobNav = document.getElementById('mobile-sidebar-nav');
    if (mobNav) {
      var mobHtml = '<div class="d-flex flex-column">';
      mobHtml += navItems().map(function (it) {
        var isActive = (cur.name === it.name) || (page === it.page);
        return '<a class="nav-link-custom' + (isActive ? ' active' : '') + '" href="' + it.href + '">' +
          '<i class="bi ' + it.icon + '"></i> ' + it.label +
          '</a>';
      }).join('');
      mobHtml += '</div>';
      mobNav.innerHTML = mobHtml;
    }
  }

  function renderTopbar() {
    var el = document.getElementById('topbar-right');
    if (!el) return;
    var me = store.actingUser();
    var users = store.all('users');
    var pendingList = store.pendingApprovalsFor(me.id);
    var pendingCount = pendingList.length;

    var html = '';

    // Approvals quick button if approver
    if (me.role === 'APPROVER') {
      html += '<a href="approvals.html" class="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 shadow-sm">' +
        '<i class="bi bi-check2-square"></i> <span class="d-none d-sm-inline">Approval Inbox</span>' +
        (pendingCount ? ' <span class="badge bg-danger rounded-pill">' + pendingCount + '</span>' : '') +
        '</a>';
    }

    // Notification Bell Dropdown
    html +=
      '<div class="dropdown">' +
      '<button class="position-relative nav-icon-btn cursor-pointer" type="button" id="adminNotificationBtn" data-bs-toggle="dropdown" aria-expanded="false">' +
      '<i class="bi bi-bell fs-5"></i>' +
      (pendingCount > 0
        ? '<span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle" id="unreadBadgeDot"></span>'
        : '') +
      '</button>' +
      '<div class="dropdown-menu dropdown-menu-end notification-menu-dropdown p-0 mt-2" aria-labelledby="adminNotificationBtn">' +
      '<div class="p-3 bg-light border-bottom d-flex align-items-center justify-content-between">' +
      '<h6 class="fw-bold mb-0 text-dark" style="font-size:0.9rem;">' +
      '<i class="bi bi-bell-fill text-success me-1"></i> Notifications' +
      (pendingCount ? ' <span class="badge bg-danger rounded-pill ms-1">' + pendingCount + '</span>' : '') +
      '</h6>' +
      '<button class="btn btn-link btn-sm text-decoration-none p-0 text-success fw-semibold" style="font-size: 0.75rem;" id="btn-mark-notifications-read">' +
      'Dismiss' +
      '</button>' +
      '</div>' +
      '<div class="notification-list" style="max-height: 300px; overflow-y: auto;">';

    if (pendingCount === 0) {
      html +=
        '<div class="p-4 text-center text-muted small">' +
        '<i class="bi bi-check2-circle text-success fs-3 d-block mb-1"></i>' +
        'All clear &middot; No pending tasks' +
        '</div>';
    } else {
      pendingList.forEach(function (ap) {
        var circ = store.find('circulars', ap.circularId);
        html +=
          '<div class="notification-item unread d-flex align-items-start gap-2" onclick="location.href=\'approvals.html\'">' +
          '<div class="bg-warning-subtle text-warning p-2 rounded-circle flex-shrink-0" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">' +
          '<i class="bi bi-shield-exclamation"></i>' +
          '</div>' +
          '<div>' +
          '<h6 class="fw-semibold mb-0 text-dark" style="font-size:0.82rem;">Approval Required: ' + fmt.esc(ap.kind) + '</h6>' +
          '<p class="text-muted mb-0 small" style="font-size:0.75rem;">' + fmt.esc(circ ? circ.post : 'Circular') + '</p>' +
          '<small class="text-secondary" style="font-size:0.68rem;">Action needed</small>' +
          '</div>' +
          '</div>';
      });
    }

    html +=
      '</div>' +
      '<div class="p-2 text-center bg-light border-top">' +
      '<a href="outbox.html" class="small text-decoration-none text-success fw-semibold">View Sent Outbox &rarr;</a>' +
      '</div>' +
      '</div>' +
      '</div>';

    // Divider
    html += '<div class="vr my-2 text-secondary opacity-25 d-none d-sm-block" style="height: 24px"></div>';

    // Role-Switcher / Acting Chip Dropdown
    html +=
      '<div class="dropdown">' +
      '<div class="acting-chip" data-bs-toggle="dropdown" role="button">' +
      ui.avatar(me.name, me.role === 'HR_ADMIN' ? 'primary' : '') +
      '<span class="d-none d-md-flex flex-column lh-sm text-start">' +
      '<span class="fw-semibold text-dark" style="font-size:12.5px">' + fmt.esc(me.name) + '</span>' +
      '<span class="text-success fw-semibold" style="font-size:10.5px">' + fmt.esc(me.role === 'HR_ADMIN' ? 'HR Administrator' : 'Approver') + '</span>' +
      '</span>' +
      '<i class="bi bi-chevron-down text-secondary ms-1" style="font-size:11px"></i>' +
      '</div>' +
      '<ul class="dropdown-menu dropdown-menu-end shadow-sm" style="min-width:280px">' +
      '<li><h6 class="dropdown-header text-uppercase text-secondary" style="font-size:0.7rem;letter-spacing:0.05em">Switch Acting Personnel</h6></li>' +
      users.map(function (u) {
        var np = store.pendingApprovalsFor(u.id).length;
        var isCur = u.id === me.id;
        return '<li><a class="dropdown-item d-flex align-items-center gap-2 py-2 ' + (isCur ? 'active bg-success text-white' : '') + '" href="#" data-user="' + u.id + '">' +
          ui.avatar(u.name, 'sm ' + (isCur ? 'bg-white text-success' : '')) +
          '<span class="flex-grow-1"><span class="d-block fw-semibold" style="font-size:12.5px">' + fmt.esc(u.name) + '</span>' +
          '<span class="d-block ' + (isCur ? 'text-white-50' : 'text-muted') + '" style="font-size:11px">' + fmt.esc(u.designation) + '</span></span>' +
          (np ? '<span class="badge rounded-pill ' + (isCur ? 'bg-white text-danger' : 'bg-danger text-white') + '">' + np + '</span>' : '') +
          '</a></li>';
      }).join('') +
      '<li><hr class="dropdown-divider"></li>' +
      '<li><span class="dropdown-item-text fs-12 text-muted">Switch role to approve requests that were routed for sign-off.</span></li>' +
      '</ul>' +
      '</div>';

    el.innerHTML = html;

    // Attach role switch listeners
    el.querySelectorAll('[data-user]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        store.setActingUser(a.dataset.user);
        var u = store.find('users', a.dataset.user);
        ui.toast('Acting as ' + u.name + ' (' + u.designation + ')', 'info');
        syncNav();
        ERec.router.refresh();
      });
    });

    var dismissBtn = el.querySelector('#btn-mark-notifications-read');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var dot = document.getElementById('unreadBadgeDot');
        if (dot) dot.remove();
        ui.toast('All notifications marked as read', 'success');
      });
    }
  }

  function renderAll() {
    renderProfileCard();
    renderNav();
    renderTopbar();
    ERec.router.refresh();
  }

  function syncNav() {
    renderProfileCard();
    renderNav();
    renderTopbar();
  }

  function storageNote() {
    var el = document.getElementById('storage-note');
    if (!el) return;
    el.innerHTML = store.storageAvailable()
      ? '<span class="text-success"><i class="bi bi-hdd me-1"></i> Data synced in local session</span>'
      : '<span class="text-warning"><i class="bi bi-exclamation-triangle me-1"></i> Session storage in-memory only</span>';
  }

  function boot() {
    store.load();

    var resetBtn = document.getElementById('btn-reset-demo');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        ui.confirm({
          title: 'Reset Demo Data',
          body: 'This restores the three seeded circulars (Officer Cash, MTO, Legal Consultant) and discards current pipeline changes in this demo.',
          okText: 'Reset Demo Data',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          store.reset();
          ui.toast('Demo state restored to initial seeded baseline');
          global.location.href = 'index.html';
        });
      });
    }

    var toggleBtn = document.getElementById('btn-sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        document.body.classList.toggle('sidebar-open');
      });
    }

    var backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        document.body.classList.remove('sidebar-open');
      });
    }

    global.addEventListener('hashchange', function () {
      document.body.classList.remove('sidebar-open');
    });

    ERec.router.start();
    renderProfileCard();
    renderNav();
    renderTopbar();
    storageNote();
  }

  ERec.app = {
    syncNav: syncNav,
    renderAll: renderAll,
    renderNav: renderNav,
    renderTopbar: renderTopbar,
    renderProfileCard: renderProfileCard
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
