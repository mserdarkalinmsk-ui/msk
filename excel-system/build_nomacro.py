#!/usr/bin/env python3
"""
Macro-free portfolio workbook (.xlsx): Power Query (one query, Model) + formulas + conditional formats + native charts.
Works where VBA is blocked by policy.

  python3 build_nomacro.py OUT.xlsx [--settings settings.json]...

The Model query (powerquery/Model.pq) reads every extraction in ExtractionsFolder and every official report in
BudgetsFolder; every sheet here reads the Model table by key (R|BH|n report rows, P|n / PB|BH projects,
H|BH|h headings, C|BH|n checks, T|BH|n postings).
"""
import json, os, sys, datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.formatting.rule import FormulaRule, DataBarRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.utils import get_column_letter as L

HERE = os.path.dirname(os.path.abspath(__file__))
NAVY, NAVY2, INK, MUTED, PAGE, CARD = '1F4E89', '102A50', '1F2937', '6E7580', 'F4F6FA', 'FFFFFF'
BLUE, LIGHT, ORANGE, GREEN, RED, AMBER, TEAL, VIOLET = '2A78D6', 'ADC6F2', 'EB7B34', '00B050', 'E05252', 'F2A33A', '009688', '7C4DFF'
EUR = '#,##0.00;-#,##0.00;"-"'
EUR0 = '#,##0;-#,##0;"-"'
F = 'Segoe UI'

# Model columns
MC = {'Key': 'A', 'Rec': 'B', 'BH': 'C', 'Seq': 'D', 'Kind': 'E', 'Code': 'F', 'Label': 'G', 'Unit': 'H',
      'N1': 'I', 'N2': 'J', 'N3': 'K', 'N4': 'L', 'N5': 'M', 'N6': 'N', 'N7': 'O', 'N8': 'P', 'N9': 'Q', 'N10': 'R', 'N11': 'S', 'N12': 'T',
      'T1': 'U', 'T2': 'V', 'T3': 'W', 'T4': 'X', 'D1': 'Y', 'D2': 'Z', 'D3': 'AA'}

def look(key, col, blank='""'):
    c = MC[col]
    return f'IFERROR(INDEX(Model!${c}:${c},MATCH({key},Model!$A:$A,0)),{blank})'

def fill(c): return PatternFill('solid', fgColor=c)
thin = Side(style='thin', color='E1E4EA')

def page(ws, title, subtitle_formula, width=26):
    ws.sheet_view.showGridLines = False
    for col in range(1, width + 1):
        ws.column_dimensions[L(col)].width = 10
    ws.column_dimensions['A'].width = 2
    for r in range(1, 260):
        for c in range(1, width + 1):
            ws.cell(r, c).fill = fill(PAGE)
            ws.cell(r, c).font = Font(name=F, size=10, color=INK)
    for r in (1, 2, 3):
        for c in range(1, width + 1):
            ws.cell(r, c).fill = fill(NAVY if r < 3 else NAVY2)
    ws['B1'] = title; ws['B1'].font = Font(name=F, size=20, bold=True, color='FFFFFF')
    ws['B2'] = subtitle_formula; ws['B2'].font = Font(name=F, size=10, color='C8D6EB')
    ws.row_dimensions[1].height = 34; ws.row_dimensions[2].height = 18; ws.row_dimensions[3].height = 6

def tile(ws, r, c, w, label, value_formula, ctx_formula, accent=NAVY, fmt=None, bar=None):
    for rr in range(r, r + 4):
        for cc in range(c, c + w):
            ws.cell(rr, cc).fill = fill(CARD)
    for cc in range(c, c + w):
        ws.cell(r, cc).border = Border(top=Side(style='thick', color=accent))
    ws.cell(r, c, label.upper()).font = Font(name=F, size=8, bold=True, color=MUTED)
    v = ws.cell(r + 1, c, value_formula); v.font = Font(name=F, size=18, bold=True, color=INK)
    if fmt: v.number_format = fmt
    ws.merge_cells(start_row=r + 1, start_column=c, end_row=r + 1, end_column=c + w - 1)
    x = ws.cell(r + 2, c, ctx_formula); x.font = Font(name=F, size=8, color=MUTED)
    ws.merge_cells(start_row=r + 2, start_column=c, end_row=r + 2, end_column=c + w - 1)
    ws.row_dimensions[r + 1].height = 28
    if bar:
        # text progress bar: 20 blocks of the share, the time tick shown as a different block
        b = ws.cell(r + 3, c, bar); b.font = Font(name='Consolas', size=9, color=accent)
        ws.merge_cells(start_row=r + 3, start_column=c, end_row=r + 3, end_column=c + w - 1)

def head_row(ws, r, cols):
    for c, text in cols:
        x = ws.cell(r, c, text); x.font = Font(name=F, size=9, bold=True, color=MUTED)
        x.border = Border(bottom=Side(style='medium', color=NAVY)); x.alignment = Alignment(wrap_text=True, vertical='bottom')

def status_rules(ws, rng, first_cell):
    # colour a status text range by its words
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'OR(LEFT({first_cell},8)="Addendum",{first_cell}="Over budget",{first_cell}="Not in the budget")'], fill=fill('FFCCCC'), font=Font(color='9C0006', bold=True)))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'LEFT({first_cell},4)="Near"'], fill=fill('FFC78C'), font=Font(color='823C00', bold=True)))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'OR(LEFT({first_cell},12)="Notification",LEFT({first_cell},5)="Units")'], fill=fill('FFEB9C'), font=Font(color='9C6500')))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'OR(LEFT({first_cell},5)="Risk:",LEFT({first_cell},5)="Ahead")'], fill=fill('FFF2CC'), font=Font(color='9C6500')))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{first_cell}="Behind time"'], fill=fill('EBEBEB'), font=Font(color='6E7580')))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'OR({first_cell}="On track",{first_cell}="Within budget")'], fill=fill('C6EFCE'), font=Font(color='006100')))

def polish(wb, port, proj, ana, chk, pst, byd):
    from openpyxl.chart.axis import ChartLines
    from openpyxl.chart.shapes import GraphicalProperties
    from openpyxl.drawing.line import LineProperties
    from openpyxl.chart import DoughnutChart
    from openpyxl.formatting.rule import IconSetRule
    nav = ['Home', 'Portfolio', 'Project', 'REPORT', 'Analysis', 'Checks', 'By date', 'Postings']
    tabs = {'Home': NAVY, 'Portfolio': NAVY, 'Project': BLUE, 'REPORT': '595959', 'Analysis': BLUE, 'Checks': RED, 'By date': TEAL,
            'Postings': TEAL, 'Model': 'BFBFBF', 'Setup query': 'BFBFBF'}
    for ws in wb.worksheets:
        ws.sheet_properties.tabColor = tabs.get(ws.title, 'BFBFBF')
        ws.sheet_view.zoomScale = 90
        if ws.title in ('Model', 'Setup query'):
            continue
        ws.sheet_view.showRowColHeaders = False
        if ws.title == 'REPORT':
            continue
        # navigation bar under the header band
        ws.row_dimensions[4].height = 22
        col = 2
        for n in nav:
            c = ws.cell(4, col, n)
            c.hyperlink = f"#'{n}'!A1"
            on = n == ws.title
            c.font = Font(name=F, size=9, bold=True, color='FFFFFF' if on else NAVY)
            c.fill = fill(NAVY if on else 'E3ECF8')
            c.alignment = Alignment(horizontal='center', vertical='center')
            c.border = Border(left=Side(style='thick', color=PAGE), right=Side(style='thick', color=PAGE))
            col += 1
    # gridlines and fonts of every chart
    grid = ChartLines(spPr=GraphicalProperties(ln=LineProperties(solidFill='E5E7EB')))
    for ws in wb.worksheets:
        for ch in ws._charts:
            try:
                ch.y_axis.majorGridlines = grid
                ch.x_axis.majorGridlines = None
                ch.y_axis.delete = False; ch.x_axis.delete = False
            except Exception:
                pass
            ch.style = 2
            if type(ch).__name__ == 'BarChart':
                ch.y_axis.scaling.min = 0
            ch.visible_cells_only = False
    # project: two doughnut gauges, used and time
    for i, (lab, src) in enumerate([('Used (spent + committed)', 'N4'), ('Time elapsed', 'N5')]):
        r = 11 + i * 3
        proj.cell(r, 38, lab); proj.cell(r + 1, 38, 'value'); proj.cell(r + 2, 38, 'rest')
        proj.cell(r + 1, 39, '=MIN(1,MAX(0,N(' + look('"PB|"&SelBH', src) + ')))')
        proj.cell(r + 2, 39, f'=1-AM{r + 1}')
        d = DoughnutChart(holeSize=70); d.title = lab
        d.add_data(Reference(proj, min_col=39, min_row=r + 1, max_row=r + 2)); d.set_categories(Reference(proj, min_col=38, min_row=r + 1, max_row=r + 2))
        from openpyxl.chart.series import DataPoint
        pt0 = DataPoint(idx=0); pt0.graphicalProperties.solidFill = BLUE if i == 0 else ORANGE
        pt1 = DataPoint(idx=1); pt1.graphicalProperties.solidFill = 'E5E7EB'
        d.series[0].dPt = [pt0, pt1]; d.legend = None; d.height = 4.6; d.width = 5.4
        d.visible_cells_only = False
        proj.add_chart(d, ('V' if i == 0 else 'Y') + '11')
    for c in (38, 39): proj.column_dimensions[L(c)].hidden = True
    # portfolio table: pace arrows, budget bars
    port.conditional_formatting.add('P12:P26', IconSetRule('3Arrows', 'num', [-1000, -15, 15], showValue=True, reverse=True))
    port.conditional_formatting.add('H12:H26', DataBarRule(start_type='num', start_value=0, end_type='max', color='BFD3EE'))
    # banded rows and frozen headers
    for ws, first, last, cols in [(ana, 6, 185, 'B{r}:P{r}'), (chk, 6, 305, 'B{r}:H{r}'), (pst, 6, 1505, 'B{r}:I{r}'), (byd, 9, 188, 'B{r}:E{r}')]:
        rng = cols.format(r=first).split(':')[0] + ':' + cols.format(r=last).split(':')[1]
        ws.conditional_formatting.add(rng, FormulaRule(formula=[f'AND(MOD(ROW(),2)=0,$B{first}<>"")'], fill=fill('F7F9FC')))
        ws.freeze_panes = f'A{first}'

def build(out, settings_list, model_rows=None):
    wb = Workbook()
    home = wb.active; home.title = 'Home'
    port = wb.create_sheet('Portfolio'); proj = wb.create_sheet('Project'); rep = wb.create_sheet('REPORT')
    ana = wb.create_sheet('Analysis'); chk = wb.create_sheet('Checks'); byd = wb.create_sheet('By date'); pst = wb.create_sheet('Postings')
    model = wb.create_sheet('Model'); setup = wb.create_sheet('Setup query')
    Sel = 'SelBH'
    P = lambda col: look(f'"PB|"&{Sel}', col)

    # ------------------------------------------------------------ Home
    page(home, 'JP Financial Reports', 'From the system extraction to the official report, the analysis and the portfolio - no macros: Power Query + formulas', 16)
    home.column_dimensions['B'].width = 26; home.column_dimensions['C'].width = 16
    for c in 'DEFGH': home.column_dimensions[c].width = 16
    r = 5
    home.cell(r, 2, 'SET UP ONCE').font = Font(name=F, size=9, bold=True, color=MUTED)
    rows = [('Extractions folder', r'C:\JP Reports\Extractions', 'ExtractionsFolder', 'every system extraction (one or more per project; the latest of each BH is used)'),
            ('Reports folder (budgets)', r'C:\JP Reports\Budgets', 'BudgetsFolder', 'the official reports with a REPORT sheet: approved budget, title, contract, JP, BH')]
    for i, (lab, val, name, note) in enumerate(rows):
        rr = r + 1 + i
        home.cell(rr, 2, lab).font = Font(name=F, bold=True)
        c = home.cell(rr, 3, val); c.fill = fill('FFF2CC'); c.font = Font(name=F, size=10, color=INK); c.border = Border(left=thin, right=thin, top=thin, bottom=thin)
        home.merge_cells(start_row=rr, start_column=3, end_row=rr, end_column=6)
        home.cell(rr, 7, note).font = Font(name=F, size=8, color=MUTED)
        wb.defined_names[name] = DefinedName(name, attr_text=f"Home!$C${rr}")
    r = 9
    home.cell(r, 2, 'PROJECT').font = Font(name=F, size=9, bold=True, color=MUTED)
    home.cell(r + 1, 2, 'Selected budget head').font = Font(name=F, bold=True)
    s = home.cell(r + 1, 3, (settings_list[0].get('Budget head (BH)') if settings_list else '')); s.fill = fill('FFF2CC'); s.font = Font(name=F, size=12, bold=True, color=NAVY)
    s.number_format = '@'
    wb.defined_names[Sel] = DefinedName(Sel, attr_text="Home!$C$10")
    home.cell(r + 1, 4, '=' + P('Label')).font = Font(name=F, color=INK)
    home.merge_cells('D10:H10')
    dv = DataValidation(type='list', formula1='=$P$2:$P$41', allow_blank=True); home.add_data_validation(dv); dv.add('C10')
    for k in range(1, 41):
        home.cell(k + 1, 16, '=' + look(f'"P|{k}"', 'BH')).font = Font(color=PAGE)
    home.column_dimensions['P'].hidden = True
    # Steps
    r = 12
    home.cell(r, 2, 'HOW IT WORKS').font = Font(name=F, size=9, bold=True, color=MUTED)
    steps = ['1  Once: put the extractions and the official reports in the two folders above, and type the folders.',
             '2  Once: create the Model query - see the Setup query sheet (copy, paste, load to Model!A1).',
             '3  Every month: drop the new extraction in the folder, then Data > Refresh All. Every project is read and analysed.',
             '4  Pick a budget head above: Project, REPORT, Analysis, Checks, By date and Postings follow it. Portfolio shows all projects.']
    for i, t in enumerate(steps):
        home.cell(r + 1 + i, 2, t).font = Font(name=F, size=10, color=INK)
    # Project settings table
    r = 18
    home.cell(r, 2, 'PROJECT SETTINGS (dates and signatories - one row per budget head)').font = Font(name=F, size=9, bold=True, color=MUTED)
    hdr = ['BH', 'Start', 'End', 'Report type', 'Signatory 1', 'Signatory 2']
    for i, h in enumerate(hdr):
        home.cell(r + 1, 2 + i, h)
    n_set = max(12, len(settings_list) + 6)
    for k in range(n_set):
        st = settings_list[k] if k < len(settings_list) else {}
        vals = [st.get('Budget head (BH)'), st.get('Project start'), st.get('Project end'), st.get('Report type', 'Interim' if st else None),
                st.get('Signatory 1'), st.get('Signatory 2')]
        for i, v in enumerate(vals):
            if isinstance(v, str) and len(v) == 10 and v[4] == '-' and i in (1, 2):
                v = dt.datetime.strptime(v, '%Y-%m-%d')
            c = home.cell(r + 2 + k, 2 + i, v)
            if i in (1, 2): c.number_format = 'dd/mm/yyyy'
            if i == 0: c.number_format = '@'
    tab = Table(displayName='ProjectSettings', ref=f'B{r + 1}:G{r + 1 + n_set}')
    tab.tableStyleInfo = TableStyleInfo(name='TableStyleLight9', showRowStripes=True)
    home.add_table(tab)
    home.column_dimensions['F'].width = 44; home.column_dimensions['G'].width = 44
    # Navigation
    r = r + n_set + 3
    home.cell(r, 2, 'GO TO').font = Font(name=F, size=9, bold=True, color=MUTED)
    for i, n in enumerate(['Portfolio', 'Project', 'REPORT', 'Analysis', 'Checks', 'By date', 'Postings', 'Setup query']):
        c = home.cell(r + 1, 2 + i, n); c.hyperlink = f"#'{n}'!A1"
        c.font = Font(name=F, bold=True, color=NAVY); c.fill = fill('EAF1FA'); c.alignment = Alignment(horizontal='center')

    # ------------------------------------------------------------ Portfolio
    page(port, 'Portfolio', '="Projects in the workbook: "&COUNTIF(Model!$A:$A,"P|*")&" - figures as at each project\'s latest extraction"')
    port.column_dimensions['C'].width = 30
    tot = lambda col: f'SUMIFS(Model!${MC[col]}:${MC[col]},Model!$A:$A,"P|*")'
    tile(port, 5, 2, 3, 'Projects', '=COUNTIF(Model!$A:$A,"P|*")', '="budget heads"')
    tile(port, 5, 6, 3, 'Total budget', f'={tot("N1")}', '="total eligible costs"', NAVY, '#,##0')
    tile(port, 5, 10, 3, 'Spent', f'={tot("N2")}', f'=TEXT(IFERROR({tot("N2")}/{tot("N1")},0),"0%")&" of budget"', BLUE, '#,##0',
         bar=f'=REPT("\u2588",ROUND(MIN(1,IFERROR({tot("N2")}/{tot("N1")},0))*20,0))&REPT("\u2591",20-ROUND(MIN(1,IFERROR({tot("N2")}/{tot("N1")},0))*20,0))')
    tile(port, 5, 14, 3, 'Spent + committed', f'={tot("N3")}', f'=TEXT(IFERROR({tot("N3")}/{tot("N1")},0),"0%")&" used"', BLUE, '#,##0',
         bar=f'=REPT("\u2588",ROUND(MIN(1,IFERROR({tot("N3")}/{tot("N1")},0))*20,0))&REPT("\u2591",20-ROUND(MIN(1,IFERROR({tot("N3")}/{tot("N1")},0))*20,0))')
    tile(port, 5, 18, 3, 'Available', f'={tot("N12")}', '="not yet spent or committed"', GREEN, '#,##0')
    tile(port, 5, 22, 3, 'Flags', f'={tot("N7")}&" / "&{tot("N8")}', '="errors / to check"', RED)
    r0 = 11
    port.cell(r0 - 1, 2, 'Projects').font = Font(name=F, size=12, bold=True)
    cols = [(2, 'Code'), (3, 'Project'), (7, 'BH'), (8, 'Budget'), (10, 'Spent'), (12, 'Spent + committed'), (14, 'Used'), (15, 'Time'), (16, 'Pace (pts)'),
            (17, 'Worst heading'), (21, 'Errors'), (22, 'Check'), (23, 'As at')]
    head_row(port, r0, cols)
    N = 15
    for k in range(1, N + 1):
        rr = r0 + k; key = f'"P|{k}"'
        spec = [(2, 'Code', None), (3, 'Label', None), (7, 'BH', '@'), (8, 'N1', EUR0), (10, 'N2', EUR0), (12, 'N3', EUR0), (14, 'N4', '0%'), (15, 'N5', '0%'),
                (16, 'N6', '+0;-0;0'), (17, 'T4', None), (21, 'N7', '0;-0;""'), (22, 'N8', '0;-0;""'), (23, 'D1', 'dd/mm/yyyy')]
        for c, col, fmt in spec:
            x = port.cell(rr, c, '=' + look(key, col)); x.font = Font(name=F, size=10, color=INK)
            if fmt: x.number_format = fmt
            x.fill = fill(CARD); x.border = Border(bottom=thin)
        port.merge_cells(start_row=rr, start_column=3, end_row=rr, end_column=6)
        port.merge_cells(start_row=rr, start_column=8, end_row=rr, end_column=9)
        port.merge_cells(start_row=rr, start_column=10, end_row=rr, end_column=11)
        port.merge_cells(start_row=rr, start_column=12, end_row=rr, end_column=13)
        port.merge_cells(start_row=rr, start_column=17, end_row=rr, end_column=20)
        port.merge_cells(start_row=rr, start_column=23, end_row=rr, end_column=24)
    status_rules(port, f'Q{r0 + 1}:T{r0 + N}', f'$Q{r0 + 1}')
    port.conditional_formatting.add(f'N{r0 + 1}:N{r0 + N}', DataBarRule(start_type='num', start_value=0, end_type='num', end_value=1, color=BLUE))
    port.conditional_formatting.add(f'P{r0 + 1}:P{r0 + N}', FormulaRule(formula=[f'AND(ISNUMBER(P{r0 + 1}),P{r0 + 1}<-15)'], font=Font(color='C65911', bold=True)))
    port.conditional_formatting.add(f'U{r0 + 1}:U{r0 + N}', FormulaRule(formula=[f'AND(ISNUMBER(U{r0 + 1}),U{r0 + 1}>0)'], font=Font(color='C00000', bold=True)))
    # chart helpers (hidden columns AC..AH)
    for k in range(1, N + 1):
        rr = r0 + k
        pk = lambda col, blank: look('"P|%d"' % k, col, blank)
        port.cell(rr, 29, '=' + pk("Code", '""'))
        port.cell(rr, 30, '=' + pk("N2", "NA()"))
        port.cell(rr, 31, '=' + pk("N3", "NA()") + '-' + pk("N2", "0"))
        port.cell(rr, 32, '=' + pk("N1", "NA()"))
        port.cell(rr, 33, '=' + pk("N4", "NA()"))
        port.cell(rr, 34, '=' + pk("N5", "NA()"))
    for c, h in zip(range(29, 35), ['Project', 'Spent', 'Committed', 'Budget', 'Used', 'Time']): port.cell(r0, c, h)
    for c in range(29, 35): port.column_dimensions[L(c)].hidden = True
    cats = Reference(port, min_col=29, min_row=r0 + 1, max_row=r0 + N)
    ch = BarChart(); ch.type = 'bar'; ch.grouping = 'stacked'; ch.overlap = 100; ch.title = 'Budget, spent and committed by project'
    ch.add_data(Reference(port, min_col=30, max_col=31, min_row=r0, max_row=r0 + N), titles_from_data=True); ch.set_categories(cats)
    ch.series[0].graphicalProperties.solidFill = BLUE; ch.series[1].graphicalProperties.solidFill = LIGHT
    ch2 = BarChart(); ch2.type = 'bar'; ch2.add_data(Reference(port, min_col=32, min_row=r0, max_row=r0 + N), titles_from_data=True)
    ch2.series[0].graphicalProperties.noFill = True; ch2.series[0].graphicalProperties.line.solidFill = INK
    ch.height = 9; ch.width = 17; ch.legend.position = 't'; ch.x_axis.scaling.orientation = 'maxMin'
    port.add_chart(ch, f'B{r0 + N + 3}')
    ch3 = BarChart(); ch3.type = 'bar'; ch3.title = 'Used (spent + committed) against time elapsed'
    ch3.add_data(Reference(port, min_col=33, max_col=34, min_row=r0, max_row=r0 + N), titles_from_data=True); ch3.set_categories(cats)
    ch3.series[0].graphicalProperties.solidFill = BLUE; ch3.series[1].graphicalProperties.solidFill = ORANGE
    ch3.y_axis.number_format = '0%'; ch3.height = 9; ch3.width = 17; ch3.legend.position = 't'; ch3.x_axis.scaling.orientation = 'maxMin'
    port.add_chart(ch3, f'N{r0 + N + 3}')
    # monthly spending of the portfolio (36 months from the first posting)
    mr = r0 + N + 23
    port.cell(mr + 1, 29, 'Month'); port.cell(mr + 1, 30, 'Spent in the month'); port.cell(mr + 1, 31, 'Cumulative')
    for m in range(36):
        rr = mr + 2 + m
        port.cell(rr, 29, f'=IFERROR(EDATE(DATE(YEAR(_xlfn.MINIFS(Model!$Y:$Y,Model!$B:$B,"T")),MONTH(_xlfn.MINIFS(Model!$Y:$Y,Model!$B:$B,"T")),1),{m}),"")').number_format = 'mmm yy'
        port.cell(rr, 30, f'=IF(OR(AC{rr}="",AC{rr}>_xlfn.MAXIFS(Model!$Y:$Y,Model!$B:$B,"T")),NA(),SUMIFS(Model!$I:$I,Model!$B:$B,"T",Model!$J:$J,0,Model!$Y:$Y,">="&AC{rr},Model!$Y:$Y,"<="&EOMONTH(AC{rr},0)))')
        port.cell(rr, 31, f'=IF(ISNA(AD{rr}),NA(),SUM(AD${mr + 2}:AD{rr}))')
    mc = BarChart(); mc.title = 'Spending of the portfolio by month (invoices and GL postings)'
    mc.add_data(Reference(port, min_col=30, min_row=mr + 1, max_row=mr + 37), titles_from_data=True)
    mc.set_categories(Reference(port, min_col=29, min_row=mr + 2, max_row=mr + 37)); mc.series[0].graphicalProperties.solidFill = BLUE
    lc = LineChart(); lc.add_data(Reference(port, min_col=31, min_row=mr + 1, max_row=mr + 37), titles_from_data=True)
    lc.y_axis.axId = 200; lc.y_axis.crosses = 'max'; lc.series[0].graphicalProperties.line.solidFill = ORANGE; lc.series[0].graphicalProperties.line.width = 28000
    mc += lc; mc.height = 8; mc.width = 34; mc.legend.position = 't'; mc.x_axis.number_format = 'mmm yy'
    port.add_chart(mc, f'B{mr}')
    # heat map
    hr = mr + 19
    port.cell(hr, 2, 'Headings against the 25% flexibility').font = Font(name=F, size=12, bold=True)
    port.cell(hr + 1, 2, 'Spent + committed as a share of each heading budget - green within budget, yellow notification, orange near addendum (20-25%), red addendum (>25%), pale = risk at the current pace').font = Font(name=F, size=8, color=MUTED)
    names = ['Human resources', 'Travel', 'Equipment', 'Local office', 'Other costs', 'Other']
    for h in range(6):
        c = port.cell(hr + 2, 6 + h * 3, f'{h + 1} {names[h]}'); c.font = Font(name=F, size=9, bold=True, color=MUTED)
    for k in range(1, N + 1):
        rr = hr + 2 + k
        port.cell(rr, 2, '=' + look(f'"P|{k}"', 'Code')).font = Font(name=F, bold=True)
        for h in range(6):
            c0 = 6 + h * 3
            key = '"H|"&' + look('"P|%d"' % k, "BH") + '&"|%d"' % (h + 1)
            x = port.cell(rr, c0, f'=IFERROR({look(key, "N3", "NA()")}/{look(key, "N1", "NA()")},"")'); x.number_format = '0%'; x.alignment = Alignment(horizontal='center')
            port.cell(rr, 50 + h, '=T(' + look(key, 'T1') + ')')  # status (hidden)
            port.merge_cells(start_row=rr, start_column=c0, end_row=rr, end_column=c0 + 2)
            rng = f'{L(c0)}{rr}:{L(c0 + 2)}{rr}'
            status_rules(port, rng, f'${L(50 + h)}{rr}')
    for c in range(50, 56): port.column_dimensions[L(c)].hidden = True

    # ------------------------------------------------------------ Project
    page(proj, '=' + P('Label'), '="BH "&SelBH&" - situation "&TEXT(' + P('D1') + ',"dd/mm/yyyy")&" - pick another project on the Home sheet"')
    tile(proj, 5, 2, 3, 'Budget', '=' + P('N1'), '="total eligible costs"', NAVY, '#,##0')
    tile(proj, 5, 6, 3, 'Spent', '=' + P('N2'), f'=TEXT(IFERROR({P("N2")}/{P("N1")},0),"0%")&" of budget"', BLUE, '#,##0',
         bar=f'=REPT("\u2588",ROUND(MIN(1,IFERROR({P("N2")}/{P("N1")},0))*20,0))&REPT("\u2591",20-ROUND(MIN(1,IFERROR({P("N2")}/{P("N1")},0))*20,0))')
    tile(proj, 5, 10, 3, 'Committed', f'={P("N3")}-{P("N2")}', '="not yet spent"', LIGHT, '#,##0')
    tile(proj, 5, 14, 3, 'Used vs time', f'=TEXT({P("N4")},"0%")&" / "&TEXT({P("N5")},"0%")', '="spent + committed / time elapsed"', BLUE,
         bar=f'=REPT("\u2588",ROUND(MIN(1,N({P("N4")}))*20,0))&REPT("\u2591",20-ROUND(MIN(1,N({P("N4")}))*20,0))')
    tile(proj, 5, 18, 3, 'Available', '=' + P('N12'), '="not yet spent or committed"', GREEN, '#,##0')
    tile(proj, 5, 22, 3, 'Flags', f'={P("N7")}&" / "&{P("N8")}', '="errors / to check"', RED)
    t = 11
    proj.cell(t - 1, 2, 'Headings').font = Font(name=F, size=12, bold=True)
    head_row(proj, t, [(2, 'Heading'), (6, 'Budget'), (8, 'Spent'), (10, 'Spent + committed'), (12, 'Used'), (13, 'Status - now, or at the current pace')])
    proj.merge_cells(start_row=t, start_column=13, end_row=t, end_column=20)
    for h in range(1, 7):
        rr = t + h; key = f'"H|"&SelBH&"|{h}"'
        proj.cell(rr, 2, f'=IF({look(key, "Label")}="","",{h}&" "&{look(key, "Label")})')
        proj.merge_cells(start_row=rr, start_column=2, end_row=rr, end_column=5)
        for c, col in [(6, 'N1'), (8, 'N2'), (10, 'N3')]:
            x = proj.cell(rr, c, '=' + look(key, col)); x.number_format = EUR0
            proj.merge_cells(start_row=rr, start_column=c, end_row=rr, end_column=c + 1)
        x = proj.cell(rr, 12, f'=IFERROR(J{rr}/F{rr},"")'); x.number_format = '0%'
        proj.cell(rr, 13, '=T(' + look(key, 'T1') + ')')
        proj.merge_cells(start_row=rr, start_column=13, end_row=rr, end_column=20)
        proj.cell(rr, 29, f'=IF(B{rr}="","{h}",LEFT(B{rr},22))'); proj.cell(rr, 30, f'=IFERROR(F{rr}*1,NA())'); proj.cell(rr, 31, f'=IFERROR(H{rr}*1,NA())'); proj.cell(rr, 32, f'=IFERROR(J{rr}*1,NA())')
        for c in range(2, 13): proj.cell(rr, c).fill = fill(CARD)
    status_rules(proj, f'M{t + 1}:T{t + 6}', f'$M{t + 1}')
    for c, h in zip(range(29, 33), ['Heading', 'Budget', 'Spent', 'Spent + committed']): proj.cell(t, c, h)
    for c in range(29, 33): proj.column_dimensions[L(c)].hidden = True
    hc = BarChart(); hc.type = 'col'; hc.title = 'Headings: budget, spent and spent + committed'
    hc.add_data(Reference(proj, min_col=30, max_col=32, min_row=t, max_row=t + 6), titles_from_data=True)
    hc.set_categories(Reference(proj, min_col=29, min_row=t + 1, max_row=t + 6))
    hc.series[0].graphicalProperties.solidFill = 'C9CED6'; hc.series[1].graphicalProperties.solidFill = BLUE; hc.series[2].graphicalProperties.solidFill = LIGHT
    hc.gapWidth = 60; hc.height = 8.5; hc.width = 17; hc.legend.position = 't'
    proj.add_chart(hc, f'B{t + 9}')
    # monthly spending of the project, cumulative against a straight plan
    for m in range(48):
        rr = t + 1 + m
        proj.cell(rr, 34, f'=IFERROR(EDATE(DATE(YEAR({P("D2")}),MONTH({P("D2")}),1),{m}),"")').number_format = 'mmm yy'
        proj.cell(rr, 35, f'=IF(OR(AH{rr}="",AH{rr}>{P("D1")}),NA(),SUMIFS(Model!$I:$I,Model!$B:$B,"T",Model!$C:$C,SelBH,Model!$J:$J,0,Model!$Y:$Y,"<="&EOMONTH(AH{rr},0)))')
        proj.cell(rr, 36, f'=IFERROR({P("N9")}*MIN(1,MAX(0,(EOMONTH(AH{rr},0)-{P("D2")})/({P("D3")}-{P("D2")}))),NA())')
    proj.cell(t, 34, 'Month'); proj.cell(t, 35, 'Cumulative spent (direct)'); proj.cell(t, 36, 'Straight plan')
    for c in range(34, 37): proj.column_dimensions[L(c)].hidden = True
    cl = LineChart(); cl.title = 'Cumulative spending against a straight plan'
    cl.add_data(Reference(proj, min_col=35, max_col=36, min_row=t, max_row=t + 48), titles_from_data=True)
    cl.set_categories(Reference(proj, min_col=34, min_row=t + 1, max_row=t + 48))
    cl.series[0].graphicalProperties.line.solidFill = BLUE; cl.series[0].graphicalProperties.line.width = 32000
    cl.series[1].graphicalProperties.line.solidFill = ORANGE; cl.series[1].graphicalProperties.line.dashStyle = 'dash'
    cl.height = 8.5; cl.width = 17; cl.legend.position = 't'; cl.x_axis.number_format = 'mmm yy'
    proj.add_chart(cl, f'N{t + 9}')
    # lines that need attention (from Analysis)
    a0 = t + 27
    proj.cell(a0, 2, 'Lines that need attention').font = Font(name=F, size=12, bold=True)
    head_row(proj, a0 + 1, [(2, 'Line'), (3, 'Description'), (9, 'Budget'), (11, 'Spent + committed'), (13, 'Used'), (14, 'Units'), (15, 'Status')])
    for k in range(1, 31):
        rr = a0 + 1 + k
        idx = f'_xlfn.AGGREGATE(15,6,ROW(Analysis!$Q$6:$Q$185)/((Analysis!$Q$6:$Q$185<>"On track")*(Analysis!$Q$6:$Q$185<>"")),{k})'
        g = lambda col: f'=IFERROR(INDEX(Analysis!${col}:${col},{idx}),"")'
        proj.cell(rr, 2, g('B')); proj.cell(rr, 3, g('C')); proj.merge_cells(start_row=rr, start_column=3, end_row=rr, end_column=8)
        x = proj.cell(rr, 9, g('D')); x.number_format = EUR0; proj.merge_cells(start_row=rr, start_column=9, end_row=rr, end_column=10)
        x = proj.cell(rr, 11, g('G')); x.number_format = EUR0; proj.merge_cells(start_row=rr, start_column=11, end_row=rr, end_column=12)
        x = proj.cell(rr, 13, g('I')); x.number_format = '0%'
        x = proj.cell(rr, 14, g('L')); x.number_format = '0%'
        proj.cell(rr, 15, g('Q')); proj.merge_cells(start_row=rr, start_column=15, end_row=rr, end_column=22)
    status_rules(proj, f'O{a0 + 2}:V{a0 + 31}', f'$O{a0 + 2}')

    # ------------------------------------------------------------ REPORT (official layout)
    rep.sheet_view.showGridLines = False
    widths = {'A': 62, 'B': 14, 'C': 11, 'D': 12, 'E': 15, 'F': 11, 'G': 12, 'H': 15, 'I': 16, 'K': 6}
    for c, w in widths.items(): rep.column_dimensions[c].width = w
    rep.column_dimensions['K'].hidden = True
    Set = lambda col: f'IFERROR(INDEX(ProjectSettings[{col}],MATCH(SelBH,ProjectSettings[BH],0)),"")'
    rep['A1'] = '=' + P('Label'); rep['A2'] = '=' + P('T2'); rep['A3'] = f'=IF({P("T3")}="","","JP "&{P("T3")}&" - ")&"BH "&SelBH'
    for r in (1, 2, 3):
        rep.merge_cells(f'A{r}:I{r}'); rep[f'A{r}'].alignment = Alignment(horizontal='center'); rep[f'A{r}'].font = Font(name='Calibri', size=14)
    final = f'{Set("Report type")}="Final"'
    rep['A5'] = f'=IF({final},"Final","Interim")&" financial report covering period from "&TEXT({P("D2")},"dd/mm/yyyy")&" to "&TEXT(IF({final},{P("D3")},{P("D1")}),"dd/mm/yyyy")'
    rep['C5'] = 'Budget for all Years'; rep['F5'] = f'="Actual expenditure"&CHAR(10)&"as at "&TEXT({P("D1")},"dd/mm/yyyy")'
    rep['I5'] = f'=IF({final},"","Spent and committed (2)"&CHAR(10)&"(in EUR)")'
    rep.merge_cells('C5:E5'); rep.merge_cells('F5:H5')
    for i, h in enumerate(['Description', 'Unit', '# of units', 'Unit rate\n(in EUR)', 'Cost\n(in EUR)', '# of units', 'Unit rate\n(in EUR)', 'Spent (1)\n(in EUR)', '']):
        rep.cell(6, 1 + i, h)
    for r in (5, 6):
        for c in range(1, 10):
            x = rep.cell(r, c); x.font = Font(name='Calibri', bold=True); x.fill = fill('D9D9D9'); x.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            x.border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
    rep.row_dimensions[5].height = 40; rep.row_dimensions[6].height = 32
    nrows = 160; first = 7
    cnt = 'COUNTIFS(Model!$B:$B,"R",Model!$C:$C,SelBH)'
    asat = f'TEXT({P("D1")},"dd/mm/yyyy")'
    foot = ['""', f'"(1) Expenditure accounted for in the CoE financial records as of "&{asat}',
            f'IF({final},"","(2) Committed activities not accounted for as expenditure in the CoE financial records as of "&{asat})',
            '"(3) A levy of 7% is applied in accordance with the CM decision (CM(2013)123) and adjusted in line with the actual expenditure as presented in this Financial Report."',
            '""', '"Expenditure incurred is in accordance with the Council of Europe Financial Regulations, the costs are eligible under and have been incurred in line with the project budget set out in the Agreement."',
            '""', '"Date:"', '""'] + [f'TRIM(MID(SUBSTITUTE({Set("Signatory 1")},"|",REPT(" ",200)),{i * 200 + 1},200))' for i in range(4)]
    foot2 = ['""'] * 5 + ['"The total eligible costs presented in this financial report match expenditure accounted for in the Council of Europe financial records."', '""', '"Date:"', '""'] + \
            [f'TRIM(MID(SUBSTITUTE({Set("Signatory 2")},"|",REPT(" ",200)),{i * 200 + 1},200))' for i in range(4)]
    for i in range(1, nrows + 1):
        rr = first + i - 1
        key = f'"R|"&SelBH&"|{i}"'
        rep.cell(rr, 11, f'={look(key, "Kind")}')
        rep.cell(rr, 1, f'=IF({i}<={cnt},{look(key, "Label")},IF({i}-{cnt}<={len(foot)},CHOOSE({i}-{cnt},{",".join(foot)}),""))')
        spec = [(2, 'Unit', None), (3, 'N1', '#,##0.##;-#,##0.##;""'), (4, 'N2', '#,##0.00;-#,##0.00;""'), (5, 'N3', EUR), (6, 'N4', '#,##0.##;-#,##0.##;"-"'), (7, 'N5', EUR),
                (8, 'N6', EUR), (9, 'N7', EUR)]
        for c, col, fmt in spec:
            kind = f'$K{rr}'
            val = f'IF(OR({kind}="head",{kind}="total8"),"",IF(AND({kind}<>"line",{c}<>5,{c}<8),"",{look(key, col)}))'
            f = f'=IF({i}<={cnt},{val},"")'
            if c == 9: f = f'=IF({i}<={cnt},IF({final},"",{val}),"")'
            if c == 5: f = f'=IF({i}<={cnt},{val},IF({i}-{cnt}<={len(foot2)},CHOOSE({i}-{cnt},{",".join(foot2)}),""))'
            x = rep.cell(rr, c, f)
            if fmt: x.number_format = fmt
            x.font = Font(name='Calibri', size=10)
        rep.cell(rr, 1).alignment = Alignment(wrap_text=True, vertical='center')
    body = f'A{first}:I{first + nrows - 1}'
    rep.conditional_formatting.add(body, FormulaRule(formula=[f'OR($K{first}="sub",$K{first}="total",$K{first}="total11")'], fill=fill('D9D9D9'), font=Font(bold=True),
                                                     border=Border(top=Side(style='thin'), bottom=Side(style='thin'))))
    rep.conditional_formatting.add(body, FormulaRule(formula=[f'$K{first}="head"'], font=Font(bold=True)))
    rep.conditional_formatting.add(body, FormulaRule(formula=[f'$K{first}="line"'], border=Border(left=Side(style='thin'), right=Side(style='thin'), bottom=Side(style='hair'))))
    rep.page_setup.orientation = 'portrait'; rep.page_setup.fitToWidth = 1; rep.page_setup.fitToHeight = 0
    rep.sheet_properties.pageSetUpPr.fitToPage = True
    rep.print_area = f'A1:I{first + nrows - 1}'

    # ------------------------------------------------------------ Analysis
    page(ana, 'Analysis', '="BH "&SelBH&" - every line against the approved budget; units count only the spent share of a PO"', 18)
    ana.column_dimensions['C'].width = 44; ana.column_dimensions['Q'].width = 44; ana.column_dimensions['R'].hidden = True
    head_row(ana, 5, [(2, 'Line'), (3, 'Description'), (4, 'Budget'), (5, 'Spent'), (6, 'Committed'), (7, 'Spent + committed'), (8, 'Available'), (9, 'Used'),
                      (10, 'Budget units'), (11, 'Units used'), (12, 'Units'), (13, 'Budget rate'), (14, 'Actual rate'), (15, 'Rate vs budget'), (16, 'Time'), (17, 'Status')])
    el = P('N5')
    for i in range(1, 181):
        rr = 5 + i; key = f'"R|"&SelBH&"|{i}"'
        ana.cell(rr, 18, f'={look(key, "Kind")}')
        ana.cell(rr, 2, f'=IF(OR($R{rr}="line",$R{rr}="sub"),{look(key, "Code")},"")')
        ana.cell(rr, 3, f'=IF($R{rr}="line",MID({look(key, "Label")},LEN(B{rr})+2,200),IF($R{rr}="sub",{look(key, "Label")},""))')
        F_ = lambda col: f'IF(OR($R{rr}="line",$R{rr}="sub"),{look(key, col, "0")},"")'
        ana.cell(rr, 4, '=' + F_('N3')).number_format = EUR0
        ana.cell(rr, 5, '=' + F_('N6')).number_format = EUR0
        ana.cell(rr, 6, f'=IF(B{rr}="","",G{rr}-E{rr})').number_format = EUR0
        ana.cell(rr, 7, '=' + F_('N7')).number_format = EUR0
        ana.cell(rr, 8, f'=IF(B{rr}="","",D{rr}-G{rr})').number_format = EUR0
        ana.cell(rr, 9, f'=IF(OR(B{rr}="",N(D{rr})=0),"",G{rr}/D{rr})').number_format = '0%'
        ana.cell(rr, 10, f'=IF($R{rr}="line",{look(key, "N1", "0")},"")').number_format = '#,##0.##;-#,##0.##;""'
        ana.cell(rr, 11, f'=IF($R{rr}="line",{look(key, "N8", "0")},"")').number_format = '#,##0.##;-#,##0.##;""'
        ana.cell(rr, 12, f'=IF(OR($R{rr}<>"line",N(J{rr})=0),"",K{rr}/J{rr})').number_format = '0%'
        ana.cell(rr, 13, f'=IF($R{rr}="line",{look(key, "N2", "0")},"")').number_format = '#,##0.00;-#,##0.00;""'
        ana.cell(rr, 14, f'=IF($R{rr}="line",{look(key, "N9", "0")},"")').number_format = '#,##0.00;-#,##0.00;""'
        ana.cell(rr, 15, f'=IF(OR($R{rr}<>"line",N(M{rr})=0,N(N{rr})=0),"",N{rr}/M{rr}-1)').number_format = '+0%;-0%;0%'
        ana.cell(rr, 16, f'=IF($R{rr}="line",N({el}),"")').number_format = '0%'
        ana.cell(rr, 17, (f'=IF(OR($R{rr}<>"line",AND(N(D{rr})=0,N(G{rr})<=0.5)),"",IF(AND(N(D{rr})=0,N(G{rr})>0.5),"Not in the budget",IF(N(G{rr})>N(D{rr})+0.5,"Over budget",'
                          f'IF(AND(N(J{rr})>0,N(K{rr})>N(J{rr})+0.0001),"Units above budget - notification",'
                          f'IF(AND(N(J{rr})>0,N(P{rr})>0.05,N(K{rr})/MAX(N(P{rr}),0.0001)>N(J{rr})*1.0001),"Risk: units above budget by the end - notification",'
                          f'IF(OR(N(I{rr})-N(P{rr})>0.15,AND(N(M{rr})>0,N(N{rr})>0,N(N{rr})/MAX(N(M{rr}),0.0001)-1>0.15)),"Ahead of time / rate above budget",'
                          f'IF(AND(N(P{rr})>0.25,N(P{rr})-N(I{rr})>0.3),"Behind time","On track")))))))'))
    status_rules(ana, 'Q6:Q185', '$Q6')
    ana.conditional_formatting.add('B6:P185', FormulaRule(formula=['$R6="sub"'], fill=fill('E8EEF6'), font=Font(bold=True)))
    ana.conditional_formatting.add('I6:I185', DataBarRule(start_type='num', start_value=0, end_type='num', end_value=1, color=BLUE))

    # ------------------------------------------------------------ Checks
    page(chk, 'Checks', '="BH "&SelBH&" - entries that look posted in error (see also the Status column of Analysis)"', 14)
    chk.column_dimensions['B'].width = 38; chk.column_dimensions['C'].width = 22; chk.column_dimensions['E'].width = 70; chk.column_dimensions['F'].width = 30
    head_row(chk, 5, [(2, 'Check'), (3, 'Document'), (4, 'Line'), (5, 'Description'), (6, 'Supplier'), (7, 'Amount'), (8, 'Date')])
    for k in range(1, 301):
        rr = 5 + k; key = f'"C|"&SelBH&"|{k}"'
        for c, col, fmt in [(2, 'Label', None), (3, 'T1', None), (4, 'Code', None), (5, 'T2', None), (6, 'T3', None), (7, 'N1', EUR), (8, 'D1', 'dd/mm/yyyy')]:
            x = chk.cell(rr, c, '=' + look(key, col))
            if fmt: x.number_format = fmt
    chk.conditional_formatting.add('B6:H305', FormulaRule(formula=['$B6<>""'], fill=fill('FFF2CC')))

    # ------------------------------------------------------------ By date
    page(byd, 'By date', '="BH "&SelBH&" - spending between two dates (invoices on POs by GL date + GL entries)"', 12)
    byd.column_dimensions['C'].width = 50; byd.column_dimensions['D'].width = 18
    byd['B5'] = 'From'; byd['C5'] = dt.datetime(dt.date.today().year, 1, 1); byd['B6'] = 'To'; byd['C6'] = dt.datetime.combine(dt.date.today(), dt.time())
    for c in ('C5', 'C6'): byd[c].number_format = 'dd/mm/yyyy'; byd[c].fill = fill('FFF2CC'); byd[c].font = Font(name=F, bold=True)
    byd['D5'] = '<- type the dates'
    head_row(byd, 8, [(2, 'Line'), (3, 'Description'), (4, 'Spent in range'), (5, 'Postings')])
    rng = lambda col: f'Model!${MC[col]}:${MC[col]}'
    for i in range(1, 181):
        rr = 8 + i; key = f'"R|"&SelBH&"|{i}"'
        byd.cell(rr, 7, f'={look(key, "Kind")}')
        byd.cell(rr, 2, f'=IF($G{rr}="line",{look(key, "Code")},"")')
        byd.cell(rr, 3, f'=IF($G{rr}="line",MID({look(key, "Label")},LEN(B{rr})+2,200),"")')
        byd.cell(rr, 4, f'=IF(B{rr}="","",SUMIFS({rng("N1")},{rng("Rec")},"T",{rng("BH")},SelBH,{rng("Code")},B{rr},{rng("D1")},">="&$C$5,{rng("D1")},"<="&$C$6))').number_format = EUR
        byd.cell(rr, 5, f'=IF(B{rr}="","",COUNTIFS({rng("Rec")},"T",{rng("BH")},SelBH,{rng("Code")},B{rr},{rng("D1")},">="&$C$5,{rng("D1")},"<="&$C$6))')
    byd.column_dimensions['G'].hidden = True
    byd.cell(190, 2, 'Total').font = Font(name=F, bold=True)
    byd.cell(190, 4, '=SUM(D9:D188)').number_format = EUR; byd.cell(190, 4).font = Font(name=F, bold=True)
    byd['F8'] = 'Month'; byd['G8'] = ''; byd['H8'] = 'Spent'
    head_row(byd, 8, [(9, 'Month'), (10, 'Spent')])
    byd.column_dimensions['I'].width = 12; byd.column_dimensions['J'].width = 16
    for m in range(36):
        rr = 9 + m
        byd.cell(rr, 9, f'=IF(EDATE(DATE(YEAR($C$5),MONTH($C$5),1),{m})>$C$6,"",EDATE(DATE(YEAR($C$5),MONTH($C$5),1),{m}))').number_format = 'mmm yyyy'
        byd.cell(rr, 10, f'=IF(I{rr}="","",SUMIFS({rng("N1")},{rng("Rec")},"T",{rng("BH")},SelBH,{rng("N2")},0,{rng("D1")},">="&MAX(I{rr},$C$5),{rng("D1")},"<="&MIN(EOMONTH(I{rr},0),$C$6)))').number_format = EUR
    bm = BarChart(); bm.title = 'Spent by month in the range'
    bm.add_data(Reference(byd, min_col=10, min_row=8, max_row=44), titles_from_data=True); bm.set_categories(Reference(byd, min_col=9, min_row=9, max_row=44))
    bm.series[0].graphicalProperties.solidFill = BLUE; bm.height = 8; bm.width = 16; bm.legend = None; bm.x_axis.number_format = 'mmm yy'
    byd.add_chart(bm, 'L8')

    # ------------------------------------------------------------ Postings
    page(pst, 'Postings', '="BH "&SelBH&" - every dated invoice and GL entry"', 10)
    pst.column_dimensions['D'].width = 26; pst.column_dimensions['G'].width = 30; pst.column_dimensions['H'].width = 60
    head_row(pst, 5, [(2, 'Date'), (3, 'Type'), (4, 'Document'), (5, 'PO'), (6, 'Line'), (7, 'Supplier'), (8, 'Description'), (9, 'Amount')])
    for k in range(1, 1501):
        rr = 5 + k; key = f'"T|"&SelBH&"|{k}"'
        for c, col, fmt in [(2, 'D1', 'dd/mm/yyyy'), (3, 'Kind', None), (4, 'T1', None), (5, 'T2', None), (6, 'Code', None), (7, 'T3', None), (8, 'Label', None), (9, 'N1', EUR)]:
            x = pst.cell(rr, c, '=' + look(key, col))
            if fmt: x.number_format = fmt

    # ------------------------------------------------------------ Model (loaded by the query) and Setup query
    if model_rows:
        cols = ['Key', 'Rec', 'BH', 'Seq', 'Kind', 'Code', 'Label', 'Unit'] + [f'N{i}' for i in range(1, 13)] + ['T1', 'T2', 'T3', 'T4', 'D1', 'D2', 'D3']
        model.append(cols)
        for row in model_rows:
            vals = [dt.datetime.fromisoformat(v) if isinstance(v, str) and len(v) == 10 and v[4] == '-' and v[7] == '-' and i >= 24 else v for i, v in enumerate(row)]
            model.append(vals)
        for r in model.iter_rows(min_row=2, min_col=25, max_col=27):
            for c in r: c.number_format = 'dd/mm/yyyy'
    else:
      model['A1'] = 'Load the Model query here (Close & Load To... > Table > Existing worksheet: =Model!$A$1). This sheet is then replaced by the query table.'
      model['A1'].font = Font(name=F, italic=True, color=MUTED)
    model.sheet_state = 'visible'
    setup.sheet_view.showGridLines = False
    setup.column_dimensions['A'].width = 150
    steps = ['HOW TO CREATE THE MODEL QUERY (once)',
             '0. The Model sheet holds a preview of the data: clear it first (Model sheet > Ctrl+A > Delete).',
             '1. Select the code below: click A12, then Ctrl+Shift+End. Copy (Ctrl+C).',
             '2. Data > Get Data > From Other Sources > Blank Query. In the Power Query window: Home > Advanced Editor. Select everything there, paste (Ctrl+V), Done.',
             '3. In the Query Settings pane on the right, rename the query to: Model',
             '4. Home > Close & Load (arrow) > Close & Load To... > Table > Existing worksheet: =Model!$A$1 > OK. (Delete the note in Model!A1 first if Excel asks.)',
             '5. If Excel asks about privacy levels: File > Options and settings > Query Options > Privacy > Ignore the privacy levels. Then Data > Refresh All.',
             '6. Each month: put the new extraction in the folder, Data > Refresh All.',
             '', 'CODE (A12 down):']
    for i, t in enumerate(steps):
        c = setup.cell(1 + i, 1, t); c.font = Font(name=F, size=11 if i == 0 else 10, bold=(i in (0, 9)), color=NAVY if i == 0 else INK)
    code = open(os.path.join(HERE, 'powerquery', 'Model.pq'), encoding='utf-8').read().split('\n')
    for i, line in enumerate(code):
        c = setup.cell(12 + i, 1, line if line.strip() else ' ')
        c.font = Font(name='Consolas', size=9); c.number_format = '@'
    polish(wb, port, proj, ana, chk, pst, byd)
    for ws, area in [(port, 'A1:Y110'), (proj, 'A1:AB75')]:
        ws.print_area = area; ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 1; ws.page_setup.orientation = 'landscape'
    if os.environ.get('PREVIEW'):
        for ws in wb.worksheets:
            if ws.title != os.environ['PREVIEW'] and ws.title != 'Model': ws.sheet_state = 'hidden'
        wb['Model'].sheet_state = 'hidden'
        wb.active = wb.sheetnames.index(os.environ['PREVIEW'])
    wb.save(out)
    print('written', out)

if __name__ == '__main__':
    args = sys.argv[1:]
    out = args[0]
    settings = [json.load(open(args[i + 1])) for i, a in enumerate(args) if a == '--settings']
    model_rows = json.load(open(args[args.index('--model') + 1])) if '--model' in args else None
    build(out, settings, model_rows)
