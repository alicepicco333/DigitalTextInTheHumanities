"""Download the nine author portraits from Wikimedia Commons, verify their
licence in the extmetadata, convert them to greyscale and write
data/portraits.json with the attribution. Run from the repo root:

    python tools/fetch_portraits.py

Only public-domain, CC0, CC BY and CC BY-SA files are accepted.
"""
import io
import json
import os
import re
import urllib.parse
import urllib.request

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://commons.wikimedia.org/w/api.php'
UA = {'User-Agent': 'WordsOfGender/1.0 (https://github.com/alicepicco333/DigitalTextInTheHumanities)'}
FREE = re.compile(r'^(public domain|pd|cc0|cc[ -]by(-sa)?[ -][\d.]+.*)$', re.I)

PORTRAITS = {
    'marguerite': ('File:Jean Clouet (Attributed) - Portrait of Marguerite of Navarre - Google Art Project.jpg', None),
    'franco': ('File:Veronica Franco.jpg',
               'Traditionally identified as Veronica Franco: the sitter\'s name is written on the lining of the canvas, '
               'but the identification and the attribution (Tintoretto or a follower) are uncertain.'),
    'lambert': ('File:Attributed to François de Troy - Anne-Thérèse Marguenat de Courcelles, marquise de Lambert.png', 'Attributed to François de Troy.'),
    'wollstonecraft': ('File:Mary Wollstonecraft by John Opie (c. 1797).jpg', None),
    'sand': ('File:George Sand by Nadar, 1864.jpg', None),
    'negri': ('File:Ada Negri 1913.jpg', None),
    'cahun': ('File:Claude Cahun - I Am in Training Don\'t Kiss Me.jpg', 'Self-portrait in costume.'),
    'beauvoir': ('File:Simone de Beauvoir2.png', 'Crop of a Government Press Office (Israel) photograph, 1967.'),
    'chiara': ('File:Simone Martini 047.jpg', 'Fresco detail, Lower Church of San Francesco, Assisi.'),
}


def clean(v):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', v or '')).strip()


def main():
    titles = [t for t, _ in PORTRAITS.values()]
    q = {'action': 'query', 'titles': '|'.join(titles), 'prop': 'imageinfo',
         'iiprop': 'url|extmetadata', 'iiurlwidth': 720, 'format': 'json'}
    req = urllib.request.Request(API + '?' + urllib.parse.urlencode(q), headers=UA)
    pages = {p['title']: p for p in json.load(urllib.request.urlopen(req, timeout=60))['query']['pages'].values()}
    out = {}
    for key, (title, note) in PORTRAITS.items():
        p = pages[title.replace('_', ' ')]
        ii = p['imageinfo'][0]
        md = ii['extmetadata']
        lic = clean(md.get('LicenseShortName', {}).get('value'))
        if not FREE.match(lic):
            raise SystemExit(f'{title}: licence "{lic}" is not accepted')
        data = urllib.request.urlopen(urllib.request.Request(ii['thumburl'], headers=UA), timeout=60).read()
        im = Image.open(io.BytesIO(data)).convert('L')
        im = ImageOps.autocontrast(im, cutoff=0.5)
        im.thumbnail((560, 700))
        path = f'assets/portraits/{key}.jpg'
        im.save(os.path.join(ROOT, path), quality=80, optimize=True, progressive=True)
        out[key] = {
            'file': path,
            'title': title.replace('File:', ''),
            'artist': clean(md.get('Artist', {}).get('value')),
            'date': clean(md.get('DateTimeOriginal', {}).get('value')).split('date QS')[0],
            'licence': lic,
            'licenceUrl': clean(md.get('LicenseUrl', {}).get('value')) or None,
            'source': ii['descriptionurl'],
            'note': note,
        }
        print(key, lic, im.size)
    with open(os.path.join(ROOT, 'data', 'portraits.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
