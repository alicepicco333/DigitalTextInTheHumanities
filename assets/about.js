/* About page: alphabet of concepts, encoders, encoding notes and on-demand diagrams. */
(function () {
  'use strict';
  var W = window.WG, D = W.data, esc = W.esc;
  var $ = function (id) { return document.getElementById(id); };

  // alphabet
  var ids = Object.keys(D.concepts).sort(function (a, b) { return D.concepts[a].label.localeCompare(D.concepts[b].label); });
  $('alpha').innerHTML = ids.map(function (c) {
    var k = D.concepts[c], n = Object.keys(k.counts).length;
    return '<div id="c-' + esc(c) + '"><h4><span>' + esc(k.label) + '</span><a href="concepts.html?c=' + encodeURIComponent(c) + '">' +
      W.plural(k.passages, 'passage') + ', ' + W.plural(n, 'author') + ' →</a></h4>' +
      '<p>' + (k.doc ? esc(k.doc) : '<i>Added during encoding (Simone de Beauvoir); not described in the original documentation.</i>') + '</p></div>';
  }).join('');

  // working tag list (lista_tag.txt)
  var LIST = ['anti-model', 'beauty', 'bitch', 'body', 'education', 'foodOrFoodAbst', 'grace', 'honour', 'intellect', 'marriage', 'mother', 'rights', 'society', 'sorority', 'strength', 'virginity', 'weakness', 'witch', 'lover', 'gender', 'modesty', 'war', 'irony'];
  $('taglist').innerHTML = LIST.map(function (t) { return '<code>' + esc(t) + '</code>'; }).join(' ');

  // encoders
  var rows = '<thead><tr><th scope="col">Text</th><th scope="col">Encoded by</th><th scope="col" class="n">Segments</th><th scope="col" class="n hide-s">Concepts</th></tr></thead><tbody>';
  D.texts.forEach(function (t) {
    rows += '<tr><td><a href="texts.html?t=' + t.id + '">' + esc(t.author) + '</a>, <i>' + esc(t.title) + '</i></td><td>' + esc(t.encoder) +
      '</td><td class="n">' + t.segs.length + '</td><td class="n hide-s">' + t.concepts.length + '</td></tr>';
  });
  $('encoders').innerHTML = rows + '</tbody>';

  // team, from the TEI respStmt
  var team = {};
  D.texts.forEach(function (t) { (team[t.encoder] = team[t.encoder] || []).push(t.author); });
  $('team').innerHTML = Object.keys(team).map(function (n) {
    return '<div class="frame"><b>' + esc(n) + '</b><span>Encoded ' + esc(team[n].join(' and ')) + '</span></div>';
  }).join('');

  // portrait credits
  $('pcredits').innerHTML = D.texts.map(function (t) {
    var p = t.portrait; if (!p) return '';
    var lic = p.licenceUrl ? '<a href="' + esc(p.licenceUrl) + '">' + esc(p.licence) + '</a>' : esc(p.licence);
    return '<li><b>' + esc(t.author) + '</b>: ' + esc(p.artist || 'Unknown') + (p.date ? ', ' + esc(p.date) : '') + '. ' + lic +
      '. <a href="' + esc(p.source) + '">Wikimedia Commons</a>' + (p.note ? '. ' + esc(p.note) : '') + (p.licence.indexOf('BY-SA') >= 0 ? ' Converted to black and white; shared under the same licence.' : '') + '</li>';
  }).join('');

  // notes
  $('notes').innerHTML = D.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');

  // diagrams.net viewer, loaded only on request
  var viewer = null;
  function loadViewer() {
    if (viewer) return viewer;
    viewer = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://viewer.diagrams.net/js/viewer-static.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return viewer;
  }
  document.querySelectorAll('[data-load]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var fig = $(btn.getAttribute('data-load'));
      var box = fig.querySelector('.dg');
      btn.disabled = true; btn.textContent = 'Loading…';
      Promise.all([fetch(box.getAttribute('data-src')).then(function (r) { return r.text(); }), loadViewer()])
        .then(function (res) {
          var div = document.createElement('div');
          div.className = 'mxgraph';
          div.style.maxWidth = '100%';
          div.setAttribute('data-mxgraph', JSON.stringify({ highlight: '#2d5fa8', nav: true, resize: true, toolbar: 'zoom layers lightbox', xml: res[0] }));
          box.appendChild(div);
          window.GraphViewer.processElements();
          btn.remove();
        })
        .catch(function () { btn.disabled = false; btn.textContent = 'Could not load the viewer. Try again'; });
    });
  });
})();
