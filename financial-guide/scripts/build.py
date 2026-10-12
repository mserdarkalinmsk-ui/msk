#!/usr/bin/env python3
"""Inline the Financial Guide sources into one self-contained, offline HTML file."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
SCRIPTS = ['content.generated.js', 'engines.js', 'core.js',
           'views-guides.js', 'views-operations.js', 'views-engines.js', 'views-analysis.js', 'views-reference.js', 'views-modules.js']

template = (SRC / 'index.html').read_text()
import base64
# Fonts are embedded (latin subsets, SIL OFL) so the page renders instantly and fully offline.
FONTS = [('Space Grotesk', 'space-grotesk-latin.woff2', '400 700'), ('JetBrains Mono', 'jetbrains-mono-500-latin.woff2', '500')]
faces = ''.join(f"@font-face{{font-family:'{f}';font-style:normal;font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{base64.b64encode((SRC / 'fonts' / n).read_bytes()).decode()}) format('woff2')}}\n" for f, n, w in FONTS)
css = faces + (SRC / 'styles.css').read_text()
assert '</style' not in css.lower()
blocks = []
for name in SCRIPTS:
    code = (SRC / name).read_text()
    assert '</script' not in code.lower(), name
    blocks.append(f'<script>\n/* {name} */\n{code}\n</script>')
html = template.replace('<!--STYLE-->', f'<style>\n{css}\n</style>').replace('<!--SCRIPTS-->', '\n'.join(blocks))
out = ROOT.parent / 'financial-guide.html'
out.write_text(html)
print(f'Built {out.name} ({out.stat().st_size:,} bytes)')
