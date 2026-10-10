#!/usr/bin/env python3
"""Build a distributable single HTML document without third-party tooling."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
base = (ROOT / 'src/ledger-base.html').read_text()
styles = ['workspace.css', 'chart-studio.css', 'register-studio.css',
          'schedule-studio.css', 'staff-studio.css', 'studio.css']
scripts = ['studio-shell.js', 'chart-studio.js', 'register-export.js',
           'register-studio.js', 'schedule-studio.js', 'staff-studio.js', 'workspace.js']
style = '\n\n'.join((ROOT / 'src' / name).read_text() for name in styles)
script = '\n\n'.join((ROOT / 'src' / name).read_text() for name in scripts)
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
rail = "evidenceRail(rows(route==='country'?{c:safeRouteId(id)}:{}),['overview','countries'].includes(route))"
assert html.count(rail) == 1
html = html.replace(rail, "evidenceRail(route==='overview'?Masterpiece.scopeRows(rows()):rows(route==='country'?{c:safeRouteId(id)}:{}),['overview','countries'].includes(route))", 1)
motion = "if(RM.matches||from===to)return;"
assert html.count(motion) == 1
html = html.replace(motion, "if(RM.matches||document.body.dataset.studioEffects==='none'||from===to)return;", 1)
(ROOT / 'index.html').write_text(html)
print(f'Built index.html ({len(html.encode()):,} bytes)')
