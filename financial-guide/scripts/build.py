#!/usr/bin/env python3
"""Inline the Financial Guide sources into one self-contained, offline HTML file."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
SCRIPTS = ['content.generated.js', 'engines.js', 'analysis.js', 'core.js',
           'views-guides.js', 'views-operations.js', 'views-engines.js', 'views-analysis.js']

template = (SRC / 'index.html').read_text()
css = (SRC / 'styles.css').read_text()
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
