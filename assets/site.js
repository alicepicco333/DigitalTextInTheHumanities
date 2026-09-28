/* Words of Gender — shared helpers and the light/dark switch. */
(function () {
  'use strict';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function effective() {
    var t = root.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return mq && mq.matches ? 'dark' : 'light';
  }
  function paint(btn) {
    var dark = effective() === 'dark';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    btn.querySelector('.tl').textContent = dark ? 'Light' : 'Dark';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme');
    if (!btn) return;
    paint(btn);
    btn.addEventListener('click', function () {
      var next = effective() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('wog-theme', next); } catch (e) { /* storage unavailable */ }
      paint(btn);
    });
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { paint(btn); });
  });

  var D = window.WOG;
  if (!D) return;
  var byId = {};
  D.texts.forEach(function (t) { byId[t.id] = t; });

  window.WG = {
    data: D,
    text: function (id) { return byId[id]; },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    label: function (cid) { return D.concepts[cid] ? D.concepts[cid].label : cid; },
    date: function (t) { return t.firstEdition != null ? String(t.firstEdition) : 'n.d.'; },
    plural: function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); },
    portrait: function (id) { return { marguerite: 'marguerite', wollstonecraft: 'wollstonecraft', cahun: 'cahun' }[id] ? 'assets/portraits/' + id + '.jpg' : null; },
    langName: function (t) { return t.langName || (t.lang || '').toUpperCase(); }
  };
})();
