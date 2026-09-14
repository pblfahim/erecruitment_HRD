/* Router: Supports both dedicated HTML page layouts and hash routing.
   Pages register on ERec.pages and expose render(viewEl, params). */
(function (global) {
  'use strict';

  var ERec = global.ERec = global.ERec || {};
  ERec.pages = ERec.pages || {};

  var ROUTES = [
    { pattern: '#/', name: 'dashboard', page: 'dashboard' },
    { pattern: '#/circulars', name: 'circulars', page: 'circulars' },
    { pattern: '#/approvals', name: 'approvals', page: 'approvalsInbox' },
    { pattern: '#/outbox', name: 'outbox', page: 'outbox' },
    { pattern: '#/activity', name: 'activity', page: 'outbox', props: { tab: 'activity' } },
    { pattern: '#/circular/:cid', name: 'circular', page: 'circular' },
    { pattern: '#/circular/:cid/stage/:sid', name: 'stage', page: '__stageRedirect' },
    { pattern: '#/circular/:cid/stage/:sid/:step', name: 'stage', page: '__stage' },
    { pattern: '#/print/:doc/:id', name: 'print', page: 'print' }
  ];

  /* step key -> page module + render method */
  var STEP_PAGES = {
    'search': ['applicants', 'render'],
    'approval-applicant': ['approval', 'render'],
    'roll': ['rollnumber', 'render'],
    'venue': ['venue', 'render'],
    'approval-venue': ['approval', 'render'],
    'instructions': ['instructions', 'render'],
    'initiate': ['initiate', 'render'],
    'scrutiny': ['scrutiny', 'render'],
    'marks': ['marks', 'render'],
    'forward': ['marks', 'renderForward'],
    'result': ['result', 'render'],
    'offer': ['offer', 'render'],
    'joining': ['joining', 'render']
  };

  /* Step key -> individual HTML file */
  var STEP_HTML_PAGE = {
    'search': 'applicants.html',
    'approval-applicant': 'approval.html?kind=APPLICANT',
    'roll': 'rollnumber.html',
    'venue': 'venue.html',
    'approval-venue': 'approval.html?kind=VENUE',
    'instructions': 'instructions.html',
    'initiate': 'initiate.html',
    'scrutiny': 'scrutiny.html',
    'marks': 'marks.html',
    'forward': 'marks.html?step=forward',
    'result': 'result.html',
    'offer': 'offer.html',
    'joining': 'joining.html'
  };

  var current = { name: '', params: {}, hash: '' };
  var crumbs = [];

  function parseQueryParams() {
    var s = global.location.search || '';
    if (s.indexOf('?') === 0) s = s.slice(1);
    var q = {};
    if (s) {
      s.split('&').forEach(function (kv) {
        var p = kv.split('=');
        q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
    }
    return q;
  }

  function currentPageFile() {
    var p = global.location.pathname.split('/').pop() || 'index.html';
    return p.replace(/\.html$/, '').toLowerCase();
  }

  function parse(hash) {
    hash = hash || '';
    var qi = hash.indexOf('?');
    var query = {};
    if (qi >= 0) {
      hash.slice(qi + 1).split('&').forEach(function (kv) {
        var p = kv.split('=');
        query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
      hash = hash.slice(0, qi);
    }
    if (hash.length > 2 && hash.slice(-1) === '/') hash = hash.slice(0, -1);

    if (hash && hash !== '#/') {
      var parts = hash.split('/').filter(function (s) { return s !== ''; });
      for (var i = 0; i < ROUTES.length; i++) {
        var rp = ROUTES[i].pattern.split('/').filter(function (s) { return s !== ''; });
        if (rp.length !== parts.length) continue;
        var params = {}, ok = true;
        for (var j = 0; j < rp.length; j++) {
          if (rp[j][0] === ':') params[rp[j].slice(1)] = decodeURIComponent(parts[j]);
          else if (rp[j] !== parts[j]) { ok = false; break; }
        }
        if (ok) return { route: ROUTES[i], params: params, query: query, hash: hash };
      }
    }

    // Direct HTML page resolution
    var file = currentPageFile();
    var qParams = parseQueryParams();
    Object.assign(query, qParams);

    var firstCirc = ERec.store ? ERec.store.all('circulars')[0] : null;
    var defaultCid = firstCirc ? firstCirc.id : 'C-01';
    var defaultStages = (ERec.store && firstCirc) ? ERec.store.stagesOf(defaultCid) : [];
    var defaultSid = defaultStages.length ? defaultStages[0].id : defaultCid + '-S1';

    var cid = query.cid || query.id || defaultCid;
    var sid = query.sid || defaultSid;

    switch (file) {
      case 'index':
      case 'dashboard':
        return { route: { name: 'dashboard', page: 'dashboard' }, params: {}, query: query, hash: '#/' };
      case 'circulars':
        return { route: { name: 'circulars', page: 'circulars' }, params: {}, query: query, hash: '#/circulars' };
      case 'circular':
        return { route: { name: 'circular', page: 'circular' }, params: { cid: cid, id: cid }, query: query, hash: '#/circular/' + cid };
      case 'applicants':
        return { route: { name: 'stage', page: '__stage' }, params: { cid: cid, sid: sid, step: 'search' }, query: query, hash: '#/circular/' + cid + '/stage/' + sid + '/search' };
      case 'approval':
        var appStep = query.kind === 'VENUE' ? 'approval-venue' : 'approval-applicant';
        return { route: { name: 'stage', page: '__stage' }, params: { cid: cid, sid: sid, step: appStep, kind: query.kind || 'APPLICANT' }, query: query, hash: '#/circular/' + cid + '/stage/' + sid + '/' + appStep };
      case 'rollnumber':
        return { route: { name: 'stage', page: '__stage' }, params: { cid: cid, sid: sid, step: 'roll' }, query: query, hash: '#/circular/' + cid + '/stage/' + sid + '/roll' };
      case 'venue':
        return { route: { name: 'stage', page: '__stage' }, params: { cid: cid, sid: sid, step: 'venue' }, query: query, hash: '#/circular/' + cid + '/stage/' + sid + '/venue' };
      case 'instructions':
        return { route: { name: 'stage', page: '__stage' }, params: { cid: cid, sid: sid, step: 'instructions' }, query: query, hash: '#/circular/' + cid + '/stage/' + sid + '/instructions' };
      case 'initiate':
        return { route: { name: 'stage', page: '__stage' }, params: { cid: cid, sid: sid, step: 'initiate' }, query: query, hash: '#/circular/' + cid + '/stage/' + sid + '/initiate' };
      case 'scrutiny':
        return { route: { name: 'stage', page: '__stage' }, params: { cid: cid, sid: sid, step: 'scrutiny' }, query: query, hash: '#/circular/' + cid + '/stage/' + sid + '/scrutiny' };
      case 'marks':
        var marksStep = query.step === 'forward' ? 'forward' : 'marks';
        return { route: { name: 'stage', page: '__stage' }, params: { cid: cid, sid: sid, step: marksStep }, query: query, hash: '#/circular/' + cid + '/stage/' + sid + '/' + marksStep };
      case 'result':
        return { route: { name: 'stage', page: '__stage' }, params: { cid: cid, sid: sid, step: 'result' }, query: query, hash: '#/circular/' + cid + '/stage/' + sid + '/result' };
      case 'offer':
        return { route: { name: 'stage', page: '__stage' }, params: { cid: cid, sid: sid, step: 'offer' }, query: query, hash: '#/circular/' + cid + '/stage/' + sid + '/offer' };
      case 'joining':
        return { route: { name: 'stage', page: '__stage' }, params: { cid: cid, sid: sid, step: 'joining' }, query: query, hash: '#/circular/' + cid + '/stage/' + sid + '/joining' };
      case 'approvals':
        return { route: { name: 'approvals', page: 'approvalsInbox' }, params: {}, query: query, hash: '#/approvals' };
      case 'outbox':
        return { route: { name: 'outbox', page: 'outbox', props: { tab: query.tab || 'outbox' } }, params: {}, query: query, hash: '#/outbox' };
      case 'print':
        return { route: { name: 'print', page: 'print' }, params: { doc: query.doc || 'admit', id: query.id || '' }, query: query, hash: '#/print/' + (query.doc || 'admit') + '/' + (query.id || '') };
      default:
        return { route: { name: 'dashboard', page: 'dashboard' }, params: {}, query: query, hash: '#/' };
    }
  }

  function setCrumbs(list) {
    crumbs = list || [];
    var el = document.getElementById('crumbs');
    if (!el) return;
    el.innerHTML = crumbs.map(function (c, i) {
      var last = i === crumbs.length - 1;
      var href = c.href || 'index.html';
      if (href === '#/') href = 'index.html';
      else if (href === '#/circulars') href = 'circulars.html';
      else if (href === '#/approvals') href = 'approvals.html';
      else if (href === '#/outbox') href = 'outbox.html';
      else if (href.indexOf('#/circular/') === 0) {
        var parts = href.split('/');
        href = 'circular.html?cid=' + encodeURIComponent(parts[2]);
      }
      var body = last
        ? '<span class="cur">' + ERec.fmt.esc(c.label) + '</span>'
        : '<a href="' + href + '">' + ERec.fmt.esc(c.label) + '</a>';
      return (i ? '<span class="sep">/</span>' : '') + body;
    }).join('');
  }

  function render() {
    var m = parse(global.location.hash);
    var view = document.getElementById('view');
    if (!view) return;

    if (!m) {
      view.innerHTML = ERec.ui.pageHead({ title: 'Page not found' }) +
        ERec.ui.card({ body: ERec.ui.empty('That screen does not exist', 'Use the sidebar to get back on track.', 'bi-signpost-split') });
      setCrumbs([{ label: 'Not found' }]);
      return;
    }

    current = { name: m.route.name, params: m.params, query: m.query, hash: m.hash };

    /* /circular/:cid/stage/:sid -> jump to the step the user should be on */
    if (m.route.page === '__stageRedirect') {
      var stg = ERec.store.stage(m.params.sid);
      if (!stg) { go('circulars.html'); return; }
      var cur = ERec.pipeline.currentStep(stg);
      var nextKey = cur ? cur.key : 'search';
      go(ERec.pipeline.stepPageUrl(stg, nextKey));
      return;
    }

    var pageName = m.route.page;
    var method = 'render';

    if (pageName === '__stage') {
      var mapping = STEP_PAGES[m.params.step];
      if (!mapping) { go('circular.html?cid=' + m.params.cid); return; }
      pageName = mapping[0];
      method = mapping[1];
    }

    var page = ERec.pages[pageName];
    if (!page || !page[method]) {
      view.innerHTML = ERec.ui.card({ body: ERec.ui.empty('Screen not available', pageName + '.' + method + ' is missing') });
      return;
    }

    if (ERec.ui && ERec.ui.closeDrawer) ERec.ui.closeDrawer();
    view.scrollTop = 0;
    global.scrollTo(0, 0);
    setCrumbs([]);
    try {
      page[method](view, Object.assign({}, m.params, { query: m.query, props: m.route.props || {} }));
    } catch (err) {
      view.innerHTML = ERec.ui.pageHead({ title: 'Something went wrong' }) +
        ERec.ui.card({
          body: ERec.ui.alert('err', '<strong>' + ERec.fmt.esc(err.message) + '</strong>' +
            '<pre class="fs-12 mb-0 mt-2" style="white-space:pre-wrap">' + ERec.fmt.esc(err.stack || '') + '</pre>')
        });
      if (global.console) console.error(err);
    }
    if (ERec.app && ERec.app.syncNav) ERec.app.syncNav(current);
  }

  function urlForHash(target) {
    if (!target) return 'index.html';
    if (target === '#/' || target === '#') return 'index.html';
    if (target === '#/circulars') return 'circulars.html';
    if (target === '#/approvals') return 'approvals.html';
    if (target === '#/outbox') return 'outbox.html';
    if (target === '#/activity') return 'outbox.html?tab=activity';
    if (target.indexOf('#/circular/') === 0) {
      var parts = target.split('/');
      var cid = parts[2];
      if (parts.length === 3) return 'circular.html?cid=' + encodeURIComponent(cid);
      if (parts.length >= 6 && parts[3] === 'stage') {
        var sid = parts[4];
        var step = parts[5];
        var pg = STEP_HTML_PAGE[step] || (step + '.html');
        var sep = pg.indexOf('?') >= 0 ? '&' : '?';
        return pg + sep + 'cid=' + encodeURIComponent(cid) + '&sid=' + encodeURIComponent(sid);
      }
    }
    if (target.indexOf('#/print/') === 0) {
      var pParts = target.split('/');
      return 'print.html?doc=' + encodeURIComponent(pParts[2] || 'admit') + '&id=' + encodeURIComponent(pParts[3] || '');
    }
    return target;
  }

  function go(target) {
    if (!target) return;
    if (target.indexOf('#') === 0) {
      var mappedUrl = urlForHash(target);
      var curFile = currentPageFile() + '.html';
      var targetFile = mappedUrl.split('?')[0];
      if (targetFile && targetFile !== curFile && targetFile !== 'index.html' && targetFile !== 'dashboard.html') {
        global.location.href = mappedUrl;
        return;
      }
      if (global.location.hash === target) render();
      else global.location.hash = target;
    } else {
      global.location.href = target;
    }
  }

  function refresh() { render(); }

  function start() {
    global.addEventListener('hashchange', render);
    render();
  }

  ERec.router = {
    start: start, go: go, refresh: refresh, render: render,
    setCrumbs: setCrumbs,
    urlForHash: urlForHash,
    current: function () { return current; }
  };
})(window);
