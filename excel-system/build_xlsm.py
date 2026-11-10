#!/usr/bin/env python3
"""
Builds a macro-enabled workbook (.xlsm) with the VBA modules of ./vba embedded, without Excel.

  python3 build_xlsm.py OUT.xlsm [--budget REPORT.xlsx] [--extraction EXTRACTION.xlsx] [--settings settings.json]

The VBA project (xl/vbaProject.bin) is written from the source files following MS-OVBA:
a compound file (MS-CFB) with the PROJECT / PROJECTwm streams and a VBA storage holding the
compressed dir stream and one compressed source stream per module. _VBA_PROJECT carries no
compiled code (version 0xFFFF), so Excel compiles the modules from source on first open.

With --budget / --extraction the workbook is delivered loaded: the Budget sheet filled from the
REPORT sheet of an official report, the raw_* sheets from the extraction; on open the VBA builds
data for pivot, pivot, REPORT, Analysis, Checks, Postings and By date.
"""
import io, json, os, re, struct, sys, uuid, zipfile, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__))
VBA_DIR = os.path.join(HERE, 'vba')
CP = 'cp1252'

# ------------------------------------------------------------------ MS-OVBA compression
def compress(data: bytes) -> bytes:
    out = bytearray(b'\x01')
    for start in range(0, len(data), 4096):
        chunk = data[start:start + 4096]
        body = bytearray()
        i = 0
        n = len(chunk)
        while i < n:
            flag_pos = len(body); body.append(0); flags = 0
            for bit in range(8):
                if i >= n: break
                diff = i
                bitcount = max((diff - 1).bit_length(), 4) if diff > 0 else 4
                length_mask = 0xFFFF >> bitcount
                max_len = length_mask + 3
                best_len, best_off = 0, 0
                if i > 0:
                    lo = 0
                    for j in range(i - 1, lo - 1, -1):
                        l = 0
                        while l < max_len and i + l < n and chunk[j + l] == chunk[i + l]:
                            l += 1
                        if l > best_len:
                            best_len, best_off = l, i - j
                            if l == max_len: break
                if best_len >= 3:
                    token = ((best_off - 1) << (16 - bitcount)) | (best_len - 3)
                    body += struct.pack('<H', token)
                    flags |= 1 << bit
                    i += best_len
                else:
                    body.append(chunk[i]); i += 1
            body[flag_pos] = flags
        if len(body) + 2 > 4098 or (len(chunk) == 4096 and len(body) >= 4096):
            # raw chunk (only allowed for a full 4096-byte chunk)
            if len(chunk) == 4096:
                out += struct.pack('<H', 0x3000 | (4096 + 2 - 3)) + chunk
                continue
        header = 0x8000 | 0x3000 | ((len(body) + 2 - 3) & 0x0FFF)
        out += struct.pack('<H', header) + body
    return bytes(out)

# ------------------------------------------------------------------ dir stream
def rec(rid: int, data: bytes) -> bytes:
    return struct.pack('<HI', rid, len(data)) + data

def u16(s: str) -> bytes:
    return s.encode('utf-16-le')

STDOLE = '*\\G{00020430-0000-0000-C000-000000000046}#2.0#0#C:\\Windows\\System32\\stdole2.tlb#OLE Automation'

def dir_stream(modules):
    d = bytearray()
    d += rec(0x0001, struct.pack('<I', 1))            # SYSKIND win32
    d += rec(0x004A, struct.pack('<I', 2))            # COMPATVERSION
    d += rec(0x0002, struct.pack('<I', 0x409))        # LCID
    d += rec(0x0014, struct.pack('<I', 0x409))        # LCIDINVOKE
    d += rec(0x0003, struct.pack('<H', 1252))         # CODEPAGE
    d += rec(0x0004, b'VBAProject')                   # NAME
    d += rec(0x0005, b'') + rec(0x0040, b'')          # DOCSTRING
    d += rec(0x0006, b'') + rec(0x003D, b'')          # HELPFILEPATH
    d += rec(0x0007, struct.pack('<I', 0))            # HELPCONTEXT
    d += rec(0x0008, struct.pack('<I', 0))            # LIBFLAGS
    d += struct.pack('<HIIH', 0x0009, 4, 1, 0)        # VERSION (reserved=4, major, minor)
    d += rec(0x000C, b'') + rec(0x003C, b'')          # CONSTANTS
    # reference: stdole
    d += rec(0x0016, b'stdole') + rec(0x003E, u16('stdole'))
    lib = STDOLE.encode(CP)
    body = struct.pack('<I', len(lib)) + lib + struct.pack('<IH', 0, 0)
    d += rec(0x000D, body)
    d += rec(0x000F, struct.pack('<H', len(modules)))  # MODULES count
    d += rec(0x0013, struct.pack('<H', 0xFFFF))        # COOKIE
    for m in modules:
        nm = m['name']
        d += rec(0x0019, nm.encode(CP)) + rec(0x0047, u16(nm))
        d += rec(0x001A, nm.encode(CP)) + rec(0x0032, u16(nm))
        d += rec(0x001C, b'') + rec(0x0048, b'')
        d += rec(0x0031, struct.pack('<I', 0))         # OFFSET: source at 0 (no p-code)
        d += rec(0x001E, struct.pack('<I', 0))
        d += rec(0x002C, struct.pack('<H', 0xFFFF))
        d += rec(0x0022 if m['doc'] else 0x0021, b'')  # document / procedural
        d += rec(0x002B, b'')                          # terminator
    d += rec(0x0010, b'')
    return bytes(d)

def project_stream(modules):
    pid = '{' + str(uuid.uuid4()).upper() + '}'
    lines = [f'ID="{pid}"']
    for m in modules:
        lines.append(f'Document={m["name"]}/&H00000000' if m['doc'] else f'Module={m["name"]}')
    lines += ['Name="VBAProject"', 'HelpContextID="0"', 'VersionCompatible32="393222000"',
              'CMG="0705D8E3D8EDDBF1DBF1DBF1DBF1"', 'DPB="0E0CD1ECDFF4E7F5E7F5E7"', 'GC="1517CAF1D6F9D7F9D706"', '',
              '[Host Extender Info]', '&H00000001={3832D640-CF90-11CF-8E43-00A0C911005A};VBE;&H00000000', '',
              '[Workspace]']
    lines += [f'{m["name"]}=0, 0, 0, 0, C' for m in modules]
    return ('\r\n'.join(lines) + '\r\n').encode(CP)

def projectwm(modules):
    b = bytearray()
    for m in modules:
        b += m['name'].encode(CP) + b'\x00' + u16(m['name']) + b'\x00\x00'
    return bytes(b + b'\x00\x00')

# ------------------------------------------------------------------ compound file (MS-CFB v3)
FREE, END, FATSECT, NOSTREAM = 0xFFFFFFFF, 0xFFFFFFFE, 0xFFFFFFFD, 0xFFFFFFFF

def cfb(tree):
    """tree: {'name': {...} or bytes} — storages as dicts, streams as bytes."""
    entries = []  # dicts: name, type, data, children(list idx)
    def add(name, node):
        idx = len(entries)
        if isinstance(node, dict):
            entries.append({'name': name, 'type': 1, 'kids': []})
            for k, v in node.items():
                entries[idx]['kids'].append(add(k, v))
        else:
            entries.append({'name': name, 'type': 2, 'data': node})
        return idx
    entries.append({'name': 'Root Entry', 'type': 5, 'kids': []})
    for k, v in tree.items():
        entries[0]['kids'].append(add(k, v))

    # mini stream (streams < 4096) and regular streams
    mini = bytearray(); minifat = []
    big = []
    for e in entries:
        if e['type'] != 2: continue
        data = e['data']; e['size'] = len(data)
        if len(data) < 4096:
            if not data: e['start'] = END; continue
            e['start'] = len(mini) // 64
            nsec = (len(data) + 63) // 64
            for k in range(nsec):
                minifat.append(e['start'] + k + 1 if k < nsec - 1 else END)
            mini += data + b'\x00' * (nsec * 64 - len(data))
        else:
            big.append(e)

    sectors = []  # list of bytes(512)
    fat = []
    def place(data):
        start = len(sectors)
        n = max(1, (len(data) + 511) // 512)
        for k in range(n):
            sectors.append(data[k * 512:(k + 1) * 512].ljust(512, b'\x00'))
            fat.append(start + k + 1 if k < n - 1 else END)
        return start
    root_start = place(bytes(mini)) if mini else END
    if not mini: pass
    for e in big:
        e['start'] = place(e['data'])
    mf = b''.join(struct.pack('<I', x) for x in minifat)
    minifat_start = place(mf) if minifat else END
    n_minifat = (len(mf) + 511) // 512 if minifat else 0

    # red-black-valid balanced trees of siblings
    def key(i):
        nm = entries[i]['name']
        return (len(nm), nm.upper())
    for e in entries:
        e.update({'left': NOSTREAM, 'right': NOSTREAM, 'child': NOSTREAM, 'color': 1})
    for e in entries:
        if 'kids' not in e or not e['kids']: continue
        kids = sorted(e['kids'], key=key)
        import math
        bh = int(math.floor(math.log2(len(kids) + 1)))
        def build(lo, hi, depth):
            if lo > hi: return NOSTREAM
            mid = (lo + hi) // 2
            i = kids[mid]
            entries[i]['left'] = build(lo, mid - 1, depth + 1)
            entries[i]['right'] = build(mid + 1, hi, depth + 1)
            entries[i]['color'] = 0 if depth >= bh else 1
            return i
        e['child'] = build(0, len(kids) - 1, 0)

    def dirent(e):
        name = e['name'].encode('utf-16-le') + b'\x00\x00'
        b = name.ljust(64, b'\x00')
        b += struct.pack('<HBB', len(name), e['type'], e['color'])
        b += struct.pack('<III', e['left'], e['right'], e['child'])
        b += b'\x00' * 16 + struct.pack('<I', 0) + b'\x00' * 16
        if e['type'] == 5:
            start, size = root_start, len(mini)
        elif e['type'] == 2:
            start, size = e.get('start', END), e['size']
        else:
            start, size = 0, 0
        b += struct.pack('<IQ', start if start is not None else END, size)
        return b
    dirdata = b''.join(dirent(e) for e in entries)
    pad = (-len(dirdata)) % 512
    dirdata += (b'\x00' * 64 + struct.pack('<HBB', 0, 0, 0) + struct.pack('<III', NOSTREAM, NOSTREAM, NOSTREAM) + b'\x00' * 36 + struct.pack('<IQ', 0, 0)) * (pad // 128)
    dir_start = place(dirdata)

    # FAT sectors (they describe themselves)
    nfat = 1
    while True:
        total = len(sectors) + nfat
        if nfat * 128 >= total: break
        nfat += 1
    fat_start = len(sectors)
    for k in range(nfat):
        fat.append(FATSECT)
    fat += [FREE] * (nfat * 128 - len(fat))
    fatdata = b''.join(struct.pack('<I', x) for x in fat)
    for k in range(nfat):
        sectors.append(fatdata[k * 512:(k + 1) * 512])
    assert nfat <= 109

    hdr = bytearray()
    hdr += bytes.fromhex('D0CF11E0A1B11AE1') + b'\x00' * 16
    hdr += struct.pack('<HHHHH', 0x3E, 3, 0xFFFE, 9, 6) + b'\x00' * 6
    hdr += struct.pack('<IIIII', 0, nfat, dir_start, 0, 4096)
    hdr += struct.pack('<IIII', minifat_start, n_minifat, END, 0)
    difat = [fat_start + k for k in range(nfat)] + [FREE] * (109 - nfat)
    hdr += b''.join(struct.pack('<I', x) for x in difat)
    assert len(hdr) == 512
    return bytes(hdr) + b''.join(sectors)

def vba_project(modules):
    vba = {'_VBA_PROJECT': bytes([0xCC, 0x61, 0xFF, 0xFF, 0x00, 0x00, 0x00]), 'dir': compress(dir_stream(modules))}
    for m in modules:
        vba[m['name']] = compress(m['src'])
    return cfb({'VBA': vba, 'PROJECT': project_stream(modules), 'PROJECTwm': projectwm(modules)})

# ------------------------------------------------------------------ modules
def doc_module(name, base):
    return ('Attribute VB_Name = "%s"\r\nAttribute VB_Base = "%s"\r\nAttribute VB_GlobalNameSpace = False\r\n'
            'Attribute VB_Creatable = False\r\nAttribute VB_PredeclaredId = True\r\nAttribute VB_Exposed = True\r\n'
            'Attribute VB_TemplateDerived = False\r\nAttribute VB_Customizable = True\r\n' % (name, base)).encode(CP)

def load_modules(sheet_codes):
    mods = []
    tw = open(os.path.join(VBA_DIR, 'ThisWorkbook.cls'), 'rb').read()
    mods.append({'name': 'ThisWorkbook', 'doc': True, 'src': tw})
    for c in sheet_codes:
        mods.append({'name': c, 'doc': True, 'src': doc_module(c, '0{00020820-0000-0000-C000-000000000046}')})
    for f in ['modUtil', 'modImport', 'modBuild', 'modAnalysis', 'modControl', 'modPortfolio', 'modDash']:
        mods.append({'name': f, 'doc': False, 'src': open(os.path.join(VBA_DIR, f + '.bas'), 'rb').read()})
    return mods

# ------------------------------------------------------------------ workbook content
SHEETS = ['Control', 'Portfolio', 'Project dashboard', 'Projects', 'Settings', 'Budget', 'REPORT', 'pivot', 'data for pivot', 'Analysis', 'Checks', 'By date', 'Postings',
          'raw_Conso', 'raw_PO', 'raw_Inv', 'raw_GL', 'raw_Situation', 'Monthly', 'Heads']
SETTINGS = [('Project title', '', 'As on the first line of the report'), ('Contract', '', 'e.g. Contract n°700001964'),
            ('JP number', '', 'e.g. 3220'), ('Budget head (BH)', '', 'Filled from the extraction'),
            ('Project start', '', 'dd/mm/yyyy'), ('Project end', '', 'dd/mm/yyyy'),
            ('Situation date', '', 'Filled from the extraction (Date : ... of Situation Budgétaire)'),
            ('Report type', 'Interim', 'Interim or Final'), ('Administrative costs rate', 0.07, '7% of the direct costs (note 3 of the report)'),
            ('Signatory 1', '', 'Name | Title | Directorate | Council of Europe'), ('Signatory 2', '', 'Name | Title | Department | Council of Europe'),
            ('Source file', '', 'Last extraction loaded'), ('Loaded on', '', '')]

def norm(s):
    import unicodedata
    s = unicodedata.normalize('NFD', str(s or '').lower())
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in s if unicodedata.category(c) != 'Mn'))

def find(wb, keys):
    best = None
    for ws in wb.worksheets:
        for r, row in enumerate(ws.iter_rows(min_row=1, max_row=40, values_only=True), 1):
            names = {norm(c) for c in row if c is not None}
            if all(k in names for k in keys):
                if best is None or ws.max_row - r > best[0].max_row - best[1]:
                    best = (ws, r)
                break
    return best

def build_content(out_xlsx, projects):
    budget, extraction, settings = projects[0] if projects else (None, None, None)
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
    wb = openpyxl.Workbook(); wb.remove(wb.active)
    sh = {n: wb.create_sheet(n) for n in SHEETS}
    for n in SHEETS:
        if n.startswith('raw_') or n in ('Monthly', 'Heads'): sh[n].sheet_state = 'hidden'
    head = PatternFill('solid', fgColor='D9D9D9'); yel = PatternFill('solid', fgColor='FFF2CC')
    # Control
    c = sh['Control']; c.sheet_view.showGridLines = False
    c['B2'] = 'JP Financial Report - extraction to report'; c['B2'].font = Font(size=18, bold=True)
    c['B3'] = 'Load the extraction exported from the financial system: it is read, laid out as data for pivot -> pivot -> REPORT, and analysed at once.'
    c['B19'] = 'Sheets'; c['B19'].font = Font(bold=True)
    for i, (n, d) in enumerate([('REPORT', 'Official interim/final financial report - linked to pivot by formulas'), ('pivot', 'Units, spent and spent + committed by reporting line'),
                                ('data for pivot', 'Every PO line and GL entry; NBRE_OF_UNITS can be corrected by hand'), ('Analysis', 'Lines and headings against the approved budget: notification / addendum, units, rates'),
                                ('Checks', 'Entries that look posted in error'), ('By date', 'Spending between two dates (type the dates)'), ('Postings', 'Every dated invoice and GL entry'),
                                ('Budget', 'Approved budget'), ('Settings', 'Project title, dates, signatories')]):
        cell = c.cell(20 + i, 2, n); cell.hyperlink = f"#'{n}'!A1"; cell.font = Font(color='1F4E89', underline='single')
        c.cell(20 + i, 3, d)
    c.column_dimensions['A'].width = 3; c.column_dimensions['B'].width = 22; c.column_dimensions['C'].width = 90
    # Settings
    s = sh['Settings']; s.append(['Setting', 'Value', 'Note'])
    vals = dict(settings or {})
    for k, v, note in SETTINGS:
        val = vals.get(k, v)
        if k in ('Project start', 'Project end', 'Situation date') and isinstance(val, str) and re.match(r'\d{4}-\d{2}-\d{2}', val):
            val = dt.datetime.strptime(val[:10], '%Y-%m-%d')
        s.append([k, val, note])
    for r in range(2, len(SETTINGS) + 2):
        s.cell(r, 2).fill = yel
        if s.cell(r, 1).value in ('Project start', 'Project end', 'Situation date'): s.cell(r, 2).number_format = 'dd/mm/yyyy'
    s['B10'].number_format = '0%'
    for col, w in zip('ABC', (28, 60, 60)): s.column_dimensions[col].width = w
    # Budget
    b = sh['Budget']; b.append(['Code', 'Description', 'Unit', '# of units', 'Unit rate', 'Cost'])
    b['H1'] = 'Approved budget: one row per code, headings (no unit) included.'
    for col, w in zip('ABCDEF', (10, 60, 16, 14, 14, 14)): b.column_dimensions[col].width = w
    if budget:
        src = openpyxl.load_workbook(budget, data_only=True)
        ws = src['REPORT'] if 'REPORT' in src.sheetnames else src.worksheets[0]
        for row in ws.iter_rows(values_only=True):
            a = str(row[0] or '').strip()
            m = re.match(r'^(\d+(?:\.\d+)*)\s+(.*)$', a, re.S)
            if not m or a.startswith('Sub-total') or int(m.group(1).split('.')[0]) > 6: continue
            code, desc = m.group(1), m.group(2).split('\n')[0].strip()
            num = lambda v: v if isinstance(v, (int, float)) else None
            b.append([code, desc, row[1] or None, num(row[2]), num(row[3]), num(row[4])])
            b.cell(b.max_row, 1).number_format = '@'
    for ws_ in (s, b):
        for cell in ws_[1]: cell.font = Font(bold=True); cell.fill = head
    # Register, monthly and heads sheets
    reg = sh['Projects']
    reg.append(["BH", "Code", "Project title", "Contract", "JP", "Start", "End", "Report type", "Admin rate", "Signatory 1",
                "Signatory 2", "Source file", "Situation date", "Budget", "Spent", "Spent + committed", "Used %", "Time %", "Pace (points)",
                "Errors", "To check", "Worst heading", "Units above budget", "Loaded on", "Available"])
    for cell in reg[1]: cell.font = Font(bold=True); cell.fill = head
    sh['Monthly'].append(['BH', 'Month', 'Spent']); sh['Heads'].append(['BH', 'Heading', 'Name', 'Budget', 'Spent + committed', '% vs budget', 'Status'])
    RAW = [('Conso', ['source', 'reportingline', 'spentcomeur']), ('PO', ['ponumber', 'descriptionpo']),
           ('Inv', ['invoiceno', 'montantligne']), ('GL', ['glnumber', 'reportingline']), ('Situation', ['ccm', 'article', 'depensesreelles'])]
    for k, (bud_f, ext_f, sett) in enumerate(projects):
        sett = dict(sett or {})
        bh = str(sett.get('Budget head (BH)', '')).strip()
        src = openpyxl.load_workbook(ext_f, data_only=True) if ext_f else None
        if src and not bh:
            for ws in src.worksheets:
                for row in ws.iter_rows(min_row=1, max_row=12, values_only=True):
                    m = re.search(r'BH=(\d+)', str(row[0] or ''))
                    if m: bh = m.group(1); break
                if bh: break
        if not bh: continue
        if src:
            for part, keys in RAW:
                f = find(src, keys)
                x = wb.create_sheet(f'x_{bh}_{part}'); x.sheet_state = 'hidden'
                if not f: continue
                ws, r = f
                for row in ws.iter_rows(min_row=r, values_only=True):
                    x.append(list(row))
                    if k == 0: sh['raw_' + part].append(list(row))
        if bud_f:
            xb = wb.create_sheet(f'x_{bh}_Budget'); xb.sheet_state = 'hidden'
            xb.append(['Code', 'Description', 'Unit', '# of units', 'Unit rate', 'Cost'])
            bsrc = openpyxl.load_workbook(bud_f, data_only=True)
            bws = bsrc['REPORT'] if 'REPORT' in bsrc.sheetnames else bsrc.worksheets[0]
            for row in bws.iter_rows(values_only=True):
                a = str(row[0] or '').strip()
                m = re.match(r'^(\d+(?:\.\d+)*)\s+(.*)$', a, re.S)
                if not m or a.startswith('Sub-total') or int(m.group(1).split('.')[0]) > 6: continue
                num = lambda v: v if isinstance(v, (int, float)) else None
                xb.append([m.group(1), m.group(2).split('\n')[0].strip(), row[1] or None, num(row[2]), num(row[3]), num(row[4])])
                xb.cell(xb.max_row, 1).number_format = '@'
        d = lambda key: (dt.datetime.strptime(sett[key][:10], '%Y-%m-%d') if isinstance(sett.get(key), str) and re.match(r'\d{4}-', sett.get(key, '')) else sett.get(key))
        reg.append([bh, sett.get('Code', 'JP' + str(sett.get('JP number', '')) if sett.get('JP number') else 'BH' + bh), sett.get('Project title', ''), sett.get('Contract', ''),
                    sett.get('JP number', ''), d('Project start'), d('Project end'), sett.get('Report type', 'Interim'), sett.get('Administrative costs rate', 0.07),
                    sett.get('Signatory 1', ''), sett.get('Signatory 2', ''), sett.get('Source file', os.path.basename(ext_f or '')), d('Situation date')])
        reg.cell(reg.max_row, 1).number_format = '@'
    wb.save(out_xlsx)

def package(xlsx_path, out_path, vba_bin, sheet_codes):
    zin = zipfile.ZipFile(xlsx_path)
    zout = zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED)
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == '[Content_Types].xml':
            t = data.decode()
            t = t.replace('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml', 'application/vnd.ms-excel.sheet.macroEnabled.main+xml')
            if 'vbaProject' not in t:
                t = t.replace('<Default Extension="xml"', '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/><Default Extension="xml"')
            data = t.encode()
        elif item.filename == 'xl/_rels/workbook.xml.rels':
            t = data.decode()
            t = t.replace('</Relationships>', '<Relationship Id="rIdVBA" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>')
            data = t.encode()
        elif item.filename == 'xl/workbook.xml':
            t = data.decode()
            if '<workbookPr' in t:
                t = re.sub(r'<workbookPr', '<workbookPr codeName="ThisWorkbook"', t, count=1)
            else:
                t = t.replace('<bookViews>', '<workbookPr codeName="ThisWorkbook"/><bookViews>', 1)
            data = t.encode()
        elif re.match(r'xl/worksheets/sheet(\d+)\.xml$', item.filename):
            k = int(re.match(r'xl/worksheets/sheet(\d+)\.xml$', item.filename).group(1))
            t = data.decode()
            code = sheet_codes[k - 1]
            if '<sheetPr' in t:
                t = re.sub(r'<sheetPr', f'<sheetPr codeName="{code}"', t, count=1)
            else:
                t = re.sub(r'(<worksheet[^>]*>)', r'\1' + f'<sheetPr codeName="{code}"/>', t, count=1)
            data = t.encode()
        zout.writestr(item, data)
    zout.writestr('xl/vbaProject.bin', vba_bin)
    zout.close()

def main():
    """OUT.xlsm [--project BUDGET.xlsx EXTRACTION.xlsx SETTINGS.json]... (or the single-project --budget/--extraction/--settings)"""
    args = sys.argv[1:]
    out = args[0]
    projects = []
    i = 1
    while i < len(args):
        if args[i] == '--project':
            projects.append((args[i + 1] or None, args[i + 2] or None, json.load(open(args[i + 3])) if args[i + 3] else None)); i += 4
        else:
            i += 1
    opt = lambda k: args[args.index(k) + 1] if k in args else None
    if not projects and (opt('--budget') or opt('--extraction')):
        projects.append((opt('--budget'), opt('--extraction'), json.load(open(opt('--settings'))) if opt('--settings') else None))
    tmp = out + '.tmp.xlsx'
    build_content(tmp, projects)
    import openpyxl
    names = openpyxl.load_workbook(tmp).sheetnames
    codes = [f'Sheet{i + 1}' for i in range(len(names))]
    package(tmp, out, vba_project(load_modules(codes)), codes)
    os.remove(tmp)
    print('written', out, len(names), 'sheets')

if __name__ == '__main__':
    main()
