/* Home page: latest editions, archive calendar, footer. */
(function () {
  'use strict';

  var JN = window.JN;
  var CFG = JN.CFG;
  var t = JN.t;
  var el = JN.el;
  var $ = JN.$;

  var manifest = { cities: {} };
  var cal = { vy: 0, vm: 0, sel: null, map: {}, dates: [], focus: null };

  function thumbBox(city, ed, withPill) {
    var box = el('div', { class: 'paper', 'aria-hidden': 'true' }, JN.skeleton());
    if (ed) JN.mountThumb(box, JN.pdfUrl(city, ed), ed.t ? JN.thumbUrl(city, ed) : null);
    if (withPill) box.appendChild(el('span', { class: 'pill', text: t('front_page') }));
    return box;
  }

  /* ---------- strap / title ---------- */
  function renderStrap() {
    $('strapDate').textContent = JN.fmtDate(JN.todayISO(), { weekday: true });
    $('strapCities').textContent = JN.citiesLine();
    document.title = t('page_title_home', { cities: CFG.cities.map(JN.cityName).join(' · ') });
  }

  /* ---------- latest editions ---------- */
  function renderLatest() {
    var grid = $('editionGrid');
    grid.textContent = '';
    if (manifest.error) {
      grid.appendChild(el('p', { class: 'notice', text: t('manifest_error') }));
      return;
    }
    var today = JN.todayISO();

    CFG.cities.forEach(function (city) {
      var ed = JN.editionsFor(manifest, city)[0] || null;
      var name = JN.cityName(city);
      var card = el('article', { class: 'edition' });

      if (!ed) {
        var empty = thumbBox(city, null, false);
        empty.classList.add('is-empty');
        empty.appendChild(el('span', { class: 'pill', text: t('none_yet') }));
        card.appendChild(el('div', { class: 'thumb-link' }, empty));
        card.appendChild(el('div', { class: 'edition-head' },
          el('h3', { text: name }), el('span', { class: 'edition-sub', text: t('edition_word') })));
        grid.appendChild(card);
        return;
      }

      var href = JN.readerUrl(city.id, ed.d);
      var isToday = ed.d >= today;
      var dateText = JN.fmtDate(ed.d, { weekday: true });

      card.appendChild(el('a', {
        class: 'thumb-link', href: href,
        'aria-label': t('read') + ': ' + name + ', ' + dateText
      }, thumbBox(city, ed, true)));

      card.appendChild(el('div', { class: 'edition-head' },
        el('h3', { text: name }), el('span', { class: 'edition-sub', text: t('edition_word') })));

      card.appendChild(el('p', { class: 'edition-date' },
        el('span', { class: 'badge' + (isToday ? '' : ' badge-muted'), text: isToday ? t('badge_today') : t('badge_previous') }),
        el('span', { text: dateText })));

      card.appendChild(el('div', { class: 'btn-row' },
        el('a', { class: 'btn btn-primary', href: href, text: t('read') }),
        el('a', { class: 'btn btn-secondary', href: JN.pdfUrl(city, ed), download: JN.downloadName(city, ed.d) },
          JN.icon('download'), t('download_pdf'))));

      grid.appendChild(card);
    });
  }

  /* ---------- archive ---------- */
  function initCal() {
    var map = {};
    CFG.cities.forEach(function (c) {
      JN.editionsFor(manifest, c).forEach(function (e) { (map[e.d] = map[e.d] || []).push(c.id); });
    });
    cal.map = map;
    cal.dates = Object.keys(map).sort();            // oldest -> newest
    if (!cal.dates.length) { cal.sel = null; return; }
    var newest = cal.dates.slice().reverse();
    cal.sel = newest.length > 1 ? newest[1] : newest[0];
    var p = JN.parseISO(cal.sel);
    cal.vy = p.y;
    cal.vm = p.m;
  }

  function monthIndex(y, m) { return y * 12 + m; }

  function renderCalendar() {
    var first = JN.parseISO(cal.dates[0]);
    var last = JN.parseISO(cal.dates[cal.dates.length - 1]);
    var atMin = monthIndex(cal.vy, cal.vm) <= monthIndex(first.y, first.m);
    var atMax = monthIndex(cal.vy, cal.vm) >= monthIndex(last.y, last.m);
    var today = JN.todayISO();
    var lang = JN.getLang();

    function shiftMonth(delta, focusId) {
      var d = new Date(Date.UTC(cal.vy, cal.vm - 1 + delta, 1));
      cal.vy = d.getUTCFullYear();
      cal.vm = d.getUTCMonth() + 1;
      cal.focus = focusId;
      renderArchive();
    }

    var head = el('div', { class: 'cal-head' },
      el('button', { type: 'button', id: 'calPrev', class: 'cal-nav', 'aria-label': t('prev_month'), disabled: atMin, on: { click: function () { shiftMonth(-1, 'calPrev'); } } }, JN.icon('left', 22)),
      el('div', { class: 'cal-title', 'aria-live': 'polite', text: JN.MONTHS[lang][cal.vm - 1] + ' ' + cal.vy }),
      el('button', { type: 'button', id: 'calNext', class: 'cal-nav', 'aria-label': t('next_month'), disabled: atMax, on: { click: function () { shiftMonth(1, 'calNext'); } } }, JN.icon('right', 22)));

    var grid = el('div', { class: 'cal-grid' });
    JN.DAYS_SHORT[lang].forEach(function (d) { grid.appendChild(el('span', { class: 'cal-dow', text: d })); });

    var lead = JN.weekday(cal.vy, cal.vm, 1);
    for (var i = 0; i < lead; i++) grid.appendChild(el('span', { 'aria-hidden': 'true' }));
    var count = new Date(Date.UTC(cal.vy, cal.vm, 0)).getUTCDate();

    for (var d = 1; d <= count; d++) {
      (function (day) {
        var iso = JN.isoOf(cal.vy, cal.vm, day);
        var has = !!cal.map[iso];
        var cls = 'cal-day' + (iso === today ? ' is-today' : '');
        if (!has) {
          grid.appendChild(el('span', { class: cls + ' is-off', 'aria-hidden': 'true', text: String(day) }));
          return;
        }
        grid.appendChild(el('button', {
          type: 'button', class: cls, 'data-iso': iso,
          'aria-pressed': iso === cal.sel ? 'true' : 'false',
          'aria-label': JN.fmtDate(iso, { weekday: true }),
          text: String(day),
          on: { click: function () { cal.sel = iso; cal.focus = 'iso:' + iso; renderArchive(); } }
        }));
      })(d);
    }

    return el('div', { class: 'cal' }, head, grid);
  }

  function renderResults() {
    var wrap = el('div', { class: 'res' });
    wrap.appendChild(el('div', { class: 'res-head' },
      el('h3', { text: JN.fmtDate(cal.sel, { weekday: true }) }),
      el('span', { class: 'res-sub', text: t('results_sub') })));

    var grid = el('div', { class: 'res-grid' });
    CFG.cities.forEach(function (city) {
      var ed = JN.findEdition(manifest, city, cal.sel);
      var name = JN.cityName(city);
      var card = el('article', { class: 'res-card' + (ed ? '' : ' is-missing') });

      if (ed) {
        var href = JN.readerUrl(city.id, ed.d);
        card.appendChild(el('a', { class: 'thumb-link', href: href, tabindex: '-1', 'aria-hidden': 'true' }, thumbBox(city, ed, false)));
        card.appendChild(el('h4', { text: name }));
        card.appendChild(el('div', { class: 'btn-row' },
          el('a', { class: 'btn btn-primary btn-sm', href: href, 'aria-label': t('read') + ': ' + name + ', ' + JN.fmtDate(ed.d, { weekday: true }), text: t('read_short') }),
          el('a', { class: 'btn btn-secondary btn-sm', href: JN.pdfUrl(city, ed), download: JN.downloadName(city, ed.d), 'aria-label': t('download_pdf') + ': ' + name, text: t('pdf_short') })));
      } else {
        var ph = thumbBox(city, null, false);
        ph.classList.add('is-empty');
        card.appendChild(el('div', { class: 'thumb-link' }, ph));
        card.appendChild(el('h4', { text: name }));
        card.appendChild(el('p', { class: 'res-missing', text: t('not_available') }));
      }
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  function renderArchive() {
    var box = $('archiveBody');
    box.textContent = '';
    if (manifest.error) { box.appendChild(el('p', { class: 'notice', text: t('manifest_error') })); return; }
    if (!cal.dates.length) { box.appendChild(el('p', { class: 'notice', text: t('archive_empty') })); return; }
    box.appendChild(renderCalendar());
    box.appendChild(renderResults());

    if (cal.focus) {
      var target = null;
      if (cal.focus.indexOf('iso:') === 0) target = box.querySelector('[data-iso="' + cal.focus.slice(4) + '"]');
      else target = $(cal.focus);
      if (target && !target.disabled) target.focus();
      cal.focus = null;
    }
  }

  /* ---------- footer ---------- */
  function contactNode(value) {
    if (!value) return null;
    var v = String(value).trim();
    if (/^[^\s@\[\]]+@[^\s@]+\.[^\s@]+$/.test(v)) return el('a', { href: 'mailto:' + v, text: v });
    if (/^\+?[\d][\d\s\-()]{6,}$/.test(v)) return el('a', { href: 'tel:' + v.replace(/[^\d+]/g, ''), text: v });
    return el('span', { text: v });
  }

  function renderFooter() {
    var lang = JN.getLang();
    $('footerEditions').textContent = t('editions_line', { cities: CFG.cities.map(JN.cityName).join(' · ') });
    $('rights').textContent = t('rights', { year: new Date().getFullYear() });

    var box = $('offices');
    box.textContent = '';
    CFG.cities.forEach(function (city) {
      var o = (CFG.offices && CFG.offices[city.id]) || {};
      var addr = o.address && (o.address[lang] || o.address.en || o.address);
      box.appendChild(el('div', { class: 'office' },
        el('h3', { text: t('office_fmt', { city: JN.cityName(city) }) }),
        addr ? el('span', { text: typeof addr === 'string' ? addr : '' }) : null,
        contactNode(o.phone),
        contactNode(o.email)));
    });
  }

  function renderAll() {
    renderStrap();
    renderLatest();
    renderArchive();
    renderFooter();
  }

  document.addEventListener('DOMContentLoaded', function () {
    JN.initChrome();
    renderStrap();
    renderFooter();
    JN.loadManifest().then(function (m) {
      manifest = m;
      initCal();
      renderAll();
      JN.onLangChange(renderAll);
    });
  });
})();
