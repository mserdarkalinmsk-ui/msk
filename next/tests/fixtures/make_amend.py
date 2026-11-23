"""Synthetic lease amendment (all content invented) for the amendment test."""
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
st = getSampleStyleSheet(); P = lambda t: Paragraph(t, st['Normal'])
SimpleDocTemplate('tests/fixtures/amend.pdf', pagesize=A4).build([
  Paragraph('2ND AMENDMENT TO THE LEASE CONTRACT NO LC9/2030', st['Heading2']),
  P('between The Council (hereinafter the "Lessee") and Epsilon Rent (hereinafter the "Lessor").'),
  P('For the period from 1 November 2026 until 31 December 2026, the monthly rent shall amount to: 2,500 TRY monthly rent.'),
  P('As from 1 January 2027, the monthly rent shall amount to: 2,000 TRY monthly rent.'),
  P('The lease is concluded until: 30/06/2028.'),
  P('This amendment enters into force on the day of its signature and shall apply with effect from 1 November 2026.'),
])
