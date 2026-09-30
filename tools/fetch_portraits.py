"""Download a portrait for every author who has none yet, from the image (P18) on her Wikidata item,
with its Wikimedia Commons licence and credit. Run from the repository root after tools/fetch_authors.py
(needs the network; the images and credits are committed):

    python tools/fetch_portraits.py

Writes assets/portraits/<slug>.jpg (240 x 300, cropped to the portrait format of the site) and adds a
"portrait" entry to data/authors.json: {file, page, artist, licence, licenceUrl}. Existing portraits
(the ones from the project's 2023 site) are kept as they are.
"""
import io
import json
import os
import re
import urllib.parse
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = 'WordsOfGender/2026 (https://github.com/alicepicco333/DigitalTextInTheHumanities)'
OUT = os.path.join(ROOT, 'assets', 'portraits')


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def strip_html(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s or '')).strip()


def main():
    path = os.path.join(ROOT, 'data', 'authors.json')
    authors = json.load(open(path, encoding='utf-8'))
    for slug, a in authors.items():
        target = os.path.join(OUT, slug + '.jpg')
        if os.path.exists(target) and 'portrait' not in a:
            a['portrait'] = {'file': None, 'note': "from the project's 2023 site"}
            continue
        ent = json.loads(get(f"https://www.wikidata.org/wiki/Special:EntityData/{a['qid']}.json"))
        claims = ent['entities'][a['qid']]['claims'].get('P18')
        if not claims:
            print(slug, 'no image on Wikidata')
            continue
        fname = claims[0]['mainsnak']['datavalue']['value']
        q = urllib.parse.urlencode({'action': 'query', 'titles': 'File:' + fname, 'prop': 'imageinfo', 'iiprop': 'url|extmetadata',
                                    'iiurlwidth': 600, 'format': 'json'})
        info = list(json.loads(get('https://commons.wikimedia.org/w/api.php?' + q))['query']['pages'].values())[0]['imageinfo'][0]
        meta = info.get('extmetadata', {})
        img = Image.open(io.BytesIO(get(info['thumburl']))).convert('RGB')
        # crop to 4:5 around the upper part of the picture, where the face usually is in a portrait
        w, h = img.size
        cw, ch = (w, int(w * 5 / 4)) if h >= w * 5 / 4 else (int(h * 4 / 5), h)
        left = (w - cw) // 2
        top = max(0, min(h - ch, int((h - ch) * 0.2)))
        img.crop((left, top, left + cw, top + ch)).resize((240, 300), Image.LANCZOS).save(target, 'JPEG', quality=86, optimize=True, progressive=True)
        a['portrait'] = {
            'file': fname,
            'page': info.get('descriptionurl'),
            'artist': strip_html(meta.get('Artist', {}).get('value')) or None,
            'licence': strip_html(meta.get('LicenseShortName', {}).get('value')) or None,
            'licenceUrl': meta.get('LicenseUrl', {}).get('value'),
        }
        print(f"{slug:15s} {fname[:60]:60s} {a['portrait']['licence']} · {a['portrait']['artist']}")
    json.dump(authors, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
