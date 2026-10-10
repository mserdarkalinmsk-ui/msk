#!/usr/bin/env python3
"""Add reversible extensions to the exact uploaded HTML; never rewrite its engine."""
from pathlib import Path
import hashlib
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src/original/portfolio-ledger-40.html'
EXPECTED = 'af4f7a60b46f6b092bd7c84abd4f95e83ca81d041dabc92366f823c3cf2fc45e'
base = SOURCE.read_bytes()
assert hashlib.sha256(base).hexdigest() == EXPECTED, 'Uploaded baseline was changed.'
text = base.decode()
css = (ROOT / 'enhancements/professional.css').read_text()
js = (ROOT / 'enhancements/professional.js').read_text()
assert '</style' not in css.lower() and '</script' not in js.lower()
boot = 'S.projects.forEach(p=>{try{resolveProject(p)}catch(e){}});\nsyncBar();render();'
assert text.count(boot) == 1, 'Cannot identify the original startup safely.'
style = '<!-- PROFESSIONAL_STYLE_START -->\n<style id="ledger-professional-style">\n' + css + '\n</style>\n<!-- PROFESSIONAL_STYLE_END -->\n'
extension = '/* PROFESSIONAL_EXTENSION_START */\n' + js + '\n/* PROFESSIONAL_EXTENSION_END */\n'
result = text.replace('</head>', style + '</head>', 1).replace(boot, extension + boot, 1)
assert result.replace(style, '', 1).replace(extension, '', 1).encode() == base
output = ROOT / 'portfolio-ledger-professional.html'
output.write_bytes(result.encode())
print(f'Built {output.name} ({output.stat().st_size:,} bytes); original engine and markup preserved exactly.')
download_dir = ROOT / 'downloads'
download_dir.mkdir(exist_ok=True)
with zipfile.ZipFile(download_dir / 'portfolio-ledger-professional.zip', 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in [(output.name, result.encode()), ('OKU.txt', ('portfolio-ledger-professional.html dosyasını modern bir tarayıcıda açın.\n'
            'Gönderilen portfolio-ledger (40).html temel alınmıştır.\n'
            'Mevcut menüler, sayfalar ve hesaplamalar korunur.\n'
            'Display düğmesinden ek araçları ve görünüm ayarlarını yönetebilirsiniz.\n'
            'Kayıtları taşımak için mevcut dosyada Data > Export JSON kullanın.\n').encode())]:
        entry = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, data)
