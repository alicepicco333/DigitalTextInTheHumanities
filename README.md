# Words of Gender

The prototype of an archive of women authors. Project repository for the course
Digital Text in the Humanities (prof. Tiziana Mancinelli), MA Digital Humanities
and Digital Knowledge, University of Bologna, 2023.

Nine excerpts by women authors, encoded in TEI P5 (`MarkedTexts/`) with concept
segments (`<seg ana>`), `<interpGrp>` concept declarations and linked open data
(VIAF, Wikidata, WorldCat) in `<xenoData>`.

## Site

- `index.html`: contents and timeline of first editions and transcribed editions
- `texts.html?t=<id>&c=<concept,...>`: reading view with switchable concept highlights
- `concepts.html?c=<concept>`: author x concept matrix and passages side by side
- `about.html`: context, research question, methodology, alphabet of concepts, bibliography, team

The site is static. Everything it shows is generated from the TEI files:

```
python tools/build_archive.py   # MarkedTexts/*.xml -> data/archive.js
python tools/build_pages.py     # tools/pages/*.html -> *.html (shared head, masthead, footer)
python -m http.server           # then open http://localhost:8000
```

The original XSLT of the project is kept in `WordsofGender/template.xsl`.
