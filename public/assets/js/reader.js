/* Reader page: opens one edition (city + date) and shows it page by page with PDF.js. */
(function () {
  'use strict';

  var JN = window.JN;
  var CFG = JN.CFG;
  var t = JN.t;
  var el = JN.el;
  var $ = JN.$;

  var ZOOMS = [1, 1.5, 2, 3];
  var S = {
    manifest: null, city: null, iso: null, entry: null, url: '',
    pdf: null, pages: 0, page: 1, zi: 0, ratio: 0.72,
    token: 0, task: null, edTok: 0, thumbQueue: Promise.resolve(),
    resetScroll: false, msgFn: null
  };

  function isDesktop() { return window.matchMedia('(min-width: 901px)').matches; }

  /* ---------- read the address ---------- */
  function resolveFromUrl() {
    var q = new URLSearchParams(window.location.search);
    S.city = JN.cityById(q.get('c')) || CFG.cities[0];
    var list = JN.editionsFor(S.manifest, S.city);
    var d = q.get('d');
    S.iso = JN.isISO(d) ? d : (list[0] ? list[0].d : null);
    S.entry = S.iso ? JN.findEdition(S.manifest, S.city, S.iso) : null;
    var p = parseInt(q.get('p'), 10);
    S.page = p > 0 ? p : 1;
    S.url = S.entry ? JN.pdfUrl(S.city, S.entry) : '';
  }

  function shareUrl() {
    var base = CFG.siteUrl ? String(CFG.siteUrl).replace(/\/+$/, '') : window.location.origin;
    return base + window.location.pathname + '?c=' + encodeURIComponent(S.city.id) + '&d=' + S.iso + (S.page > 1 ? '&p=' + S.page : '');
  }

  function syncUrl() {
    if (!S.iso || !window.history.replaceState) return;
    try {
      window.history.replaceState(null, '', window.location.pathname + '?c=' + encodeURIComponent(S.city.id) + '&d=' + S.iso + (S.page > 1 ? '&p=' + S.page : ''));
    } catch (e) {}
  }

  /* ---------- header, links, labels (re-run when language changes) ---------- */
  function neighbours() {
    var list = JN.editionsFor(S.manifest, S.city);   // newest first
    var older = null;
    var newer = null;
    if (!S.iso) return { older: null, newer: null };
    for (var i = 0; i < list.length; i++) {
      if (list[i].d < S.iso) { older = list[i]; break; }
    }
    for (var j = list.length - 1; j >= 0; j--) {
      if (list[j].d > S.iso) { newer = list[j]; break; }
    }
    return { older: older, newer: newer };
  }

  function renderChrome() {
    var lang = JN.getLang();
    var name = JN.cityName(S.city);

    // edition tabs
    var tabs = $('cityTabs');
    tabs.textContent = '';
    CFG.cities.forEach(function (city) {
      var target = S.iso && JN.findEdition(S.manifest, city, S.iso) ? S.iso : null;
      if (!target) {
        var latest = JN.editionsFor(S.manifest, city)[0];
        target = latest ? latest.d : null;
      }
      var a = el('a', {
        href: target ? JN.readerUrl(city.id, target) : 'index.html',
        text: JN.cityName(city),
        'aria-current': city.id === S.city.id ? 'page' : null
      });
      tabs.appendChild(a);
    });

    // date + previous / next edition
    $('edDate').textContent = S.iso ? JN.fmtDate(S.iso, { weekday: true }) : '';
    var nb = neighbours();
    var prev = $('prevEd');
    var next = $('nextEd');
    prev.textContent = '';
    next.textContent = '';
    if (nb.older) {
      prev.appendChild(el('a', { href: JN.readerUrl(S.city.id, nb.older.d), 'aria-label': t('prev_edition_aria') + ': ' + JN.fmtDate(nb.older.d) }, JN.icon('left'), t('prev_edition')));
    } else {
      prev.appendChild(el('span', { class: 'is-off', 'aria-disabled': 'true' }, JN.icon('left'), t('prev_edition')));
    }
    if (nb.newer) {
      next.appendChild(el('a', { href: JN.readerUrl(S.city.id, nb.newer.d), 'aria-label': t('next_edition_aria') + ': ' + JN.fmtDate(nb.newer.d) }, t('next_edition'), JN.icon('right')));
    } else {
      next.appendChild(el('span', { class: 'is-off', 'aria-disabled': 'true' }, t('next_edition'), JN.icon('right')));
    }

    // titles
    var title;
    if (S.iso) {
      title = t('page_title_reader', { city: name, date: JN.fmtDate(S.iso), brand: t('brand') });
    } else {
      title = t('page_title_reader_none', { brand: t('brand') });
    }
    document.title = title;
    $('rdTitle').textContent = title;

    // action buttons
    var dl = $('dlBtn');
    var open = $('openBtn');
    var wa = $('waBtn');
    if (S.entry) {
      dl.setAttribute('href', S.url);
      dl.setAttribute('download', JN.downloadName(S.city, S.iso));
      dl.removeAttribute('aria-disabled');
      open.setAttribute('href', S.url);
      open.removeAttribute('aria-disabled');
      wa.removeAttribute('aria-disabled');
    } else {
      [dl, open, wa].forEach(function (a) { a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href'); });
    }

    updateUi();
    renderMsg();
  }

  function updateUi() {
    $('pageLabel').textContent = t('page_x_of_y', { n: S.pages ? S.page : '–', total: S.pages || '–' });
    $('prevPage').disabled = !S.pdf || S.page <= 1;
    $('nextPage').disabled = !S.pdf || S.page >= S.pages;
    $('zoomOut').disabled = !S.pdf || S.zi <= 0;
    $('zoomIn').disabled = !S.pdf || S.zi >= ZOOMS.length - 1;
    $('zoomLabel').textContent = Math.round(ZOOMS[S.zi] * 100) + '%';
    $('fsLabel').textContent = document.fullscreenElement ? t('exit_fullscreen') : t('fullscreen');

    if (S.entry) {
      var text = t('share_text', { brand: t('brand'), city: JN.cityName(S.city), date: JN.fmtDate(S.iso, { weekday: true }) }) + '\n' + shareUrl();
      $('waBtn').setAttribute('href', 'https://wa.me/?text=' + encodeURIComponent(text));
    }

    Array.prototype.forEach.call($('thumbs').children, function (b) {
      var on = Number(b.getAttribute('data-page')) === S.page;
      b.setAttribute('aria-current', on ? 'true' : 'false');
    });
  }

  /* ---------- messages inside the viewer ---------- */
  function unavailableMsg() {
    var latest = JN.editionsFor(S.manifest, S.city)[0];
    return [
      el('h2', { text: t('unavailable_title') }),
      el('p', { text: t('unavailable_text') }),
      el('div', { class: 'btn-row' },
        latest ? el('a', { class: 'btn btn-primary', href: JN.readerUrl(S.city.id, latest.d), text: t('view_latest') }) : null,
        el('a', { class: 'btn btn-secondary', href: 'index.html#archive', text: t('go_archive') }))
    ];
  }
  function loadingMsg() { return [el('p', { text: t('loading') })]; }
  function failedMsg() {
    return [
      el('p', { text: t('viewer_failed') }),
      el('div', { class: 'btn-row' },
        S.url ? el('a', { class: 'btn btn-primary', href: S.url, target: '_blank', rel: 'noopener', text: t('open_pdf') }) : null)
    ];
  }

  function showMsg(fn) { S.msgFn = fn; renderMsg(); }
  function renderMsg() {
    var box = $('stageMsg');
    if (!S.msgFn) { box.hidden = true; box.textContent = ''; return; }
    box.textContent = '';
    S.msgFn().forEach(function (n) { box.appendChild(n); });
    box.hidden = false;
  }

  /* ---------- open the PDF ---------- */
  function open() {
    if (!S.entry) { showMsg(unavailableMsg); return; }
    showMsg(loadingMsg);
    var tok = ++S.edTok;
    JN.loadPdfJs()
      .then(function (lib) {
        return lib.getDocument({ url: S.url, disableAutoFetch: true, rangeChunkSize: 131072 }).promise;
      })
      .then(function (pdf) {
        if (tok !== S.edTok) return;
        S.pdf = pdf;
        S.pages = pdf.numPages;
        S.page = Math.max(1, Math.min(S.page, S.pages));
        showMsg(null);
        buildThumbs();
        updateUi();
        syncUrl();
        return renderPage();
      })
      .catch(function (err) {
        if (window.console) console.error(err);
        showMsg(err && err.name === 'MissingPDFException' ? unavailableMsg : failedMsg);
      });
  }

  /* ---------- draw the current page ---------- */
  function scrollAnchor(stage) {
    var w = stage.scrollWidth;
    var h = stage.scrollHeight;
    return {
      x: w ? (stage.scrollLeft + stage.clientWidth / 2) / w : 0.5,
      y: h ? (stage.scrollTop + stage.clientHeight / 2) / h : 0.5
    };
  }
  function restoreScroll(stage, a) {
    if (S.resetScroll) { stage.scrollTop = 0; stage.scrollLeft = 0; S.resetScroll = false; return; }
    stage.scrollLeft = a.x * stage.scrollWidth - stage.clientWidth / 2;
    stage.scrollTop = a.y * stage.scrollHeight - stage.clientHeight / 2;
  }

  function renderPage() {
    if (!S.pdf) return Promise.resolve();
    var token = ++S.token;
    if (S.task) { try { S.task.cancel(); } catch (e) {} S.task = null; }
    var stage = $('stage');
    stage.classList.add('is-busy');

    return S.pdf.getPage(S.page).then(function (page) {
      if (token !== S.token) return;
      var vp1 = page.getViewport({ scale: 1 });
      var ratio = vp1.width / vp1.height;
      S.ratio = ratio;

      var cs = window.getComputedStyle(stage);
      var availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      var base = isDesktop() ? Math.min(availW, Math.max(320, availH) * ratio) : availW;
      base = Math.max(200, base);

      var cssW = Math.floor(base * ZOOMS[S.zi]);
      var cssH = Math.floor(cssW / ratio);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (cssW * cssH * dpr * dpr > 16e6) dpr = Math.max(1, Math.sqrt(16e6 / (cssW * cssH)));

      var vp = page.getViewport({ scale: (cssW * dpr) / vp1.width });
      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';

      var anchor = scrollAnchor(stage);
      var task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
      S.task = task;
      return task.promise.then(function () {
        if (token !== S.token) return;
        var wrap = $('pageWrap');
        wrap.textContent = '';
        wrap.appendChild(canvas);
        wrap.style.width = cssW + 'px';
        wrap.style.height = cssH + 'px';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', t('page_x_of_y', { n: S.page, total: S.pages }) + ' — ' + JN.cityName(S.city) + ', ' + JN.fmtDate(S.iso, { weekday: true }));
        restoreScroll(stage, anchor);
        stage.classList.remove('is-busy');
      });
    }).catch(function (err) {
      if (err && err.name === 'RenderingCancelledException') return;
      if (window.console) console.error(err);
      stage.classList.remove('is-busy');
      showMsg(failedMsg);
    });
  }

  /* ---------- page thumbnails (desktop sidebar) / page chips (phone) ---------- */
  function buildThumbs() {
    var box = $('thumbs');
    box.textContent = '';
    var edTok = S.edTok;
    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { io.unobserve(en.target); queueThumb(en.target, edTok); }
        });
      });
    }
    for (var i = 1; i <= S.pages; i++) {
      (function (n) {
        var btn = el('button', {
          type: 'button', class: 'rd-thumb', 'data-page': String(n), 'aria-label': t('page_n', { n: n }),
          on: { click: function () { goTo(n, true); } }
        },
          el('span', { class: 'rd-thumb-img', style: 'aspect-ratio:' + S.ratio }),
          el('span', { class: 'rd-thumb-n', text: String(n) }));
        box.appendChild(btn);
        // phones get plain numbered chips (saves mobile data); only desktop draws page thumbnails
        if (!isDesktop()) return;
        if (io) io.observe(btn); else queueThumb(btn, edTok);
      })(i);
    }
  }

  function queueThumb(btn, edTok) {
    var n = Number(btn.getAttribute('data-page'));
    S.thumbQueue = S.thumbQueue.then(function () {
      if (edTok !== S.edTok || !S.pdf) return;
      return S.pdf.getPage(n).then(function (page) {
        var vp1 = page.getViewport({ scale: 1 });
        var vp = page.getViewport({ scale: 200 / vp1.width });
        var c = document.createElement('canvas');
        c.width = Math.floor(vp.width);
        c.height = Math.floor(vp.height);
        return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () {
          var holder = btn.querySelector('.rd-thumb-img');
          holder.style.aspectRatio = vp1.width + ' / ' + vp1.height;
          holder.appendChild(c);
        });
      });
    }).catch(function () {});
  }

  /* ---------- navigation ---------- */
  function goTo(n, byUser) {
    if (!S.pdf) return;
    n = Math.max(1, Math.min(S.pages, n));
    var changed = n !== S.page;
    S.page = n;
    if (changed) S.resetScroll = true;
    updateUi();
    syncUrl();
    renderPage();
    if (changed && byUser && !isDesktop()) {
      $('stage').scrollIntoView({ block: 'start' });
    }
    if (changed && isDesktop()) {
      var cur = $('thumbs').querySelector('[data-page="' + n + '"]');
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    }
  }

  function setZoom(i) {
    i = Math.max(0, Math.min(ZOOMS.length - 1, i));
    if (i === S.zi) return;
    S.zi = i;
    updateUi();
    renderPage();
  }

  /* ---------- controls ---------- */
  function bind() {
    $('prevPage').addEventListener('click', function () { goTo(S.page - 1, true); });
    $('nextPage').addEventListener('click', function () { goTo(S.page + 1, true); });
    $('zoomOut').addEventListener('click', function () { setZoom(S.zi - 1); });
    $('zoomIn').addEventListener('click', function () { setZoom(S.zi + 1); });
    $('pageWrap').addEventListener('dblclick', function () { setZoom(S.zi === 0 ? 2 : 0); });

    var fs = $('fsBtn');
    if (!(document.fullscreenEnabled && $('stage').requestFullscreen)) {
      fs.hidden = true;
    } else {
      fs.addEventListener('click', function () {
        if (document.fullscreenElement) document.exitFullscreen();
        else $('stage').requestFullscreen();
      });
      document.addEventListener('fullscreenchange', function () {
        updateUi();
        window.setTimeout(renderPage, 120);
      });
    }

    // anchors with no PDF behind them should not navigate
    ['dlBtn', 'openBtn', 'waBtn'].forEach(function (id) {
      $(id).addEventListener('click', function (e) {
        if (this.getAttribute('aria-disabled') === 'true') e.preventDefault();
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '+' || e.key === '=') { setZoom(S.zi + 1); }
      else if (e.key === '-' || e.key === '_') { setZoom(S.zi - 1); }
      else if (S.zi === 0 && e.key === 'ArrowRight') { goTo(S.page + 1, true); e.preventDefault(); }
      else if (S.zi === 0 && e.key === 'ArrowLeft') { goTo(S.page - 1, true); e.preventDefault(); }
    });

    // swipe left / right to change page (only when not zoomed in)
    var stage = $('stage');
    var sx = 0, sy = 0, st = 0, multi = false;
    stage.addEventListener('touchstart', function (e) {
      if (e.touches.length > 1) { multi = true; return; }
      multi = false;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (multi) { if (e.touches.length === 0) multi = false; return; }
      if (S.zi !== 0 || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - st < 700) {
        goTo(S.page + (dx < 0 ? 1 : -1), true);
      }
    }, { passive: true });

    var timer = null;
    var lastW = window.innerWidth;
    var wasDesktop = isDesktop();
    window.addEventListener('resize', function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        if (S.pdf && isDesktop() !== wasDesktop) { wasDesktop = isDesktop(); buildThumbs(); updateUi(); }
        if (window.innerWidth !== lastW || isDesktop()) { lastW = window.innerWidth; renderPage(); }
      }, 200);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    JN.initChrome();
    bind();
    updateUi();
    JN.loadManifest().then(function (m) {
      S.manifest = m;
      if (m.error) {
        S.city = CFG.cities[0];
        S.msgFn = function () { return [el('p', { text: t('manifest_error') })]; };
        renderChrome();
        return;
      }
      resolveFromUrl();
      renderChrome();
      JN.onLangChange(renderChrome);
      open();
    });
  });
})();
