/* Home: facts row and the "contents in time" timeline, built from data/archive.js */
(function () {
  'use strict';
  var W = window.WG, D = W.data, esc = W.esc;
  var Y0 = 1480, Y1 = 2030;
  function pct(y) { return ((y - Y0) / (Y1 - Y0) * 100).toFixed(3) + '%'; }

  // facts
  var langs = {}, segs = 0, dated = [];
  D.texts.forEach(function (t) { langs[t.langName] = 1; segs += t.segs.length; if (t.firstEdition) dated.push(t.firstEdition); });
  var nConcepts = Object.keys(D.concepts).length;
  var facts = [
    [D.texts.length, 'women authors'],
    [D.texts.length, 'annotated excerpts'],
    [Object.keys(langs).length, 'languages: ' + Object.keys(langs).join(', ')],
    [nConcepts, 'concepts in the interpGrp'],
    [segs, 'tagged passages (seg)'],
    [Math.min.apply(null, dated) + '–' + Math.max.apply(null, dated), 'first editions']
  ];
  document.getElementById('facts').innerHTML = facts.map(function (f) {
    return '<li><b>' + esc(f[0]) + '</b>' + esc(f[1]) + '</li>';
  }).join('');

  // timeline
  var ol = document.getElementById('timeline');
  var ticks = '';
  for (var y = 1500; y <= 2000; y += 100) ticks += '<span class="tick" style="left:' + pct(y) + '">' + y + '</span>';
  var grid = '';
  for (y = 1500; y <= 2000; y += 100) grid += '<span class="grid" style="left:' + pct(y) + '" aria-hidden="true"></span>';
  var html = '<li class="tl-axis" aria-hidden="true"><span class="axl">Author and excerpt</span><div class="track">' + ticks + '</div></li>';

  D.texts.forEach(function (t) {
    var s = t.source, f = t.firstEdition;
    var ed = [W.langName(t)];
    if (f != null) ed.push((t.dateBasis === 'dc:date' ? 'dated ' : 'first edition ') + f);
    else ed.push('original date not encoded');
    if (s.year && s.year !== f) {
      ed.push('transcribed from ' + [s.place, s.publisher].filter(Boolean).join(': ') + ', ' + s.year);
    } else if (s.year === f && (s.place || s.publisher)) {
      ed.push('transcribed from this edition, ' + [s.place, s.publisher].filter(Boolean).join(': '));
    } else if (!s.place && !s.publisher) {
      ed.push('source edition not recorded');
    }
    ed.push(W.plural(t.segs.length, 'passage'));
    var L = t.life;
    if (L && f != null && L.died && f > L.died) ed.push('published ' + (f - L.died) + ' years after her death');

    var tr = grid;
    if (L && L.born && L.died && L.died > Y0) {
      tr += '<span class="life" style="left:' + pct(Math.max(Y0, L.born)) + ';width:calc(' + pct(L.died) + ' - ' + pct(Math.max(Y0, L.born)) + ')"></span>';
    }
    if (f != null && s.year && s.year !== f) {
      tr += '<span class="span" style="left:' + pct(f) + ';width:calc(' + pct(s.year) + ' - ' + pct(f) + ')"></span>';
    }
    if (s.year && (s.place || s.publisher) && s.year !== f) {
      tr += '<span class="m src" style="left:' + pct(s.year) + '"></span>';
      if (f == null || Math.abs(s.year - f) > 30) tr += '<span class="yr src" style="left:' + pct(s.year) + '">' + s.year + '</span>';
    }
    if (f != null && s.year === f && (s.place || s.publisher)) {
      tr += '<span class="m src same" style="left:' + pct(f) + '"></span>';
    }
    if (f != null) {
      tr += '<span class="m first" style="left:' + pct(f) + '"></span>';
      var lab = (s.year && s.year !== f && Math.abs(s.year - f) <= 30) ? f + ' / ' + s.year : String(f);
      tr += '<span class="yr" style="left:' + pct(f) + '">' + lab + '</span>';
    } else {
      tr += '<span class="nd">date of the letter not encoded' + (L && L.died && L.died < Y0 ? '; she lived ' + L.born + '–' + L.died + ', before this axis' : '') + '</span>';
    }
    var what = t.title + (t.container ? ', in ' + t.container : (t.workTitle ? ', ' + t.workTitle : ''));
    html += '<li class="tl-row">' +
      '<div class="tl-meta">' + (W.portrait(t.id) ? '<img class="tl-face" src="' + W.portrait(t.id) + '" alt="" width="48" height="60" loading="lazy">' : '') +
      '<div class="who">' + esc(t.author) + (L && L.born ? ' <span class="dates">' + L.born + '–' + (L.died || '') + '</span>' : '') + '</div>' +
      '<div class="what">' + esc(what) + '</div>' +
      '<div class="ed">' + esc(ed.join(' · ')) + '</div></div>' +
      '<div class="track" aria-hidden="true">' + tr + '</div>' +
      '<a class="tl-link" href="texts.html?t=' + t.id + '"><span class="sr-only">Read ' + esc(t.title) + ' by ' + esc(t.author) + '</span></a>' +
      '</li>';
  });
  ol.innerHTML = html;
})();
