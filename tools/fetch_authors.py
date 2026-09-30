"""Fetch each author's life dates and birthplace from Wikidata, by the VIAF identifier in her TEI file.

Run from the repository root (needs the network; the result is committed, so the site build does not):

    python tools/fetch_authors.py

Writes data/authors.json: {slug: {qid, viaf, born, died, birthplace, deathplace, source}}. Years only;
where Wikidata gives a circa or century-precision date, "approx" is set.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import build_archive as B  # noqa: E402

UA = 'WordsOfGender/2026 (https://github.com/alicepicco333/DigitalTextInTheHumanities)'


def sparql(q):
    url = 'https://query.wikidata.org/sparql?format=json&query=' + urllib.parse.quote(q)
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/sparql-results+json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)['results']['bindings']


def main():
    import glob
    texts = [B.build_text(p) for p in sorted(glob.glob(os.path.join(ROOT, 'MarkedTexts', '*.xml')))]
    viaf = {}
    for t in texts:
        for u in t['lod']['author']:
            m = re.search(r'viaf\.org/viaf/(\d+)', u)
            if m:
                viaf[t['id']] = m.group(1)
    values = ' '.join(f'"{v}"' for v in viaf.values())
    rows = sparql(f'''
SELECT ?viaf ?item ?born ?bornPrec ?died ?diedPrec ?bpLabel ?dpLabel WHERE {{
  VALUES ?viaf {{ {values} }}
  ?item wdt:P214 ?viaf .
  # best-ranked statements only: Wikidata keeps deprecated values (e.g. a wrong death year for Cahun)
  OPTIONAL {{ ?item p:P569 ?bs . ?bs a wikibase:BestRank ; psv:P569 [ wikibase:timeValue ?born ; wikibase:timePrecision ?bornPrec ] }}
  OPTIONAL {{ ?item p:P570 ?ds . ?ds a wikibase:BestRank ; psv:P570 [ wikibase:timeValue ?died ; wikibase:timePrecision ?diedPrec ] }}
  OPTIONAL {{ ?item wdt:P19 ?bp }}
  OPTIONAL {{ ?item wdt:P20 ?dp }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
}}''')
    out = {}
    by_viaf = {v: k for k, v in viaf.items()}
    for r in rows:
        slug = by_viaf.get(r['viaf']['value'])
        if not slug or slug in out:
            continue
        yr = lambda key: int(re.match(r'-?\d+', r[key]['value']).group(0)) if key in r else None
        prec = lambda key: int(r[key]['value']) if key in r else None
        out[slug] = {
            'qid': r['item']['value'].rsplit('/', 1)[-1],
            'viaf': r['viaf']['value'],
            'born': yr('born'), 'died': yr('died'),
            'approx': any(p is not None and p < 9 for p in (prec('bornPrec'), prec('diedPrec'))),
            'birthplace': r.get('bpLabel', {}).get('value'),
            'deathplace': r.get('dpLabel', {}).get('value'),
            'source': 'Wikidata, matched by VIAF',
        }
    missing = [s for s in viaf if s not in out]
    path = os.path.join(ROOT, 'data', 'authors.json')
    if os.path.exists(path):  # keep what other steps added (the portrait credits of tools/fetch_portraits.py)
        with open(path, encoding='utf-8') as f:
            old = json.load(f)
        for slug, a in out.items():
            for k, v in old.get(slug, {}).items():
                a.setdefault(k, v)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for s, a in out.items():
        print(f"{s:15s} {a['qid']:10s} {a['born']}-{a['died']}{' (approx)' if a['approx'] else ''}  {a['birthplace']} / {a['deathplace']}")
    if missing:
        print('no Wikidata item found for:', ', '.join(missing))


if __name__ == '__main__':
    main()
