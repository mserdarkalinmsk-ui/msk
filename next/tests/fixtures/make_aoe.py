"""Synthetic Act of Engagement (all content invented) for the contract reading test."""
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table
from reportlab.lib.styles import getSampleStyleSheet
st = getSampleStyleSheet()
doc = SimpleDocTemplate('tests/fixtures/aoe.pdf', pagesize=A4)
doc.build([
  Table([['Contract No.', 'SC099/2026'], ['Project ID / Sector', 'PROGRAMME OFFICE']]),
  Paragraph('ACT OF ENGAGEMENT (Direct Award / Framework contract)', st['Heading2']),
  Table([['Name and address', Paragraph('DELTA UTILITIES LTD. Example Mah. Test Bul. No:1, 06000 Ankara', st['Normal'])], ['Representative (for legal persons only)', 'ONE ALPHA']], colWidths=[180, 270]),
  Table([['Type(s) of Units', 'Deadline for delivery', 'Price per month'], ['Service fee', 'End of each month', '1.000,00 TRY'], ['', 'TOTAL FOR 12 MONTHS OF 2026 (including VAT)', '12.000,00 TRY']]),
  Table([[Paragraph('This Framework Contract takes effect as from the date of its signature by both parties and is concluded until:', st['Normal']), '31/12/2026'],
         [Paragraph('The Framework Contract may be renewed [annually] with the written agreement of the parties. It may not be renewed beyond:', st['Normal']), '31/01/2027']], colWidths=[360, 90]),
])
