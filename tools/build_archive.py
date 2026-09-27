"""Build data/archive.js from the TEI files in MarkedTexts/.

Run from the repository root:   python tools/build_archive.py

Everything on the site (reading views, concept matrix, comparisons, timeline)
is generated from the TEI encoding by this script; nothing is typed in by hand
except the display labels in CONCEPT_LABELS and the handful of documented
normalisations listed in NOTES (each one explains what the TEI says).
"""
import glob
import html
import json
import os
import re
import xml.etree.ElementTree as ET

T = '{http://www.tei-c.org/ns/1.0}'
XML = '{http://www.w3.org/XML/1998/namespace}'
RDF = '{http://www.w3.org/1999/02/22-rdf-syntax-ns#}'
DC = '{http://purl.org/dc/elements/1.1/}'

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Stable slugs for URLs, keyed by file name.
SLUGS = {
    'ChiaradAssisi.xml': 'chiara',
    'FINALMargueriteAnguleme.xml': 'marguerite',
    'Veronica Franco.xml': 'franco',
    'Madame de Lambert.xml': 'lambert',
    'MaryWollstonecraft.xml': 'wollstonecraft',
    'FINALGeorgeSand.xml': 'sand',
    'Ada Negri.xml': 'negri',
    'androgyne.xml': 'cahun',
    'deBeauvoir.xml': 'beauvoir',
}

# The one text written in verse: its line breaks in the TEI are the verse lines.
VERSE = {'franco'}

# Display labels for the @xml:id of each <interp>. Spellings follow the
# project's own "alphabet of concepts" (e.g. xml:id "uglyness" -> "Ugliness").
CONCEPT_LABELS = {
    'foodOrFoodAbst': 'Food (abstinence)',
    'uglyness': 'Ugliness',
}

# Documented normalisations of the encoding (shown on the About page).
NOTES = [
    'In androgyne.xml four @ana values lack the leading "#" (ana="beauty"); they are read as pointers to the declared interp.',
    'Madame de Lambert.xml declares the concept "beauty" in its interpGrp but tags no segment with it; the matrix shows it as declared but unused.',
    'The Wikidata links in FINALGeorgeSand.xml and FINALMargueriteAnguleme.xml omit "/wiki/" and are linked in their working form.',
    'androgyne.xml gives dc:date 1898 in its RDF block; the first edition encoded in its sourceDesc is 1930, which the timeline uses.',
    'The availability link in androgyne.xml points to the Internet Archive copy of La Petite Fadette, so it is not shown for Cahun.',
    'ChiaradAssisi.xml records only the 2008 edition it was transcribed from; the date of the letter itself is not encoded, so the timeline leaves it undated.',
    'Veronica Franco.xml gives the date 1575 but no publisher or place for the source.',
]


def norm(s):
    return re.sub(r'\s+', ' ', s or '').strip()


def text(e):
    return norm(''.join(e.itertext())) if e is not None else ''


def year(e):
    """Year from @when (falling back to the text) of a <date>."""
    if e is None:
        return None
    w = (e.get('when') or text(e) or '').strip()
    m = re.match(r'-?\d{3,4}', w)
    return int(m.group(0)) if m else None


def label_for(cid):
    if cid in CONCEPT_LABELS:
        return CONCEPT_LABELS[cid]
    return re.sub(r'(?<!^)(?=[A-Z])', ' ', cid).capitalize()


class Renderer:
    """TEI <body> -> HTML fragment. Mirrors the project's template.xsl:
    <seg @ana> becomes a span classed by concept, <persName @ref> a span
    carrying the person id."""

    def __init__(self, slug, verse):
        self.slug = slug
        self.verse = verse
        self.segs = []
        self.seen_ids = set()

    def txt(self, s):
        if s is None:
            return ''
        if self.verse:
            # keep verse line breaks, drop the indentation of the XML file
            s = re.sub(r'[ \t]*\n[ \t]*', '\n', s)
            s = re.sub(r'[ \t]+', ' ', s)
        else:
            s = re.sub(r'\s+', ' ', s)
        return html.escape(s, quote=False)

    def seg_text(self, e):
        t = ''.join(e.itertext())
        if self.verse:
            lines = [norm(l) for l in t.split('\n')]
            return ' / '.join(l for l in lines if l)
        return norm(t)

    def render(self, e, depth=0):
        tag = e.tag.replace(T, '')
        inner = self.txt(e.text) + ''.join(self.render(c, depth + 1) + self.txt(c.tail) for c in e)
        if tag == 'body':
            return inner
        if tag == 'p':
            inner = inner.strip()
            cls = ' class="verse"' if self.verse else ''
            return f'<p{cls}>{inner}</p>'
        if tag == 'seg':
            cids = [a.lstrip('#') for a in (e.get('ana') or '').split() if a.strip()]
            xid = e.get(XML + 'id') or f's{len(self.segs) + 1}'
            dom_id = f'{self.slug}-{xid}'.replace('.', '-')
            while dom_id in self.seen_ids:
                dom_id += 'x'
            self.seen_ids.add(dom_id)
            self.segs.append({'id': dom_id, 'xmlId': xid, 'concepts': cids, 'text': self.seg_text(e)})
            data = ' '.join(cids)
            return f'<span class="seg" id="{dom_id}" data-c="{data}">{inner}</span>'
        if tag == 'persName':
            ref = (e.get('ref') or '').lstrip('#')
            attr = f' data-p="{html.escape(ref)}"' if ref else ''
            return f'<span class="pers"{attr}>{inner}</span>'
        if tag == 'roleName':
            return f'<span class="role">{inner}</span>'
        if tag == 'placeName':
            return f'<span class="place">{inner}</span>'
        if tag == 'title':
            return f'<span class="inhead">{inner.strip()}</span>'
        return inner


def fix_uri(u):
    return re.sub(r'^https://www\.wikidata\.org/(Q\d+)$', r'https://www.wikidata.org/wiki/\1', u)


def build_text(path):
    fname = os.path.basename(path)
    slug = SLUGS[fname]
    root = ET.parse(path).getroot()
    h = root.find(T + 'teiHeader')
    fd = h.find(T + 'fileDesc')

    ed_title = text(fd.find(f'{T}titleStmt/{T}title'))
    title = re.sub(r'\s*[.\-–]\s*A digital edition\s*$', '', ed_title, flags=re.I)
    bf = fd.find(f'{T}sourceDesc/{T}biblFull')
    bf_title = text(bf.find(f'{T}titleStmt/{T}title'))
    bf_author = text(bf.find(f'{T}titleStmt/{T}author'))
    top_author = text(fd.find(f'{T}titleStmt/{T}author'))
    editor = text(bf.find(f'{T}titleStmt/{T}editor'))
    first = bf.find(f'{T}editionStmt/{T}edition/{T}date')
    pub = bf.find(f'{T}publicationStmt')
    # A nested biblFull (Marguerite: the Heptaméron volume) is the container
    container = None
    nested = bf.find(f'.//{T}sourceDesc/{T}biblFull')
    if nested is not None:
        container = text(nested.find(f'{T}titleStmt/{T}title')).rstrip('. ')
    src_bibl = bf.find(f'.//{T}sourceDesc/{T}bibl')
    if src_bibl is not None:
        container = text(src_bibl)
    avail = pub.find(f'{T}availability')
    source_url = avail.get('source') if avail is not None else None
    if slug == 'cahun':
        source_url = None  # see NOTES: link belongs to La Petite Fadette
    licence = text(avail.find(f'{T}licence')) if avail is not None and avail.find(f'{T}licence') is not None else ''

    src_date_el = pub.find(f'{T}date')
    src_year = None
    if src_date_el is not None:
        m = re.search(r'\d{4}', text(src_date_el))  # Wollstonecraft: when="1792" but text 1794
        src_year = int(m.group(0)) if m else year(src_date_el)

    lang_el = h.find(f'.//{T}langUsage/{T}language')
    resp = fd.find(f'{T}titleStmt/{T}respStmt/{T}name')

    dc_title = dc_creator = None
    lod_work, lod_author = [], []
    desc = h.find(f'.//{RDF}Description')
    if desc is not None:
        last = None
        for c in desc:
            if c.tag == DC + 'title':
                dc_title, last = text(c), 'work'
            elif c.tag == DC + 'creator':
                dc_creator, last = text(c), 'author'
            elif c.tag.endswith('sameAs'):
                u = fix_uri(c.get(RDF + 'resource'))
                (lod_work if last == 'work' else lod_author).append(u)

    concepts = []
    front = root.find(f'{T}text/{T}front')
    interp_resp = None
    for ig in front.iter(T + 'interpGrp'):
        interp_resp = (ig.get('resp') or '').lstrip('#')
        for i in ig.iter(T + 'interp'):
            concepts.append({'id': i.get(XML + 'id'), 'gloss': text(i)})

    persons = []
    for p in h.iter(T + 'person'):
        persons.append({'id': p.get(XML + 'id'), 'name': text(p.find(T + 'persName'))})

    r = Renderer(slug, slug in VERSE)
    body = root.find(f'{T}text/{T}body')
    body_html = r.render(body).strip()
    words = len(text(body).split())

    dc_date_el = desc.find(DC + 'date') if desc is not None else None
    first_year, date_basis = year(first), 'editionStmt'
    if first_year is None and dc_date_el is not None:
        first_year, date_basis = year(dc_date_el), 'dc:date'
    if first_year is None:
        date_basis = None

    author = dc_creator or bf_author or top_author
    if slug == 'lambert':
        author = 'Madame de Lambert'
    return {
        'id': slug,
        'file': 'MarkedTexts/' + fname,
        'author': author,
        'authorFull': top_author if top_author != author else None,
        'title': title,
        'workTitle': bf_title if bf_title and bf_title != title else None,
        'container': container,
        'lang': lang_el.get('ident') if lang_el is not None else None,
        'langName': text(lang_el) if lang_el is not None else None,
        'firstEdition': first_year,
        'dateBasis': date_basis,
        'source': {
            'year': src_year,
            'place': text(pub.find(f'{T}pubPlace')) or None,
            'publisher': (text(pub.find(f'{T}publisher')).rstrip(' &') or None),
            'editor': editor or None,
            'url': source_url,
            'licence': licence or None,
        },
        'encoder': text(resp) if resp is not None else None,
        'interpResp': interp_resp,
        'lod': {'work': lod_work, 'author': lod_author},
        'verse': slug in VERSE,
        'words': words,
        'concepts': concepts,
        'persons': persons,
        'segs': r.segs,
        'html': body_html,
    }


def main():
    texts = [build_text(p) for p in sorted(glob.glob(os.path.join(ROOT, 'MarkedTexts', '*.xml')))]
    # chronological by encoded first edition; undated texts last
    texts.sort(key=lambda t: (t['firstEdition'] is None, t['firstEdition'] or 0))
    concept_ids = []
    for t in texts:
        for c in t['concepts']:
            if c['id'] not in concept_ids:
                concept_ids.append(c['id'])
        for s in t['segs']:
            for c in s['concepts']:
                if c not in concept_ids:
                    concept_ids.append(c)
    concepts = {}
    for cid in concept_ids:
        used = {t['id']: sum(cid in s['concepts'] for s in t['segs']) for t in texts}
        declared = [t['id'] for t in texts if any(c['id'] == cid for c in t['concepts'])]
        concepts[cid] = {
            'id': cid,
            'label': label_for(cid),
            'counts': {k: v for k, v in used.items() if v},
            'declared': declared,
            'passages': sum(used.values()),
        }
    with open(os.path.join(ROOT, 'data', 'concepts-doc.json'), encoding='utf-8') as f:
        docs = json.load(f)
    for cid, c in concepts.items():
        c['doc'] = docs.get(cid)
    out = {
        'generated': 'tools/build_archive.py',
        'texts': texts,
        'concepts': concepts,
        'notes': NOTES,
    }
    js = '/* Generated by tools/build_archive.py from MarkedTexts/*.xml - do not edit by hand. */\n'
    js += 'window.WOG = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n'
    with open(os.path.join(ROOT, 'data', 'archive.js'), 'w', encoding='utf-8') as f:
        f.write(js)
    n_segs = sum(len(t['segs']) for t in texts)
    used = [c for c in concepts.values() if c['passages']]
    print(f'{len(texts)} texts, {len(concepts)} concepts declared ({len(used)} tagged), {n_segs} segments')
    for t in texts:
        print(f"  {t['firstEdition']} {t['author']}: {t['title']} ({len(t['segs'])} segs, {len(t['concepts'])} concepts)")


if __name__ == '__main__':
    main()
