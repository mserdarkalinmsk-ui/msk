#!/usr/bin/env python3
"""Build a distributable single HTML document without third-party tooling."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
base = (ROOT / 'src/ledger-base.html').read_text()
styles = ['workspace.css', 'chart-studio.css', 'register-studio.css',
          'schedule-studio.css', 'staff-studio.css', 'studio.css', 'app-design.css', 'atelier.css']
scripts = ['studio-shell.js', 'chart-studio.js', 'register-export.js',
           'register-studio.js', 'schedule-studio.js', 'staff-studio.js', 'workspace.js', 'ledger-domain.js', 'atelier-pages.js']
style = '\n\n'.join((ROOT / 'src' / name).read_text() for name in styles)
script = '\n\n'.join((ROOT / 'src' / name).read_text() for name in scripts)
assert '</style' not in style.lower()
assert '</script' not in script.lower()
assert 'id="ledger-workspace"' not in base
style_marker = '<!-- LEDGER_STYLES -->'
script_marker = '/* LEDGER_MODULES */'
assert base.count(style_marker) == 1, 'Missing style extension boundary.'
assert base.count(script_marker) == 1, 'Missing script extension boundary.'
html = base.replace(style_marker, '<style id="ledger-workspace">\n' + style + '\n</style>', 1)
html = html.replace(script_marker, script, 1)
(ROOT / 'index.html').write_text(html)
print(f'Built index.html ({len(html.encode()):,} bytes)')
