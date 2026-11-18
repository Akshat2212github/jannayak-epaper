/* Shared helpers: language, dates, list of editions, PDF.js loader, thumbnails. */
(function () {
  'use strict';

  var CFG = window.JANNAYAK_CONFIG || {};
  CFG.cities = CFG.cities || [];
  CFG.pdfBase = CFG.pdfBase || 'pdfs';
  var STR = window.JN_STR;
  var listeners = [];

  /* ---------- language ---------- */
  function detectLang() {
    var q = null;
    try { q = new URLSearchParams(window.location.search).get('lang'); } catch (e) {}
    if (q === 'hi' || q === 'en') {
      try { localStorage.setItem('jn_lang', q); } catch (e) {}
      return q;
    }
    try {
      var s = localStorage.getItem('jn_lang');
      if (s === 'hi' || s === 'en') return s;
    } catch (e) {}
    return CFG.defaultLang === 'en' ? 'en' : 'hi';
  }
  var lang = detectLang();

  function t(key, vars) {
    var s = (STR[lang] && STR[lang][key]) || (STR.en && STR.en[key]) || key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    }
    return s;
  }

  function applyI18n(root) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n]'), function (n) {
      n.textContent = t(n.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n-attr]'), function (n) {
      n.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':');
        if (p.length === 2) n.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    });
  }

  function setLang(l) {
    if (l !== 'hi' && l !== 'en') return;
    lang = l;
    try { localStorage.setItem('jn_lang', l); } catch (e) {}
    document.documentElement.lang = l;
    syncLangButtons();
    applyI18n(document);
    listeners.forEach(function (fn) { fn(l); });
  }

  function syncLangButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-lang]'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
    });
  }

  function onLangChange(fn) { listeners.push(fn); }

  /* ---------- tiny DOM helper ---------- */
  function $(id) { return document.getElementById(id); }

  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'on') Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); });
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  /* ---------- icons ---------- */
  var ICONS = {
    download: '<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6"/><path d="m8.2 13.2 7.6 3.6"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    full: '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>'
  };

  function iconSvg(name, size) {
    size = size || 20;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      (ICONS[name] || '') + '</svg>';
  }

  function icon(name, size) {
    var s = el('span', { class: 'ic', 'aria-hidden': 'true' });
    s.innerHTML = iconSvg(name, size);
    return s;
  }

  function fillIcons(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('[data-icon]'), function (n) {
      n.classList.add('ic');
      n.setAttribute('aria-hidden', 'true');
      n.innerHTML = iconSvg(n.getAttribute('data-icon'), Number(n.getAttribute('data-size')) || 20);
    });
  }

  /* ---------- dates ---------- */
  var MONTHS = {
    hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्तूबर', 'नवंबर', 'दिसंबर'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };
  var DAYS = {
    hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  };
  var DAYS_SHORT = {
    hi: ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoOf(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function parseISO(iso) {
    var p = String(iso).split('-');
    return { y: Number(p[0]), m: Number(p[1]), d: Number(p[2]) };
  }
  function weekday(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
  function isISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }

  function fmtDate(iso, o) {
    o = o || {};
    var p = parseISO(iso);
    var s = p.d + ' ' + MONTHS[lang][p.m - 1];
    if (o.year !== false) s += ' ' + p.y;
    if (o.weekday) s = DAYS[lang][weekday(p.y, p.m, p.d)] + ', ' + s;
    return s;
  }

  function todayISO() {
    try {
      var s = new Intl.DateTimeFormat('en-CA', {
        timeZone: CFG.timezone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
      if (isISO(s)) return s;
    } catch (e) {}
    var n = new Date();
    return isoOf(n.getFullYear(), n.getMonth() + 1, n.getDate());
  }

  function fileDate(iso) {
    var p = parseISO(iso);
    return pad(p.d) + '_' + pad(p.m) + '__' + p.y;
  }

  /* ---------- cities & editions ---------- */
  function cityById(id) {
    for (var i = 0; i < CFG.cities.length; i++) if (CFG.cities[i].id === id) return CFG.cities[i];
    return null;
  }
  function cityName(c) { return (c.name && (c.name[lang] || c.name.en)) || c.id; }
  function cityNameEn(c) { return (c.name && c.name.en) || c.id; }
  function citiesLine() {
    return CFG.cities.map(cityName).join('  ·  ');
  }

  var manifestPromise = null;
  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch('editions.json', { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('editions.json: HTTP ' + r.status);
          return r.json();
        })
        .then(function (m) { m.cities = m.cities || {}; return m; })
        .catch(function (err) {
          if (window.console) console.error(err);
          return { error: true, cities: {} };
        });
    }
    return manifestPromise;
  }

  /* newest first */
  function editionsFor(manifest, city) {
    return (manifest && manifest.cities && manifest.cities[city.folder]) || [];
  }
  function findEdition(manifest, city, iso) {
    var list = editionsFor(manifest, city);
    for (var i = 0; i < list.length; i++) if (list[i].d === iso) return list[i];
    return null;
  }

  function pdfUrl(city, ed) {
    return CFG.pdfBase.replace(/\/+$/, '') + '/' + encodeURIComponent(city.folder) + '/' + encodeURIComponent(ed.f);
  }
  function thumbUrl(city, ed) {
    return CFG.pdfBase.replace(/\/+$/, '') + '/' + encodeURIComponent(city.folder) + '/' + encodeURIComponent(ed.t);
  }
  function readerUrl(cityId, iso, page) {
    var u = 'reader.html?c=' + encodeURIComponent(cityId) + '&d=' + encodeURIComponent(iso);
    if (page && page > 1) u += '&p=' + page;
    return u;
  }
  function downloadName(city, iso) {
    return 'Jannayak_' + cityNameEn(city).replace(/[^A-Za-z0-9]+/g, '') + '_' + fileDate(iso) + '.pdf';
  }

  /* ---------- PDF.js (loaded only when needed) ---------- */
  var pdfjsPromise = null;
  function loadPdfJs() {
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = new Promise(function (resolve, reject) {
      var have = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
      if (have) { resolve(have); return; }
      var s = document.createElement('script');
      s.src = 'assets/vendor/pdfjs/pdf.min.js';
      s.async = true;
      s.onload = function () {
        var lib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
        if (!lib) { reject(new Error('pdf.js did not load')); return; }
        lib.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdfjs/pdf.worker.min.js';
        resolve(lib);
      };
      s.onerror = function () { reject(new Error('pdf.js could not be loaded')); };
      document.head.appendChild(s);
    });
    return pdfjsPromise;
  }

  /* ---------- thumbnails ---------- */
  var thumbQueue = Promise.resolve();

  function skeleton() {
    return el('span', { class: 'sk', 'aria-hidden': 'true' },
      el('i', { class: 'sk-band' }), el('i', { class: 'sk-h1' }), el('i', { class: 'sk-h2' }),
      el('i', { class: 'sk-img' }), el('i', { class: 'sk-txt' }),
      el('i', { class: 'sk-c1' }), el('i', { class: 'sk-c2' }), el('i', { class: 'sk-c3' }));
  }

  function showImage(box, src) {
    var img = el('img', { alt: '', decoding: 'async' });
    img.onload = function () { box.classList.add('loaded'); };
    img.src = src;
    box.insertBefore(img, box.firstChild);
  }

  function renderFirstPage(url, width) {
    return loadPdfJs().then(function (lib) {
      return lib.getDocument({ url: url, disableAutoFetch: true, rangeChunkSize: 65536 }).promise.then(function (pdf) {
        return pdf.getPage(1).then(function (page) {
          var vp1 = page.getViewport({ scale: 1 });
          var vp = page.getViewport({ scale: width / vp1.width });
          var canvas = document.createElement('canvas');
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
            var data = canvas.toDataURL('image/jpeg', 0.82);
            try { pdf.destroy(); } catch (e) {}
            return data;
          });
        });
      });
    });
  }

  function whenVisible(node, fn) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
    }, { rootMargin: '300px' });
    io.observe(node);
  }

  /* box: a .paper element. Uses a ready-made image if the folder has one, else draws page 1 of the PDF. */
  function mountThumb(box, pdf, premade) {
    var key = 'jn_thumb:' + (premade || pdf);
    var cached = null;
    try { cached = sessionStorage.getItem(key); } catch (e) {}
    if (cached) { showImage(box, cached); return; }
    if (premade) {
      whenVisible(box, function () { showImage(box, premade); });
      return;
    }
    whenVisible(box, function () {
      thumbQueue = thumbQueue.then(function () {
        return renderFirstPage(pdf, 480).then(function (data) {
          showImage(box, data);
          try { sessionStorage.setItem(key, data); } catch (e) {}
        });
      }).catch(function (err) {
        if (window.console) console.warn('thumbnail failed', err);
      });
    });
  }

  /* ---------- page setup shared by every page ---------- */
  function initChrome() {
    if (CFG.accent) document.documentElement.style.setProperty('--accent', CFG.accent);
    document.documentElement.lang = lang;
    applyI18n(document);
    fillIcons(document);
    syncLangButtons();
    Array.prototype.forEach.call(document.querySelectorAll('[data-lang]'), function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
    });
  }

  window.JN = {
    CFG: CFG, t: t, getLang: function () { return lang; }, setLang: setLang, onLangChange: onLangChange,
    applyI18n: applyI18n, initChrome: initChrome,
    $: $, el: el, icon: icon, fillIcons: fillIcons,
    MONTHS: MONTHS, DAYS: DAYS, DAYS_SHORT: DAYS_SHORT,
    pad: pad, isoOf: isoOf, parseISO: parseISO, weekday: weekday, isISO: isISO, fmtDate: fmtDate, todayISO: todayISO,
    cityById: cityById, cityName: cityName, cityNameEn: cityNameEn, citiesLine: citiesLine,
    loadManifest: loadManifest, editionsFor: editionsFor, findEdition: findEdition,
    pdfUrl: pdfUrl, thumbUrl: thumbUrl, readerUrl: readerUrl, downloadName: downloadName,
    loadPdfJs: loadPdfJs, skeleton: skeleton, mountThumb: mountThumb
  };
})();
