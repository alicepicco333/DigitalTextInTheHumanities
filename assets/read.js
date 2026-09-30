/* Reading view: the TEI body (pre-rendered by tools/build_archive.py, mirroring
   template.xsl) with concept highlights. Up to four concepts at once, each with
   a validated colour, a distinct underline style and an inline label. */
(function () {
  'use strict';
  var W = window.WG, D = W.data, esc = W.esc;
  var MAX = 4;
  var params = new URLSearchParams(location.search);
  var t = W.text(params.get('t')) || D.texts[0];
  var idx = D.texts.indexOf(t);
  var active = {}; // cid -> slot 1..4
  var $ = function (id) { return document.getElementById(id); };

  document.title = t.title + ' · ' + t.author + ' · Words of Gender';

  // table of contents
  $('toc').innerHTML = D.texts.map(function (x) {
    return '<li><a href="texts.html?t=' + x.id + '"' + (x === t ? ' aria-current="page"' : '') + '>' +
      '<span class="a">' + esc(x.author) + '</span>' +
      '<span class="t">' + esc(x.title) + ' · ' + W.date(x) + '</span></a></li>';
  }).join('');

  // bibliographic head
  function link(u) { return '<a href="' + esc(u) + '">' + esc(u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</a>'; }
  var s = t.source, rows = [];
  if (t.authorFull) rows.push(['Author', esc(t.authorFull)]);
  if (t.workTitle) rows.push(['Section', esc(t.workTitle)]);
  if (t.container) rows.push(['In', '<i>' + esc(t.container) + '</i>']);
  rows.push([t.dateBasis === 'dc:date' ? 'Date' : 'First edition', t.firstEdition != null ? String(t.firstEdition) : 'Not encoded']);
  var src = [s.place, s.publisher, s.year].filter(Boolean).join(', ');
  if (s.editor) src += (src ? '; ' : '') + 'ed. ' + s.editor;
  rows.push(['Transcribed from', src ? esc(src) : 'Not recorded']);
  if (s.url) rows.push(['Digitised copy', link(s.url)]);
  rows.push(['Language', esc(W.langName(t))]);
  if (t.life) rows.push(['Life', (t.life.born || '?') + '–' + (t.life.died || '?') + (t.life.birthplace ? ' · born in ' + esc(t.life.birthplace) : '') +
    (t.firstEdition && t.life.died && t.firstEdition > t.life.died ? ' · this text appeared after her death' : '') +
    ' · <a href="https://www.wikidata.org/wiki/' + esc(t.life.qid) + '">Wikidata ' + esc(t.life.qid) + '</a>']);
  t.lod.author.forEach(function (u) { rows.push(['Author authority', link(u)]); });
  t.lod.work.forEach(function (u) { rows.push(['Work authority', link(u)]); });
  rows.push(['Encoded by', esc(t.encoder || '') + ' · <a href="' + esc(encodeURI(t.file)) + '">TEI source</a> · ' + t.words + ' words, ' + W.plural(t.segs.length, 'segment')]);

  var prev = D.texts[idx - 1], next = D.texts[idx + 1];
  $('page').innerHTML =
    '<header class="page-head">' +
      (W.portrait(t.id) ? '<img class="cameo" src="' + W.portrait(t.id) + '" alt="Portrait of ' + esc(t.author) + '" width="96" height="120">' : '') +
      '<p class="eyebrow">' + (idx + 1) + ' of ' + D.texts.length + ' · ' + esc(W.langName(t)) + (t.verse ? ' · verse' : ' · prose') + '</p>' +
      '<h1 lang="' + esc(t.lang) + '">' + esc(t.title) + '</h1>' +
      '<p class="byline"><b>' + esc(t.author) + '</b>' + (t.firstEdition != null ? ', ' + t.firstEdition : '') + '</p>' +
      '<details class="bib-d" id="bibd" open><summary>Edition, authorities and encoding</summary><dl class="biblio">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl></details>' +
    '</header>' +
    '<div class="text" id="text" lang="' + esc(t.lang) + '">' + t.html + '</div>' +
    '<nav class="pager" aria-label="Previous and next text">' +
      (prev ? '<a class="prev" href="texts.html?t=' + prev.id + '"><small>Previous</small><span>' + esc(prev.author) + '</span></a>' : '') +
      (next ? '<a class="next" href="texts.html?t=' + next.id + '"><small>Next</small><span>' + esc(next.author) + '</span></a>' : '') +
    '</nav>';

  var textEl = $('text');

  // below 1180px the concept panel moves into the article, just above the text
  var panel = document.querySelector('.panel'), inner = panel.querySelector('.panel-inner');
  var narrow = window.matchMedia('(max-width: 1180px)');
  function place() {
    if (narrow.matches) { textEl.parentNode.insertBefore(inner, textEl); panel.hidden = true; }
    else { panel.appendChild(inner); panel.hidden = false; }
  }
  place();
  if (narrow.addEventListener) narrow.addEventListener('change', place);
  if (window.matchMedia('(max-width: 820px)').matches) $('bibd').open = false;

  // concept list: declared interps plus any concept tagged but not declared
  var counts = {};
  t.segs.forEach(function (g) { g.concepts.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; }); });
  var list = t.concepts.map(function (c) { return { id: c.id, gloss: c.gloss }; });
  Object.keys(counts).forEach(function (c) { if (!list.some(function (x) { return x.id === c; })) list.push({ id: c, gloss: '' }); });
  list.sort(function (a, b) { return (counts[b.id] || 0) - (counts[a.id] || 0) || W.label(a.id).localeCompare(W.label(b.id)); });

  $('clist').innerHTML = list.map(function (c) {
    var n = counts[c.id] || 0;
    var gloss = c.gloss && c.gloss.toLowerCase() !== c.id.toLowerCase() && c.gloss.toLowerCase() !== W.label(c.id).toLowerCase() ? c.gloss : '';
    return '<li><button type="button" class="cbtn" data-c="' + esc(c.id) + '" aria-pressed="false"' + (n ? '' : ' aria-disabled="true"') + '>' +
      '<span class="box" aria-hidden="true"></span><span class="nm">' + esc(W.label(c.id)) + '</span>' +
      '<span class="ct">' + (n ? n : 'declared, not tagged') + '<span class="sr-only"> ' + (n === 1 ? 'passage' : 'passages') + '</span></span>' +
      (gloss ? '<span class="gloss">' + esc(gloss) + '</span>' : '') +
      '<span class="key" aria-hidden="true"><i></i><span class="kt"></span></span>' +
      '</button></li>';
  }).join('');

  // persons
  var pers = t.persons.filter(function (p) { return p.name; });
  if (pers.length) {
    $('persons').innerHTML = '<p class="hint" style="margin-top:12px">Named in <span class="mono">listPerson</span>: ' + pers.map(function (p) { return esc(p.name); }).join(', ') + '.</p>';
  } else {
    $('opt-pers-wrap').hidden = true;
  }

  var STYLES = { 1: 'solid line', 2: 'double line', 3: 'dashed line', 4: 'dotted line' };
  var segById = {};
  t.segs.forEach(function (g) { segById[g.id] = g; });

  // English: under each paragraph, the working translation of every tagged passage in it
  var hasEn = t.segs.some(function (g) { return g.en; });
  function drawEnglish() {
    textEl.querySelectorAll('.en-block').forEach(function (b) { b.remove(); });
    if (!hasEn || !$('opt-en').checked) return;
    textEl.querySelectorAll('p').forEach(function (p) {
      var gs = [].slice.call(p.querySelectorAll('.seg')).map(function (el) { return segById[el.id]; }).filter(function (g) { return g && g.en; });
      if (!gs.length) return;
      var d = document.createElement('div');
      d.className = 'en-block';
      d.setAttribute('lang', 'en');
      d.innerHTML = '<p class="en-h">In English <span>· working translation of the tagged passages</span></p><ol>' + gs.map(function (g) {
        var c = g.concepts.filter(function (x) { return active[x]; })[0];
        return '<li data-for="' + g.id + '"' + (c ? ' class="s' + active[c] + '"' : '') + '><span class="en-c">' + esc(g.concepts.map(W.label).join(' + ')) + '</span>' +
          esc(g.en) + (g.enNote ? '<span class="en-note">' + esc(g.enNote) + '</span>' : '') + '</li>';
      }).join('') + '</ol>';
      p.parentNode.insertBefore(d, p.nextSibling);
    });
  }
  // hovering a translation points at its passage, and the other way round
  textEl.addEventListener('mouseover', function (e) {
    var li = e.target.closest('.en-block li'), sg = e.target.closest('.seg');
    textEl.querySelectorAll('.pair').forEach(function (x) { x.classList.remove('pair'); });
    var id = li ? li.getAttribute('data-for') : sg ? sg.id : null;
    if (!id) return;
    var a = document.getElementById(id), b = textEl.querySelector('.en-block li[data-for="' + id + '"]');
    if (a && b) { a.classList.add('pair'); b.classList.add('pair'); }
  });

  // the encoding: select a passage to see its TEI
  function showTei(seg) {
    textEl.querySelectorAll('.tei-box').forEach(function (b) { b.remove(); });
    textEl.querySelectorAll('.seg.tei-sel').forEach(function (x) { x.classList.remove('tei-sel'); x.setAttribute('aria-expanded', 'false'); });
    if (!seg) return;
    var g = segById[seg.id];
    if (!g || !g.xml) return;
    var box = document.createElement('div');
    box.className = 'tei-box';
    box.id = 'tei-' + g.id;
    box.innerHTML = '<div class="tei-bar"><span>The TEI of this passage · <span class="mono">' + esc(t.file.split('/').pop()) + '</span></span>' +
      '<button type="button" class="tbtn tei-close">Close</button></div><pre><code>' + esc(g.xml) + '</code></pre>';
    var p = seg.closest('p') || seg;
    var nx = p.nextSibling;
    var after = nx && nx.classList && nx.classList.contains('en-block') ? nx : p;
    after.parentNode.insertBefore(box, after.nextSibling);
    seg.classList.add('tei-sel');
    seg.setAttribute('aria-expanded', 'true');
    box.querySelector('.tei-close').addEventListener('click', function () { showTei(null); seg.focus(); });
  }
  function teiMode(on) {
    textEl.classList.toggle('tei-on', on);
    textEl.querySelectorAll('.seg').forEach(function (g) {
      if (on) { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-expanded', 'false'); g.setAttribute('aria-label', 'Show the TEI of this passage: ' + g.textContent.trim().slice(0, 60)); }
      else { g.removeAttribute('tabindex'); g.removeAttribute('role'); g.removeAttribute('aria-expanded'); g.removeAttribute('aria-label'); }
    });
    if (!on) showTei(null);
    $('tei-hint').hidden = !on;
  }
  textEl.addEventListener('click', function (e) {
    if (!textEl.classList.contains('tei-on') || e.target.closest('.tei-box')) return;
    var seg = e.target.closest('.seg');
    if (seg) showTei(seg.classList.contains('tei-sel') ? null : seg);
  });
  textEl.addEventListener('keydown', function (e) {
    if (!textEl.classList.contains('tei-on') || (e.key !== 'Enter' && e.key !== ' ')) return;
    var seg = e.target.closest('.seg');
    if (seg && e.target === seg) { e.preventDefault(); showTei(seg.classList.contains('tei-sel') ? null : seg); }
  });

  function render() {
    // clear
    textEl.querySelectorAll('.lab').forEach(function (l) { l.remove(); });
    textEl.querySelectorAll('.seg').forEach(function (g) {
      g.classList.remove('on', 's1', 's2', 's3', 's4');
      var cs = (g.getAttribute('data-c') || '').split(' ');
      var on = cs.filter(function (c) { return active[c]; });
      if (!on.length) return;
      var slot = active[on[0]];
      g.classList.add('on', 's' + slot);
      var lab = document.createElement('span');
      lab.className = 'lab s' + slot;
      lab.innerHTML = '<i aria-hidden="true"></i>' + esc(on.map(W.label).join(' + ')) + (g.classList.contains('added') ? '<b class="y26">2026</b>' : '');
      g.insertBefore(lab, g.firstChild);
    });
    var n = Object.keys(active).length;
    document.querySelectorAll('.cbtn').forEach(function (b) {
      var c = b.getAttribute('data-c'), sl = active[c];
      b.classList.remove('s1', 's2', 's3', 's4');
      b.setAttribute('aria-pressed', sl ? 'true' : 'false');
      if (sl) { b.classList.add('s' + sl); b.querySelector('.kt').textContent = STYLES[sl]; }
      var untagged = !counts[c];
      b.setAttribute('aria-disabled', (untagged || (!sl && n >= MAX)) ? 'true' : 'false');
    });
    $('status').textContent = n >= MAX ? 'Four concepts are on. Switch one off to add another.' : '';
    drawEnglish();
    var q = new URLSearchParams(location.search);
    q.set('t', t.id);
    var on = Object.keys(active).sort(function (a, b) { return active[a] - active[b]; });
    if (on.length) q.set('c', on.join(',')); else q.delete('c');
    try { history.replaceState(null, '', '?' + q.toString() + location.hash); } catch (e) { /* ignore */ }
  }

  function turnOn(c) {
    if (active[c] || !counts[c] || Object.keys(active).length >= MAX) return false;
    var used = Object.keys(active).map(function (k) { return active[k]; });
    for (var i = 1; i <= MAX; i++) if (used.indexOf(i) < 0) { active[c] = i; return true; }
    return false;
  }

  $('clist').addEventListener('click', function (e) {
    var b = e.target.closest('.cbtn');
    if (!b) return;
    var c = b.getAttribute('data-c');
    if (active[c]) delete active[c];
    else if (!counts[c]) { $('status').textContent = 'This concept is declared in the header but no passage is tagged with it.'; return; }
    else if (!turnOn(c)) { $('status').textContent = 'Four concepts are on. Switch one off to add another.'; return; }
    render();
  });
  $('clear').addEventListener('click', function () { active = {}; render(); });
  $('opt-labels').addEventListener('change', function () { textEl.classList.toggle('no-labels', !this.checked); });
  $('opt-pers').addEventListener('change', function () { textEl.classList.toggle('show-pers', this.checked); });
  if (hasEn) { $('opt-en').checked = true; $('opt-en').addEventListener('change', drawEnglish); } else { $('opt-en-wrap').hidden = true; }
  $('opt-tei').addEventListener('change', function () { teiMode(this.checked); });

  // initial state from the URL
  (params.get('c') || '').split(',').filter(Boolean).forEach(turnOn);
  render();
  if (location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    if (target && target.classList.contains('seg')) {
      target.classList.add('target');
      target.setAttribute('tabindex', '-1');
      requestAnimationFrame(function () { target.scrollIntoView({ block: 'center' }); target.focus({ preventScroll: true }); });
    }
  }
})();
