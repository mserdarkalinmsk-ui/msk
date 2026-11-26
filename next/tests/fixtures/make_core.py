"""Synthetic core team list (all content invented) for the core team import test."""
import openpyxl, datetime
wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Team'
ws.append(['Office team (test list)'])
ws.append(['Name', 'Position', 'Grade', 'Start date', 'End date', 'Funded by'])
ws.append(['Gamma, Three', 'Finance assistant', 'B3', datetime.date(2025, 1, 1), datetime.date(2026, 10, 30), 'Ordinary Budget'])
ws.append(['Delta, Four', 'Driver', 'C2', '01/03/2025', '', 'LS & Pagoda'])
wb.save('tests/fixtures/core-team.xlsx')
