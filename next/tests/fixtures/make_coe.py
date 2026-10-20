"""Builds tests/fixtures/coe-report.xlsx: a synthetic workbook with the same sheet
layout as a Council of Europe financial report (all names and figures are invented)."""
import datetime, openpyxl
wb = openpyxl.Workbook()
sb = wb.active; sb.title = 'Situation Budgetaire'
for t in ['Situation Budgétaire', 'Date : 30/09/2026   10.00.00 ', 'Page : 1 / 1', 'Period : SEP-26  Submitted by: demo', 'DATE=30/09/2026 BH=9001 ', 'Plan: 01 General', 'Budget : 0189 JP', 'CCM: N.S.', 'Budget Head: 9001 Demo Rights Programme JP9999']:
    sb.append([t])
sb.append(['CCM\n', 'Article\n', 'Description\n', 'Budget €\n', '\n', 'Engagement\nDA €', '\n', 'Engagement\nPO €', '\n', 'Engagement\nFacture €', '\n', 'Dépenses\nRéelles €', '\n', 'Disponible €\n', '\n', 'Solde €\n'])
sb.append(['00150', '0000015', 'Rémunération du personnel temporaire', 300000, None, 0, None, 20000, None, 0, None, 150000, None, 130000, None, 150000])
sb.append(['00901', '0000299', 'Depenses Operationnelles', 500000, None, 0, None, 10000, None, 0, None, 120000, None, 370000, None, 380000])
sb.append(['Total Budget : 0189', None, '', 800000, '', 0, '', 30000, '', 0, '', 270000, '', 500000, '', 530000])

hdr = ['Budget', 'CCM', 'Budget\nHead', 'Article', 'Element', 'Nature', 'Country', 'Ope.\nType', 'Act.\nType', 'Optional', 'Opt2', 'Reporting\nline', 'Unit\nType', 'Nbre of\nUnits', 'Compo', 'Sub Comp', 'Activity number', 'PO Number', 'Description PO', 'Description PO Line', 'Currency Code', 'PO Amount in Currency', 'PO Reception in Currency', 'PO Amount in EUR', 'Spent in Currency', 'Spent in EUR', 'Balance on PO in EUR', 'Spent and Committed in EUR', 'Item Label', 'Closure Status', 'Supplier No', 'Supplier', 'Encumbered Date']
po = wb.create_sheet('Purchase Orders'); po.append(['All Purchase Orders as at 30 SEP, 2026']); po.append(hdr)
def P(line, units, no, desc, nat, amt, spent, status, date):
    po.append(['0189', '00150', '9001', '15', '0', '640210000', '49', '06', '0', '0', '0', line, 'Per month', units, 0, 0, 0, no, desc, nat, 'EUR', amt, 0, amt, spent, spent, amt - spent, amt, 'x', status, '1', 'Supplier', date])
P('1.1.1.2', 12, 900001, 'DOE,Jane - A2/1 - 100% - Ankara from 01/01/2026 to 31/12/2026', 'Personnel Temporaire External Offices', 72000, 54000, 'OPEN', datetime.datetime(2026, 1, 2))
P('1.1.1.4', 6, 900002, 'ROE,Rick - B4/1 - 50% - Ankara from 01/07/2026 to 31/12/2026', 'Personnel Temporaire External Offices', 18000, 9000, 'OPEN', datetime.datetime(2026, 6, 20))
P('5.7', 1, 900003, 'Conference venue', 'Conferences', 20000, 20000, 'FINALLY CLOSED', datetime.datetime(2026, 3, 1))
wb.create_sheet('Factures sans PO').append(['Factures sans PO'])
wb['Factures sans PO'].append(['Budget', 'CCM', 'Invoice No', 'Description', 'Spent', 'Period'])
gl = wb.create_sheet('Ecriture GL'); gl.append(['Ecriture GL'])
gl.append(['Budget', 'CCM', 'Budget\nHead', 'Article', 'Element', 'Nature', 'Country', 'Ope.\nType', 'Act.\nType', 'Optional', 'Opt2', 'Reporting\nLine', 'Unit Type', 'Nbre of\nUnits', 'Compo', 'Sub Comp', 'Activity Nbr', 'GL Number', 'Description', 'Line Description', 'Category', 'Source', 'Actual Flag', 'CURR', 'SPENT €', 'Period', 'Accounting Date', 'Posting Flag'])
for per, amt in [('JAN-26', 5000), ('FEB-26', 7000), ('FEB-26', 1000)]:
    gl.append(['0189', '00150', '9001', '1', '0', '640110000', '16', '06', '0', '0', '0', '1.2.1.2', 'Per month', 1, 0, 0, 0, 1, 'PAIE', 'POE,Pat', 'Other', 'Spreadsheet', 'Reel', 'EUR', amt, per, datetime.datetime(2026, 1, 31), 'Y'])
fc = wb.create_sheet('Forecast'); fc.append(['Demo Rights Programme'])
fc.append([])
fc.append(['', '', 'Budget for all Years ', '', '', 'Actual expenditure\nas at 30/09/2026', '', '', 'Spent and\ncommitted(2)\n(in EUR)', 'Planned expenditure \nfrom 01/10/2026 to 30/09/2027', '', '', 'Planned expenditure \nfrom 01/10/26 to 30/09/27 (following)', '', '', 'Budget proposal\n(calculated)', '', '', 'Budget proposal\nRounded version'])
fc.append(['Description', 'Unit', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', '# of units', 'Unit rate \n(in EUR)', 'Spent(1)\n(in EUR)', '', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)'])
def L(code, unit, bu, br, au, ar, sc, pu, pr):
    bc, ac, pc = bu * br, au * ar, pu * pr
    fc.append([code, unit, bu, br, bc, au, ar if au else '-', ac if au else '-', sc, pu, pr, pc, 0, 0, 0, au + pu, (ac + pc) / (au + pu) if au + pu else 0, ac + pc, au + pu, round((ac + pc) / (au + pu)) if au + pu else 0, round(ac + pc, -2)])
    return bc, ac, sc, pc
fc.append(['1 Human resources']); fc.append(['1.1 Local']); fc.append(['1.1.1 Local team'])
rows = [L('1.1.1.2 Project manager', 'Per month', 36, 5000, 9, 6000, 60000, 12, 6000),
        L('1.1.1.4 Project officer', 'Per month', 36, 3000, 3, 3000, 9000, 6, 3000)]
fc.append(['2 Travel'])
rows.append(L('2.1 International travel', 'Per return flight', 20, 500, 4, 520, 2080, 6, 520))
fc.append(['5 Other costs, services'])
rows.append(L('5.7 Cost of conferences/seminars', 'Per event', 4, 25000, 1, 20000, 20000, 1, 25000))
B, A, S, PL = (sum(r[i] for r in rows) for i in range(4))
fc.append(['Sub-total 5 Other costs', B, A, S])
fc.append(['7. Sub-total Direct eligible costs of the action', '', '', '', B, '', '', A, S, '', '', PL, '', '', 0, '', '', A + PL, '', '', A + PL])
fc.append(['10. Administrative costs (maximum 7% of 9. Total direct)', '', '', '', B * .07, '', '', A * .07, S * .07, '', '', PL * .07, '', '', 0, '', '', (A + PL) * .07, '', '', (A + PL) * .07])
fc.append(['11. Total eligible costs (9 + 10)', '', '', '', B * 1.07, '', '', A * 1.07, S * 1.07, '', '', PL * 1.07, '', '', 0, '', '', (A + PL) * 1.07, '', '', (A + PL) * 1.07])
rp = wb.create_sheet('REPORT')
for t in ['Demo Rights Programme', 'Contract n°700009999', 'JP 9999 - BH 9001']: rp.append([t])
rp.append(['Interim financial report covering period from 01/10/2025 to 30/09/2026', '', 'Budget for all Years', '', '', 'Actual Expenditures', '', '', 'Spent and Committed (2)'])
fa = wb.create_sheet('Factures a date'); fa.append(['Factures jusqu a Cut-off date 2026/09/30'])
fa.append(['Budget', 'CCM', 'Budget Head', 'Article', 'Element', 'Nature', 'Country', 'Operation\nType', 'Activity\nType', 'Optional\ncode', 'Opt 2', 'Date GL', 'Period', 'Invoice No', 'Description', 'Posted\nFlag', 'Montant\nLigne', ' ', 'Montant\nEngagé €', 'Numero PO'])
for d, per, amt in [(datetime.datetime(2026, 1, 31), 'JAN-26', 6000), (datetime.datetime(2026, 2, 28), 'FEB-26', 6000), (datetime.datetime(2026, 3, 31), 'MAR-26', 20000)]:
    fa.append(['0189', '00150', '9001', '15', '0', '640210000', '49', '06', '0', '0', '0', d, per, 'INV', 'x', 'Y', amt, None, amt, '900001'])
fa.append([None] * 16 + [32000])  # total row without a period, as in real exports
mv = wb.create_sheet('Budget Movements'); mv.append(['Budget Movements'])
mv.append(['Budget', 'CCM', 'Budget\nHead', 'Article', 'Period', 'Date', 'Movement €', 'Lines\nDescription', 'Header\nDescirption', 'Batch'])
mv.append(['0189', '00150', '9001', '299', 'JAN-26', datetime.datetime(2026, 1, 1), 400000, 'KB0101 CV UNION EUROPE BH9001 TRANCHE 1', '', ''])
mv.append(['0189', '00150', '9001', '15', 'FEB-26', datetime.datetime(2026, 2, 1), 30000, 'BH9001 art299 vers 15', '', ''])
wb.save('tests/fixtures/coe-report.xlsx')
print('direct', B, A, S, PL)
