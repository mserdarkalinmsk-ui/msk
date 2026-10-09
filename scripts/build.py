#!/usr/bin/env python3
"""Build a distributable single HTML document without third-party tooling."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
base = (ROOT / 'src/ledger-base.html').read_text()
style = (ROOT / 'src/workspace.css').read_text()
script = (ROOT / 'src/workspace.js').read_text()
assert '</style' not in style.lower()
assert '</script' not in script.lower()
assert 'id="ledger-workspace"' not in base
marker = "S.projects.forEach(p=>{try{resolveProject(p)}catch(e){}});\nsyncBar();render();"
assert base.count(marker) == 1, 'The engine integration point has changed.'
html = base.replace('</head>', '<style id="ledger-workspace">\n' + style + '\n</style>\n</head>', 1)
html = html.replace(marker, script + '\n' + marker, 1)
hook = "if(fresh){scrollTo(0,0);lastRoute=key}}"
assert html.count(hook) == 1
html = html.replace(hook, "if(fresh){scrollTo(0,0);lastRoute=key}Masterpiece.afterRender(route)}", 1)
(ROOT / 'index.html').write_text(html)
print(f'Built index.html ({len(html.encode()):,} bytes)')
