"""Synthetic salary scale document (all figures invented): two countries, one page each, for the scale upload test."""
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

st = getSampleStyleSheet()
def page(country, cur, base):
    rows = [['Grade'] + [str(i) for i in range(1, 9)] + ['Step value']]
    for k, g in enumerate(['B 3', 'B 2', 'B 1', 'C 2', 'C 1']):
        start, step = base - k * 900, 100 + k * 10
        rows.append([g] + [f'{start + i * step:,.2f}' for i in range(8)] + [f'{step:,.2f}'])
    return [Paragraph(f'{country} — monthly basic salary scale as of 01.01.2028 ({cur})', st['Heading2']), Table(rows), PageBreak()]
doc = SimpleDocTemplate('tests/fixtures/scale.pdf', pagesize=landscape(A4))
doc.build(page('Testland', 'EUR', 5000) + page('Türkiye', 'TRY', 9000))
