/* Search: every occurrence of a word across the nine texts (and their English translations), with the concept
   each hit is tagged with; and the tagging check computed by tools/build_archive.py. */
(function () {
  'use strict';
  var W = window.WG, D = W.data, esc = W.esc;
  var $ = function (id) { return document.getElementById(id); };
  var MAXHITS = 300;

  // lower case, accents removed, one character for one character (the same folding as the build script)
  function fold(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      out += (c === 'œ' || c === 'æ' || c === 'Œ' || c === 'Æ') ? c.toLowerCase() : c.normalize('NFD')[0].toLowerCase();
    }
    return out;
  }

  // the plain text of each rendered TEI body, with the passage (seg) under every stretch of it
  var index = D.texts.map(function (t) {
    var div = document.createElement('div');
    div.innerHTML = t.html;
    var full = '', runs = [];
    (function walk(n) {
      if (n.nodeType === 3) {
        var segs = [], e = n.parentNode;
        while (e && e !== div) { if (e.classList && e.classList.contains('seg')) segs.push(e.id); e = e.parentNode; }
        runs.push([full.length, full.length + n.nodeValue.length, segs]);
        full += n.nodeValue;
      } else if (n.nodeType === 1) {
        var block = /^(P|L|LG|DIV|H\d|BR|LI)$/.test(n.nodeName);
        for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
        if (block) full += ' ';
      }
    })(div);
    var segById = {};
    t.segs.forEach(function (g) { segById[g.id] = g; });
    return { t: t, full: full, folded: fold(full), runs: runs, segById: segById };
  });

  function segsAt(ix, a) {
    for (var i = 0; i < ix.runs.length; i++) if (ix.runs[i][0] <= a && a < ix.runs[i][1]) return ix.runs[i][2];
    return [];
  }
  function clip(s, n, fromEnd) {
    s = s.replace(/\s+/g, ' ');
    if (s.length <= n) return s;
    return fromEnd ? '… ' + s.slice(s.length - n).replace(/^\S*\s/, '') : s.slice(0, n).replace(/\s\S*$/, '') + ' …';
  }
  function rxFor(q, whole) {
    var f = fold(q.trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp((whole ? '(?<![\\p{L}\\p{N}])' : '') + f + (whole ? '(?![\\p{L}\\p{N}])' : ''), 'gu');
  }
  function conceptLine(ids) {
    var cs = [];
    ids.forEach(function (id) { (this[id] || { concepts: [] }).concepts.forEach(function (c) { if (cs.indexOf(c) < 0) cs.push(c); }); }, this);
    return cs;
  }

  function run() {
    var q = $('q').value, whole = $('whole').checked, inEn = $('in-en').checked;
    var out = $('results'), sum = $('sum');
    try { history.replaceState(null, '', q.trim() ? '?q=' + encodeURIComponent(q.trim()) : location.pathname); } catch (e) { /* ignore */ }
    if (fold(q.trim()).length < 2) { out.innerHTML = ''; sum.textContent = 'Type at least two letters.'; return; }
    var rx = rxFor(q, whole), groups = [], total = 0, tagged = 0;
    index.forEach(function (ix) {
      var hits = [], m;
      rx.lastIndex = 0;
      while ((m = rx.exec(ix.folded)) && total < MAXHITS) {
        var a = m.index, b = a + m[0].length, segs = segsAt(ix, a);
        var cs = conceptLine.call(ix.segById, segs);
        var en = segs.length && ix.t.lang !== 'en' ? (ix.segById[segs[segs.length - 1]] || {}).en : null;
        hits.push({ where: 'text', before: clip(ix.full.slice(Math.max(0, a - 90), a), 70, true), word: ix.full.slice(a, b), after: clip(ix.full.slice(b, b + 90), 70), seg: segs[segs.length - 1], concepts: cs, en: en });
        total++; if (cs.length) tagged++;
        if (!m[0].length) rx.lastIndex++;
      }
      if (inEn && ix.t.lang !== 'en') {
        ix.t.segs.forEach(function (g) {
          if (!g.en || total >= MAXHITS) return;
          var fe = fold(g.en), mm;
          rx.lastIndex = 0;
          while ((mm = rx.exec(fe)) && total < MAXHITS) {
            var a2 = mm.index, b2 = a2 + mm[0].length;
            hits.push({ where: 'en', before: clip(g.en.slice(Math.max(0, a2 - 90), a2), 70, true), word: g.en.slice(a2, b2), after: clip(g.en.slice(b2, b2 + 90), 70), seg: g.id, concepts: g.concepts, orig: g.text });
            total++; tagged++;
            if (!mm[0].length) rx.lastIndex++;
          }
        });
      }
      if (hits.length) groups.push({ t: ix.t, hits: hits });
    });
    sum.textContent = total ? (total >= MAXHITS ? 'The first ' + MAXHITS + ' matches' : W.plural(total, 'match', 'matches')) + ' in ' + W.plural(groups.length, 'text') +
      ' · ' + tagged + ' inside a tagged passage' : 'No match. The search ignores case and accents; try a shorter form of the word, or switch off “whole words”.';
    out.innerHTML = groups.map(function (gr) {
      var t = gr.t;
      return '<section class="sr-group" aria-labelledby="sr-' + t.id + '"><h2 id="sr-' + t.id + '">' + esc(t.author) + ' <span>' + esc(t.title) + ' · ' + W.date(t) + ' · ' + esc(W.langName(t)) + ' · ' + W.plural(gr.hits.length, 'match', 'matches') + '</span></h2><ol>' +
        gr.hits.map(function (h) {
          var href = 'texts.html?t=' + t.id + (h.concepts.length ? '&amp;c=' + encodeURIComponent(h.concepts[0]) : '') + (h.seg ? '#' + h.seg : '');
          return '<li class="sr-hit' + (h.concepts.length ? ' tagged' : '') + '">' +
            '<p class="kl"' + (h.where === 'en' ? ' lang="en"' : ' lang="' + esc(t.lang) + '"') + '>' + (h.where === 'en' ? '<span class="en-l">In the English translation</span> ' : '') +
            '<span class="ctx">' + esc(h.before) + '</span><mark>' + esc(h.word) + '</mark><span class="ctx">' + esc(h.after) + '</span></p>' +
            (h.orig ? '<p class="sr-orig" lang="' + esc(t.lang) + '">' + esc(clip(h.orig, 180)) + '</p>' : '') +
            (h.en ? '<p class="sr-en" lang="en"><span class="en-l">In English</span> ' + esc(clip(h.en, 220)) + '</p>' : '') +
            '<p class="sr-meta">' + (h.concepts.length ? 'Tagged <b>' + esc(h.concepts.map(W.label).join(' + ')) + '</b>' : '<span class="untag">Not inside a tagged passage</span>') +
            ' · <a href="' + href + '">Read in context →</a></p></li>';
        }).join('') + '</ol></section>';
    }).join('');
  }

  var timer;
  $('q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 180); });
  $('whole').addEventListener('change', run);
  $('in-en').addEventListener('change', run);
  $('sf').addEventListener('submit', function (e) { e.preventDefault(); run(); });
  document.querySelectorAll('.chip[data-q]').forEach(function (b) {
    b.addEventListener('click', function () { $('q').value = b.getAttribute('data-q'); run(); $('q').focus(); });
  });
  var q0 = new URLSearchParams(location.search).get('q');
  if (q0) { $('q').value = q0; run(); }

  // the tagging check: how often the words for a concept occur, and how many of those occurrences are tagged
  var LANGS = { fr: 'French', it: 'Italian', en: 'English' };
  var rows = Object.keys(D.concepts).filter(function (c) { return D.concepts[c].check; }).sort(function (a, b) {
    var x = D.concepts[a].check, y = D.concepts[b].check;
    return y.total - x.total || D.concepts[a].label.localeCompare(D.concepts[b].label);
  });
  var h = '<caption>Word occurrences for ' + rows.length + ' concepts that are named by a word. Gender, society and counter-stereotype are argued rather than named and are left out.</caption>' +
    '<thead><tr><th scope="col">Concept</th><th scope="col">Words looked for</th><th scope="col" class="n">Occurrences</th><th scope="col" class="n">Tagged</th><th scope="col" class="bar-h"><span class="sr-only">Share tagged</span></th><th scope="col" class="n">Tagged passages without the word</th></tr></thead><tbody>';
  rows.forEach(function (c) {
    var k = D.concepts[c].check, share = k.total ? k.tagged / k.total : 0;
    var pats = Object.keys(k.pattern).map(function (l) { return '<span class="lg">' + LANGS[l] + '</span> <span class="mono">' + esc(k.pattern[l].replace(/\\b/g, '').replace(/\(\?:/g, '(')) + '</span>'; }).join('<br>');
    var ex = k.examples.map(function (e) {
      var t = W.text(e.t);
      return '<li lang="' + esc(t.lang) + '"><span class="au">' + esc(t.author) + '</span> <span class="ctx">' + esc(e.before) + '</span> <mark>' + esc(e.word) + '</mark> <span class="ctx">' + esc(e.after) + '</span>' +
        '<span class="wh">' + (e.where === 'other' ? 'inside a passage tagged ' + esc(e.others.map(W.label).join(' + ')) : 'outside any tagged passage') + '</span></li>';
    }).join('');
    h += '<tr><th scope="row"><a href="concepts.html?c=' + encodeURIComponent(c) + '">' + esc(D.concepts[c].label) + '</a></th><td class="pat">' + pats + '</td>' +
      '<td class="n">' + k.total + '</td><td class="n">' + k.tagged + '</td>' +
      '<td class="bar"><span class="track-b"><span style="width:' + (share * 100).toFixed(1) + '%"></span></span><span class="pc">' + Math.round(share * 100) + '%</span></td>' +
      '<td class="n">' + k.passagesWithoutWord + ' of ' + k.passages + '</td></tr>';
    if (k.examples.length) {
      h += '<tr class="ex-row"><td colspan="6"><details><summary>' + (k.untaggedAll > k.examples.length ? 'The first ' + k.examples.length + ' of ' + k.untaggedAll : 'The ' + W.plural(k.untaggedAll, 'occurrence')) + ' not tagged ' + esc(D.concepts[c].label) + '</summary><ol class="ex">' + ex + '</ol></details></td></tr>';
    }
  });
  $('check').innerHTML = h + '</tbody>';
})();
