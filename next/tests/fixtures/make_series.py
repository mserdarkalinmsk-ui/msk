"""Copies of the synthetic CoE workbook with other report dates (for the bulk-import test)."""
import openpyxl, os
os.makedirs('tests/fixtures/series', exist_ok=True)
for tag, d, y in [('a', '31/03/2026', '31 MAR, 2026'), ('b', '30/06/2026', '30 JUN, 2026'), ('c', '30/09/2026', '30 SEP, 2026')]:
    wb = openpyxl.load_workbook('tests/fixtures/coe-report.xlsx')
    for ws in wb:
        for row in ws.iter_rows():
            for c in row:
                if isinstance(c.value, str): c.value = c.value.replace('30/09/2026', d).replace('30 SEP, 2026', y).replace('2026/09/30', d[6:] + '/' + d[3:5] + '/' + d[:2])
    wb.save(f'tests/fixtures/series/report-{tag}.xlsx')
