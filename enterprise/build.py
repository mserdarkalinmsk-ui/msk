#!/usr/bin/env python3
"""Build an offline single HTML from a pinned uploaded engine and readable modules."""
from pathlib import Path
import hashlib
import zipfile

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'vendor/portfolio-analysis-original.html'
EXPECTED='36d485ee2ac93f7e7d32cbfde56da34fde1ec54b236961a34b9cf65d30e72b98'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==EXPECTED, 'Original engine checksum mismatch'
html=SOURCE.read_text()
def once(old,new):
    global html
    assert html.count(old)==1, f'Unsupported engine boundary: {old[:80]}'
    html=html.replace(old,new,1)
modules=['domain.js','bridge.js','components.js','overview.js','report.js']
code='\n\n'.join((ROOT/'src'/name).read_text() for name in modules)
assert '</script' not in code.lower(), 'Unsafe inline script boundary'
once('function ud(){', code+'\nfunction EnterpriseLegacyOverview(){')
once('s==="project"?e(dh,{id:a},a)', 's==="project"?e(EnterpriseProjectPage,{id:a},a)')
# The decision workspace contains a nonblocking selected-portfolio weekly view.
start=html.index('function qd(){');end=html.index('const ji=',start)
html=html[:start]+'function qd(){return null;}'+html[end:]
css=(ROOT/'src/enterprise.css').read_text()
assert '</style' not in css.lower()
once('</head>\n<body>', '<style id="enterprise-design">\n'+css+'\n</style></head>\n<body>')
output=ROOT.parent/'downloads/portfolio-analysis-enterprise.html'
output.parent.mkdir(exist_ok=True)
output.write_text(html)
print(f'Built {output.name}: {output.stat().st_size:,} bytes')
# Deterministic archive: application, sources, baseline, tests and clear limitations.
archive=ROOT.parent/'downloads/portfolio-analysis-enterprise.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    sources=[file for folder in ['src','tests','vendor'] for file in sorted((ROOT/folder).rglob('*')) if file.is_file()]
    sources += [ROOT/name for name in ['build.py','README.md','VALIDATION.md','package.json','package-lock.json'] if (ROOT/name).is_file()]
    files=[(output,output.name)]+[(file,'enterprise/'+str(file.relative_to(ROOT))) for file in sources]
    for file,name in files:
        info=zipfile.ZipInfo(name,(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16
        z.writestr(info,file.read_bytes())
print(f'Built {archive.name}')
