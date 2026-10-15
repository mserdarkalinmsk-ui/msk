"""Synthetic budget justification annex (invented content), laid out like the real template:
wrapped cell text, vertically centred, rows of very different heights."""
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

st = getSampleStyleSheet()['Normal']; st.fontSize = 7; st.leading = 8.5
P = lambda t: Paragraph(t, st)
long = 'Estimated rate based on the cost of a step 3 with 1 child. Rate may be higher depending on the experience of the postholder (additional steps to be allowed) and the family situation. The rates provided are standards; actual salaries for the first year will depend on various factors.'
rows = [
  ['Description', 'Unit', 'Clarification of the budget items', 'Justification of the estimated costs'],
  [P('1 Human resources'), '', '', ''],
  [P('1.1.1.1 Senior project manager'), 'Per month', '', ''],
  [P('1.1.1.2 Project manager (100%)'), 'Per month', P('PM in charge of overall management of the project in the field. Specified in DoA under 4.3.2.'), P('1 full-time manager in Ankara for 60 months. ' + long)],
  [P('1.1.1.3 Senior project officer (80%)'), 'Per month', P('SPO assists the PM on substance. ' + long + ' ' + long), P('1 full-time officer for 48 months.')],
  [P('1.1.1.4 Project officer (100%)'), 'Per month', P('PO organises activities.'), P('1 full-time PO for 60 months. ' + long)],
  [P('1.1.1.7 Project assistant (2 persons: 1 PA 100%, 1 PA 80%)'), 'Per month', P('2 PAs in Ankara for administration.'), P('Grade B2. ' + long)],
]
rows += [[P(f'5.{k} Other item {k}'), 'Per item', P('Item clarification ' + str(k) + '. ' + long), P('Output 1.1: A.1.1.1: (2 STCs*5 days= 10 days) Sub Total: 10')] for k in range(1, 9)]
t = Table(rows, colWidths=[150, 50, 260, 300])
t.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), .4, colors.black), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('FONTSIZE', (0, 0), (-1, -1), 7), ('BACKGROUND', (0, 2), (-1, 2), colors.lightgreen)]))
def hf(c, d):
    c.setFont('Helvetica', 8); c.drawRightString(800, 570, 'Demo Rights Programme'); c.drawRightString(800, 560, 'Contract n° 700000000'); c.drawString(40, 20, str(d.page))
SimpleDocTemplate('tests/fixtures/justification.pdf', pagesize=landscape(A4)).build([t], onFirstPage=hf, onLaterPages=hf)
