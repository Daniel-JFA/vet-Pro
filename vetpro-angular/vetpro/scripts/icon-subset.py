#!/usr/bin/env python3
"""
Regenera en src/index.html el enlace a Material Symbols con SOLO los iconos que usa la app
(~50 KB en vez de ~1 MB). Ejecutar tras añadir iconos nuevos:  python3 scripts/icon-subset.py

Toma todas las cadenas del código (src/**/*.ts|html) que sean nombres oficiales de Material
Symbols, así también entran los iconos que vienen de datos (item.icon, getSpeciesIcon(), ...).
"""
import glob, re, urllib.request

CODEPOINTS = ('https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/'
              'MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints')
names = {l.split()[0] for l in urllib.request.urlopen(CODEPOINTS).read().decode().splitlines() if l.strip()}

found = set()
for f in glob.glob('src/**/*.*', recursive=True):
    if f.endswith(('.ts', '.html')):
        s = open(f, encoding='utf-8', errors='ignore').read()
        found.update(t for t in re.findall(r"['\"`>]\s*([a-z][a-z0-9_]{1,40})\s*['\"`<]", s) if t in names)

href = ('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0'
        '&icon_names=' + ','.join(sorted(found)) + '&display=block')
p = 'src/index.html'
html = open(p, encoding='utf-8').read()
html, n = re.subn(r'https://fonts\.googleapis\.com/css2\?family=Material\+Symbols\+Outlined[^"]*', href.replace('&', '&amp;'), html)
assert n == 1, 'No se encontró el enlace de Material Symbols en index.html'
open(p, 'w', encoding='utf-8').write(html)
print(f'{len(found)} iconos en el subset')
