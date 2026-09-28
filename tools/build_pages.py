"""Assemble the static pages from tools/pages/*.html.

Each page template may use {{head}}, {{mast}} and {{foot}}; the masthead link
for the current page is marked with aria-current. Run from the repo root:

    python tools/build_archive.py && python tools/build_pages.py
"""
import glob
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'pages')


def part(name):
    with open(os.path.join(SRC, f'_{name}.html'), encoding='utf-8') as f:
        return f.read().strip()


def main():
    head, mast, foot = part('head'), part('mast'), part('foot')
    for path in sorted(glob.glob(os.path.join(SRC, '[!_]*.html'))):
        name = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding='utf-8') as f:
            s = f.read()
        m = mast
        for key in ('index', 'texts', 'concepts', 'about'):
            m = m.replace(f'@@{key}', ' aria-current="page"' if key == name else '')
        s = s.replace('{{head}}', head).replace('{{mast}}', m).replace('{{foot}}', foot)
        with open(os.path.join(ROOT, f'{name}.html'), 'w', encoding='utf-8', newline='\n') as f:
            f.write(s)
        print('wrote', f'{name}.html')


if __name__ == '__main__':
    main()
