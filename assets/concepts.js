/* Concepts: author × concept matrix and the side-by-side comparison of passages. */
(function () {
  'use strict';
  var W = window.WG, D = W.data, esc = W.esc;
  var texts = D.texts;
  var C = D.concepts;
  var ids = Object.keys(C);
  var maxN = 0;
  ids.forEach(function (c) { Object.keys(C[c].counts).forEach(function (t) { maxN = Math.max(maxN, C[c].counts[t]); }); });
  var order = 'shared';
  var params = new URLSearchParams(location.search);
  var sel = C[params.get('c')] ? params.get('c') : 'beauty';
  var $ = function (id) { return document.getElementById(id); };
  var LIMIT = 70; // words shown before "show the whole passage"

  function size(n) { return (6 + 14 * Math.sqrt(n / maxN)).toFixed(1); }
  function nAuthors(c) { return Object.keys(C[c].counts).length; }
  function sorted() {
    return ids.slice().sort(order === 'alpha'
      ? function (a, b) { return C[a].label.localeCompare(C[b].label); }
      : function (a, b) { return nAuthors(b) - nAuthors(a) || C[b].passages - C[a].passages || C[a].label.localeCompare(C[b].label); });
  }
  function shortName(t) {
    var m = { 'Marguerite de Navarre': 'Marguerite de Navarre', 'Madame de Lambert': 'Mme de Lambert', 'Simone de Beauvoir': 'S. de Beauvoir', 'Mary Wollstonecraft': 'M. Wollstonecraft' };
    return m[t.author] || t.author;
  }

  function drawMatrix() {
    var h = '<caption>' + ids.length + ' concepts × ' + texts.length + ' authors. Dot area is proportional to the number of tagged passages.</caption>';
    h += '<thead><tr><th scope="col" class="cn">Concept</th>';
    texts.forEach(function (t) {
      h += '<th scope="col" class="au" data-t="' + t.id + '"><span>' + esc(shortName(t)) + ' <small>' + W.date(t) + '</small></span></th>';
    });
    h += '<th scope="col" class="tot"><span class="long">Authors · passages</span><span class="sr-only"> totals</span></th></tr></thead><tbody>';
    sorted().forEach(function (c) {
      var k = C[c];
      h += '<tr data-c="' + c + '"' + (c === sel ? ' class="sel"' : '') + '><th scope="row"><button type="button" class="rowbtn" data-c="' + c + '" aria-pressed="' + (c === sel) + '">' + esc(k.label) + '</button></th>';
      texts.forEach(function (t) {
        var n = k.counts[t.id] || 0;
        var declared = k.declared.indexOf(t.id) >= 0;
        var dot, sr;
        if (n) { dot = '<span class="dot" style="width:' + size(n) + 'px;height:' + size(n) + 'px"></span>'; sr = W.plural(n, 'passage'); }
        else if (declared) { dot = '<span class="dot decl"></span>'; sr = 'declared, no passage tagged'; }
        else { dot = '<span class="dot none"></span>'; sr = 'none'; }
        h += '<td' + (n ? ' class="cell"' : '') + ' data-c="' + c + '" data-t="' + t.id + '" data-n="' + n + '" data-d="' + (declared ? 1 : 0) + '">' + dot + '<span class="sr-only">' + esc(t.author) + ': ' + sr + '</span></td>';
      });
      h += '<td class="tot">' + nAuthors(c) + ' · ' + k.passages + '</td></tr>';
    });
    $('matrix').innerHTML = h + '</tbody>';
  }

  function words(s) { return s.split(/\s+/); }

  function drawCompare(focusAuthor) {
    var k = C[sel];
    var users = texts.filter(function (t) { return k.counts[t.id]; });
    var absent = texts.filter(function (t) { return !k.counts[t.id]; });
    var h = '<header class="cmp-head"><p class="eyebrow">Concept</p><h2 id="cmp-h">' + esc(k.label) + '</h2>' +
      '<p class="stat">' + W.plural(k.passages, 'tagged passage') + ' by ' + users.length + ' of ' + texts.length + ' authors' +
      ' · <span class="mono">ana="#' + esc(sel) + '"</span></p>';
    if (k.doc) h += '<p class="doc">' + esc(k.doc) + '</p><p class="doc-src">From the project’s alphabet of concepts.</p>';
    else h += '<p class="doc-src">This concept is declared in the encoding but has no entry in the project’s alphabet of concepts.</p>';
    h += '</header><div class="cmp">';
    users.forEach(function (t) {
      var segs = t.segs.filter(function (g) { return g.concepts.indexOf(sel) >= 0; });
      var gloss = (t.concepts.filter(function (c) { return c.id === sel; })[0] || {}).gloss;
      h += '<section class="cmp-col frame" id="col-' + t.id + '" aria-labelledby="h-' + t.id + '" tabindex="-1">' +
        '<h3 id="h-' + t.id + '">' + esc(t.author) + '</h3>' +
        '<div class="w">' + esc(t.title) + '</div>' +
        '<div class="m">' + W.date(t) + ' · ' + esc(W.langName(t)) + ' · ' + W.plural(segs.length, 'passage') +
        (gloss && gloss.toLowerCase() !== sel.toLowerCase() && gloss.toLowerCase() !== k.label.toLowerCase() ? ' · interp: “' + esc(gloss) + '”' : '') + '</div>';
      segs.forEach(function (g) {
        var w = words(g.text), long = w.length > LIMIT;
        var shown = long ? w.slice(0, LIMIT).join(' ') + ' …' : g.text;
        var also = g.concepts.filter(function (c) { return c !== sel; });
        var q;
        if (w.length < 30) {
          // short passage: keyword in context, from the surrounding text of the TEI body
          var b = words(g.before || '').filter(Boolean), a = words(g.after || '').filter(Boolean);
          var bt = (b.length > 14 ? '… ' : '') + b.slice(-14).join(' ').replace(/^…\s*/, '');
          var at = a.slice(0, 14).join(' ').replace(/\s*…$/, '') + (a.length > 14 ? ' …' : '');
          var sep = /^[.,;:!?)\]»”’]/.test(at) ? '' : ' ';
          q = '<blockquote class="kwic" lang="' + esc(t.lang) + '"><span class="ctx">' + esc(bt) + '</span> <span class="kw">' + esc(g.text) + '</span>' + sep + '<span class="ctx">' + esc(at) + '</span></blockquote>';
        } else {
          q = '<blockquote lang="' + esc(t.lang) + '" data-full="' + esc(g.text) + '">' + esc(shown) + '</blockquote>';
        }
        h += '<div class="psg">' + q +
          (g.en ? '<p class="psg-en" lang="en"><span class="en-l">In English</span> ' + esc(g.en) + '</p>' : '') +
          (also.length ? '<div class="also">Also tagged: ' + esc(also.map(W.label).join(', ')) + '</div>' : '') +
          '<div class="also">' + (long ? '<button type="button" class="more" aria-expanded="false">Show the whole passage (' + w.length + ' words)</button> · ' : '') +
          '<a href="texts.html?t=' + t.id + '&amp;c=' + encodeURIComponent(sel) + '#' + g.id + '">Read in context →</a></div></div>';
      });
      h += '</section>';
    });
    h += '</div>';
    if (absent.length) h += '<p class="absent">Not tagged in: ' + esc(absent.map(function (t) { return t.author; }).join(', ')) + '.</p>';
    $('compare').innerHTML = h;
    if (focusAuthor) {
      var col = $('col-' + focusAuthor);
      if (col) { col.scrollIntoView({ block: 'start' }); col.focus({ preventScroll: true }); }
    }
  }

  function select(c, focusAuthor, fromUser) {
    sel = c;
    document.querySelectorAll('#matrix tbody tr').forEach(function (tr) {
      var on = tr.getAttribute('data-c') === c;
      tr.classList.toggle('sel', on);
      tr.querySelector('.rowbtn').setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    drawCompare(focusAuthor);
    document.querySelectorAll('#ctime .ct-row').forEach(function (g) { g.classList.toggle('sel', g.getAttribute('data-c') === c); });
    try { history.replaceState(null, '', '?c=' + encodeURIComponent(c)); } catch (e) { /* ignore */ }
    if (fromUser && !focusAuthor && window.matchMedia('(max-width: 1080px)').matches) {
      $('compare').scrollIntoView({ block: 'start' });
      $('compare').focus({ preventScroll: true });
    }
  }

  // Concepts in time: one row per concept, each text at the year of its first edition on a proportional axis
  function drawTime() {
    var box = $('ctime');
    if (!box) return;
    var dated = texts.filter(function (t) { return t.firstEdition != null; });
    var undated = texts.filter(function (t) { return t.firstEdition == null; });
    var Y0 = 1540, Y1 = 1970, L = 190, R = 830, UX = 900, RH = 26, TOP = 78;
    var x = function (y) { return L + (y - Y0) / (Y1 - Y0) * (R - L); };
    function first(c) {
      var ys = dated.filter(function (t) { return C[c].counts[t.id]; }).map(function (t) { return +t.firstEdition; });
      return ys.length ? Math.min.apply(null, ys) : 9999;
    }
    var rows = ids.slice().sort(function (a, b) { return first(a) - first(b) || nAuthors(b) - nAuthors(a) || C[a].label.localeCompare(C[b].label); });
    var H = TOP + rows.length * RH + 8;
    var s = '<svg viewBox="0 0 960 ' + H + '" role="img" aria-labelledby="ct-h ct-d" class="ct-svg">';
    // century grid and year labels on the axis line; each author on her own dotted guide, named in two staggered rows above
    s += '<line class="ct-axis" x1="' + L + '" x2="' + R + '" y1="' + (TOP - 4) + '" y2="' + (TOP - 4) + '"/>';
    for (var y = 1600; y <= 1900; y += 100) {
      s += '<line class="ct-grid" x1="' + x(y) + '" x2="' + x(y) + '" y1="' + (TOP - 4) + '" y2="' + (H - 4) + '"/>';
      s += '<text class="ct-tick" x="' + x(y) + '" y="' + (TOP - 10) + '">' + y + '</text>';
    }
    dated.forEach(function (t, i) {
      var ax = x(+t.firstEdition), ly = 13 + (i % 3) * 16;
      s += '<line class="ct-guide" x1="' + ax + '" x2="' + ax + '" y1="' + (ly + 4) + '" y2="' + (H - 4) + '"/>';
      s += '<text class="ct-au" x="' + ax + '" y="' + ly + '">' + esc(t.id === 'marguerite' ? 'Navarre' : t.author.split(' ').pop()) + ' <tspan class="ct-yr">' + t.firstEdition + '</tspan></text>';
    });
    s += '<line class="ct-sep" x1="' + (UX - 34) + '" x2="' + (UX - 34) + '" y1="4" y2="' + (H - 4) + '"/>';
    undated.forEach(function (t) { s += '<text class="ct-au" x="' + UX + '" y="14">' + esc(t.author.split(' ')[0]) + ' <tspan class="ct-yr">n.d.</tspan></text>'; });
    rows.forEach(function (c, i) {
      var cy = TOP + i * RH + RH / 2, k = C[c];
      var on = dated.filter(function (t) { return k.counts[t.id]; });
      s += '<g class="ct-row' + (c === sel ? ' sel' : '') + '" data-c="' + c + '">';
      s += '<rect class="ct-hit" x="0" y="' + (cy - RH / 2) + '" width="960" height="' + RH + '"/>';
      s += '<text class="ct-lab" x="' + (L - 22) + '" y="' + (cy + 5) + '">' + esc(k.label) + '</text>';
      if (on.length > 1) s += '<line class="ct-span" x1="' + x(+on[0].firstEdition) + '" x2="' + x(+on[on.length - 1].firstEdition) + '" y1="' + cy + '" y2="' + cy + '"/>';
      on.concat(undated.filter(function (t) { return k.counts[t.id]; })).forEach(function (t) {
        var cx = t.firstEdition == null ? UX : x(+t.firstEdition);
        s += '<circle class="ct-dot" cx="' + cx.toFixed(1) + '" cy="' + cy + '" r="' + (size(k.counts[t.id]) / 2) + '" data-c="' + c + '" data-t="' + t.id + '" data-n="' + k.counts[t.id] + '"/>';
      });
      s += '</g>';
    });
    box.innerHTML = s + '</svg>';
    // the same content as a table, for screen readers and for reading the numbers
    var tb = '<table class="ct-table"><caption>Tagged passages per concept, by author in the order of first edition</caption><thead><tr><th scope="col">Concept</th><th scope="col">First appears</th><th scope="col">Authors (passages)</th></tr></thead><tbody>';
    rows.forEach(function (c) {
      var k = C[c], f = first(c);
      tb += '<tr><th scope="row">' + esc(k.label) + '</th><td>' + (f < 9999 ? f : 'only in the undated letter') + '</td><td>' +
        esc(texts.filter(function (t) { return k.counts[t.id]; }).sort(function (a, b) { return (a.firstEdition || 9999) - (b.firstEdition || 9999); })
          .map(function (t) { return t.author + ' ' + W.date(t) + ' (' + k.counts[t.id] + ')'; }).join(', ')) + '</td></tr>';
    });
    $('ctime-table').innerHTML = tb + '</tbody></table>';
  }

  drawMatrix();
  drawCompare();
  drawTime();

  var ct = $('ctime');
  ct.addEventListener('click', function (e) {
    var g = e.target.closest('.ct-row');
    if (!g) return;
    var dot = e.target.closest('.ct-dot');
    select(g.getAttribute('data-c'), dot ? dot.getAttribute('data-t') : null, false);
    drawTime();
    var target = dot ? $('col-' + dot.getAttribute('data-t')) : $('compare');
    if (target) { target.scrollIntoView({ block: 'start' }); target.focus({ preventScroll: true }); }
  });
  ct.addEventListener('mousemove', function (e) {
    var dot = e.target.closest('.ct-dot'), g = e.target.closest('.ct-row');
    if (!g) { tip.style.display = 'none'; return; }
    var c = C[g.getAttribute('data-c')];
    if (dot) {
      var t = W.text(dot.getAttribute('data-t'));
      tip.innerHTML = '<b>' + esc(c.label) + '</b> in ' + esc(t.author) + ', ' + W.date(t) + '<br>' + W.plural(+dot.getAttribute('data-n'), 'passage') + ' · click to read';
    } else {
      tip.innerHTML = '<b>' + esc(c.label) + '</b><br>' + W.plural(nAuthors(g.getAttribute('data-c')), 'author') + ' · ' + W.plural(c.passages, 'passage') + ' · click to compare';
    }
    tip.style.display = 'block';
    var px = e.clientX + 14, py = e.clientY + 14, r = tip.getBoundingClientRect();
    if (px + r.width > innerWidth - 8) px = e.clientX - r.width - 14;
    if (py + r.height > innerHeight - 8) py = e.clientY - r.height - 14;
    tip.style.left = px + 'px'; tip.style.top = py + 'px';
  });
  ct.addEventListener('mouseleave', function () { tip.style.display = 'none'; });

  $('matrix').addEventListener('click', function (e) {
    var b = e.target.closest('.rowbtn');
    if (b) { select(b.getAttribute('data-c'), null, true); return; }
    var td = e.target.closest('td.cell');
    if (td) select(td.getAttribute('data-c'), td.getAttribute('data-t'), true);
  });

  document.querySelectorAll('[data-order]').forEach(function (b) {
    b.addEventListener('click', function () {
      order = b.getAttribute('data-order');
      document.querySelectorAll('[data-order]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      drawMatrix();
    });
  });

  $('compare').addEventListener('click', function (e) {
    var b = e.target.closest('.more');
    if (!b) return;
    var q = b.closest('.psg').querySelector('blockquote');
    q.textContent = q.getAttribute('data-full');
    b.setAttribute('aria-expanded', 'true');
    b.remove();
  });

  // hover tooltip + column highlight
  var tip = $('tip');
  var lastCol = null;
  function colHL(tid) {
    if (tid === lastCol) return;
    document.querySelectorAll('#matrix .col-hl').forEach(function (x) { x.classList.remove('col-hl'); });
    if (tid) document.querySelectorAll('#matrix td[data-t="' + tid + '"]').forEach(function (x) { x.classList.add('col-hl'); });
    lastCol = tid;
  }
  $('matrix').addEventListener('mousemove', function (e) {
    var td = e.target.closest('td[data-t]');
    if (!td) { tip.style.display = 'none'; colHL(null); return; }
    var t = W.text(td.getAttribute('data-t')), c = C[td.getAttribute('data-c')];
    var n = +td.getAttribute('data-n');
    tip.innerHTML = '<b>' + esc(c.label) + '</b> in ' + esc(t.author) + '<br>' +
      (n ? W.plural(n, 'passage') + ' · click to read' : (td.getAttribute('data-d') === '1' ? 'Declared, no passage tagged' : 'Not used'));
    tip.style.display = 'block';
    var x = e.clientX + 14, y = e.clientY + 14;
    var r = tip.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    colHL(td.getAttribute('data-t'));
  });
  $('matrix').addEventListener('mouseleave', function () { tip.style.display = 'none'; colHL(null); });
})();
