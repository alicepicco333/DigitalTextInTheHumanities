"""Build data/archive.js from the TEI files in MarkedTexts/.

Run from the repository root:   python tools/build_archive.py

Everything on the site (reading views, concept matrix, comparisons, timeline)
is generated from the TEI encoding by this script; nothing is typed in by hand
except the display labels in CONCEPT_LABELS and the handful of documented
normalisations listed in NOTES (each one explains what the TEI says).

Three files beside the TEI are merged in, each documented where it is made:
  data/translations.json  working English translations of the tagged passages (2026)
  data/authors.json       life dates and places from Wikidata (tools/fetch_authors.py)
  KEYWORDS below          the words that stand for each concept, for the tagging check
  data/tagging_review.json  the occurrences of those words deliberately left untagged, and why

Passages tagged in 2026 carry resp="#ed2026" in the TEI and are marked 'added' in the output.
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
    'In deBeauvoir.xml several persName/@ref values keep the space of the name (ref="#Colette Yver") while the listPerson ids do not (ColetteYver); names are marked in the text either way.',
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
        self.plain = []  # running plain text, for keyword-in-context

    def txt(self, s):
        if s is None:
            return ''
        self.plain.append(s)
        if self.verse:
            # keep verse line breaks, drop the indentation of the XML file
            s = re.sub(r'[ \t]*\n[ \t]*', '\n', s)
            s = re.sub(r'[ \t]+', ' ', s)
        else:
            s = re.sub(r'\s+', ' ', s)
        return html.escape(s, quote=False)

    def flat(self, s):
        if self.verse:
            return ' / '.join(norm(l) for l in s.split(chr(10)) if norm(l))
        return norm(s)

    def add_context(self, n=24):
        full = ''.join(self.plain)
        self.spans = []
        for g in self.segs:
            a, b = g.pop('_span')
            self.spans.append((a, b, g['concepts'], g['id'], bool(g.get('added'))))
            before = self.flat(full[:a]).split(' ')
            after = self.flat(full[b:]).split(' ')
            before = [w for w in before if w]
            after = [w for w in after if w]
            g['before'] = ('… ' if len(before) > n else '') + ' '.join(before[-n:])
            g['after'] = ' '.join(after[:n]) + (' …' if len(after) > n else '')

    def seg_text(self, e):
        t = ''.join(e.itertext())
        if self.verse:
            lines = [norm(l) for l in t.split('\n')]
            return ' / '.join(l for l in lines if l)
        return norm(t)

    def pos(self):
        return sum(len(x) for x in self.plain)

    def render(self, e, depth=0):
        tag = e.tag.replace(T, '')
        start = self.pos()
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
            added = e.get('resp') == '#ed2026'
            self.segs.append({'id': dom_id, 'xmlId': xid, 'concepts': cids, 'text': self.seg_text(e),
                              'xml': tei_source(e), '_span': (start, self.pos())})
            if added:
                self.segs[-1]['added'] = True
            data = ' '.join(cids)
            cls = 'seg added' if added else 'seg'
            return f'<span class="{cls}" id="{dom_id}" data-c="{data}">{inner}</span>'
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


ET.register_namespace('', T.strip('{}'))


def tei_source(e):
    """The <seg> element as it is written in the TEI file (namespace declaration and tail dropped)."""
    tail, e.tail = e.tail, None
    x = ET.tostring(e, encoding='unicode')
    e.tail = tail
    x = re.sub(r' xmlns(:\w+)?="[^"]+"', '', x)
    return x.strip()


# The words that stand for each concept, per language of the archive (stems matched at the start of a word,
# case- and accent-insensitive; each list is applied only to the texts in its language, so that the English
# "mere" is not read as the French "mère"). The tagging check counts how often they occur and how many of those
# occurrences the encoders tagged. Concepts that are argued rather than named in one word are left out.
KEYWORDS = {
    'beauty': {'fr': r'beaut|belles?\b|beaux?\b|bel\b', 'it': r'bellezz|bellissim|bell[aoie]\b|bel\b', 'en': r'beaut'},
    'grace': {'fr': r'grâce|grace|gracieu', 'it': r'grazi', 'en': r'grace'},
    'honour': {'fr': r'honneur', 'it': r'onor', 'en': r'hono'},
    'body': {'fr': r'corps\b|corporel', 'it': r'corp[oi]\b|corpore|corporal', 'en': r'body|bodies|corporal'},
    'mother': {'fr': r'mères?\b|matern', 'it': r'madr[ei]\b|matern', 'en': r'mother|matern'},
    'marriage': {'fr': r'mari(?:er|age|é|ée|ées|és|erai|erez|era|s)?\b|épous', 'it': r'spos[aeio]\b|sposar|matrimon|nozze', 'en': r'marri|husband|wedlock'},
    'sorority': {'fr': r'sœurs?\b|soeurs?\b', 'it': r'sorell', 'en': r'sisters?\b|sisterhood'},
    'witch': {'fr': r'sorci', 'it': r'streg', 'en': r'witch'},
    'virginity': {'fr': r'vierge|virginit', 'it': r'vergin', 'en': r'virgin'},
    'foodOrFoodAbst': {'fr': r'nourritur|jeûn|aliment', 'it': r'cib[oi]\b|digiun', 'en': r'food|fasting'},
    'strength': {'fr': r'force|robust|fortes?\b', 'it': r'robust|forza|fort[ei]\b', 'en': r'strength|strong'},
    'weakness': {'fr': r'faible', 'it': r'debol|fragil|imbecill', 'en': r'weak|feeble'},
    'modesty': {'fr': r'pudeur|pudique|modestie', 'it': r'pudor|pudic|modesti', 'en': r'modest'},
    'uglyness': {'fr': r'laid(?:e|es|s|eur)?\b|difform', 'it': r'brutt|deform|difform|sfregia|deturpa', 'en': r'ugl|deform'},
    'feminism': {'fr': r'féminis', 'it': r'femminis', 'en': r'feminis'},
    'housework': {'fr': r'vaisselle|ménag|cuisin', 'it': r'faccend|cucin', 'en': r'housework|domestic'},
    'intellect': {'fr': r'esprit|intelligen|intellect|sçavoir|savoir|entendement', 'it': r'intellett|ingegn|intelligen|mente\b', 'en': r'minds?\b|understanding|intellect'},
    'education': {'fr': r'éducation|instruc|école', 'it': r'educaz|istruz|scuol', 'en': r'educat|school|instruct'},
    'independence': {'fr': r'indépendan|liberté', 'it': r'indipenden|libertà', 'en': r'independen|liberty|freedom'},
    'sensuality': {'fr': r'sensuel|voluptu', 'it': r'sensual|volutt', 'en': r'sensual|voluptu'},
    'submission': {'fr': r'soumi|obéi|docil|dépendan', 'it': r'sottomess|sottomission|obbed|docil|dipenden', 'en': r'submi|obedien|docil|dependen'},
    'bitch': {'fr': r'putain|courtisan|coureuse', 'it': r'meretric|puttan|cortigian', 'en': r'whore|harlot|prostitu'},
    'war': {'fr': r'guerre|bataill|combat|armes\b|épée', 'it': r'guerr|battagl|arm[ie]\b|spad[ae]\b|combatt', 'en': r'wars?\b|warfare|battle|arms\b|sword|combat'},
    'rights': {'fr': r'droits\b', 'it': r'diritti\b', 'en': r'rights\b'},
}


def fold(s):
    """Lower case, accents removed, one character for one character (so positions stay aligned)."""
    import unicodedata
    return ''.join((unicodedata.normalize('NFD', c)[0] if c not in 'œæ' else c).lower() for c in s)


def tagging_check(texts, concepts, plains, review):
    import unicodedata
    unreviewed = []
    for cid, pats in KEYWORDS.items():
        if cid not in concepts:
            continue
        rxs = {lang: re.compile(r'(?<![^\W\d_])(?:' + fold(unicodedata.normalize('NFC', pat)) + ')', re.I) for lang, pat in pats.items()}
        total = tagged = added = other = 0
        by_text, untagged = {}, []
        tagged_with_word = set()
        for t in texts:
            full, spans = plains[t['id']]
            ff = fold(full)
            bt = {'total': 0, 'tagged': 0}
            rx = rxs.get(t['lang'])
            for m in (rx.finditer(ff) if rx else []):
                a = m.start()
                inside = [sp for sp in spans if sp[0] <= a < sp[1]]
                total += 1; bt['total'] += 1
                if any(cid in sp[2] for sp in inside):
                    tagged += 1; bt['tagged'] += 1
                    if not any(cid in sp[2] and not sp[4] for sp in inside):
                        added += 1
                    tagged_with_word.update(sp[3] for sp in inside if cid in sp[2])
                    continue
                why = review.get(f"{cid}|{t['id']}|{a}", {}).get('why')
                if why is None:
                    unreviewed.append(f"{cid}|{t['id']}|{a}")
                if inside:
                    other += 1
                where = 'other' if inside else 'none'
                if len(untagged) < 80:
                    end = m.end()
                    while end < len(full) and (full[end].isalpha() or full[end] in "'’"):
                        end += 1
                    b = norm(full[max(0, a - 70):a]).split(' ')
                    af = norm(full[end:end + 70]).split(' ')
                    untagged.append({'t': t['id'], 'where': where, 'why': why, 'others': sorted({c for sp in inside for c in sp[2]}),
                                     'before': ' '.join(b[1:] if len(b) > 1 else b), 'word': full[a:end], 'after': ' '.join(af[:-1] if len(af) > 1 else af)})
            if bt['total']:
                by_text[t['id']] = bt
        seg_ids = [g['id'] for t in texts for g in t['segs'] if cid in g['concepts'] and not g.get('added')]
        concepts[cid]['check'] = {
            'pattern': pats, 'total': total, 'tagged': tagged, 'added': added, 'inOther': other, 'untaggedAll': total - tagged,
            'byText': by_text, 'examples': untagged,
            'passagesWithoutWord': len([i for i in seg_ids if i not in tagged_with_word]), 'passages': len(seg_ids),
        }
    if unreviewed:
        print('WARNING: concept words neither tagged nor reviewed in data/tagging_review.json:', ', '.join(unreviewed))


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
    r.add_context()
    PLAINS[slug] = (''.join(r.plain), r.spans)
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
        'workTitle': bf_title if bf_title and bf_title.lower()[:12] != title.lower()[:12] else None,
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


PLAINS = {}


def main():
    texts = [build_text(p) for p in sorted(glob.glob(os.path.join(ROOT, 'MarkedTexts', '*.xml')))]
    # working English translations of the tagged passages, for the French and Italian texts
    with open(os.path.join(ROOT, 'data', 'translations.json'), encoding='utf-8') as f:
        tr = json.load(f)
    tr_notes = tr.get('_notes', {})
    missing = []
    for t in texts:
        for g in t['segs']:
            if g['id'] in tr:
                g['en'] = tr[g['id']]
                if g['id'] in tr_notes:
                    g['enNote'] = tr_notes[g['id']]
            elif t['lang'] != 'en' and not g.get('added'):  # the 2026 tags are single words, shown with their label
                missing.append(g['id'])
    assert not missing, ('untranslated passages', missing)
    unknown = [k for k in tr if not k.startswith('_') and not any(g['id'] == k for t in texts for g in t['segs'])]
    assert not unknown, ('translations for passages that do not exist', unknown)
    # life dates and places, from Wikidata by VIAF (tools/fetch_authors.py)
    with open(os.path.join(ROOT, 'data', 'authors.json'), encoding='utf-8') as f:
        lives = json.load(f)
    for t in texts:
        t['life'] = lives.get(t['id'])
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
        added = {t['id']: sum(cid in s['concepts'] and bool(s.get('added')) for s in t['segs']) for t in texts}
        concepts[cid] = {
            'id': cid,
            'label': label_for(cid),
            'counts': {k: v for k, v in used.items() if v},
            'added': {k: v for k, v in added.items() if v},
            'declared': declared,
            'passages': sum(used.values()),
        }
    with open(os.path.join(ROOT, 'data', 'concepts-doc.json'), encoding='utf-8') as f:
        docs = json.load(f)
    for cid, c in concepts.items():
        c['doc'] = docs.get(cid)
    with open(os.path.join(ROOT, 'data', 'tagging_review.json'), encoding='utf-8') as f:
        review = json.load(f)
    tagging_check(texts, concepts, PLAINS, review)
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
    print('tagging check (word occurrences: tagged / total; passages tagged without the word):')
    for cid, c in concepts.items():
        k = c.get('check')
        if k:
            print(f"  {cid:16s} {k['tagged']:3d} / {k['total']:3d} (2026: {k['added']:2d})   in another passage {k['inOther']:3d}   without the word {k['passagesWithoutWord']}/{k['passages']}")


if __name__ == '__main__':
    main()
