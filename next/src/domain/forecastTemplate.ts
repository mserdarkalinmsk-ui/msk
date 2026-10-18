import { HEADINGS, latestReport, lineExposure, lines, n, parseDate } from './calc';
import type { BudgetLine, Project } from './types';
import type { Cell, SheetSpec, XCell } from '../ui/xlsxwrite';

/**
 * Forecast workbook following the CoE templates for reporting and forecasting (JP "budget revision with payment"):
 * columns A–V — budget for all years, actual expenditure, spent and committed, planned expenditure for the next 12 months
 * (next instalment), planned expenditure to the end (budget revision), the budget proposal calculated and rounded, and the
 * indicative variation. Green cells are filled by finance (staff, charging back 4.2/4.4), yellow ones by the project team.
 * Two donor sheets follow — "Budget presentation" and "variation" — linked to the rounded proposal.
 * Loaded back through Import, the Forecast sheet is read like any financial report with a forecast.
 */
const dmy = (d: string) => { const [y, m, dd] = d.slice(0, 10).split('-'); return `${dd}/${m}/${y}`; };
const addDays = (d: string, k: number) => new Date(parseDate(d).getTime() + k * 864e5).toISOString().slice(0, 10);
const addMonths = (d: string, k: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCMonth(x.getUTCMonth() + k); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
const col = (i: number): string => (i >= 26 ? col(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));
// A description · B unit · C–E budget · F–H actual · I spent and committed · J–L next 12 months · M–O revision to the end ·
// P–R proposal (calculated) · S–U proposal (rounded) · V indicative variation
const C = { unit: 1, units: 2, rate: 3, cost: 4, aUnits: 5, aRate: 6, actual: 7, sc: 8, pUnits: 9, pRate: 10, planned: 11, rUnits: 12, rRate: 13, rCost: 14, qUnits: 15, qRate: 16, proposal: 17, sUnits: 18, sRate: 19, rounded: 20, vari: 21 };
const SUMMED = [C.cost, C.actual, C.sc, C.planned, C.rCost, C.proposal, C.rounded];
const W = 22;
const MONTH = 30.44 * 864e5;
/** Staff lines (salaries) and charging back (4.2 office rent, 4.4 office furniture) are prepared by finance. */
const isStaff = (code: string) => /^1\.[12]\.1\./.test(code);
const isChargeBack = (code: string) => code === '4.2' || code === '4.4';

export function forecastPeriod(p: Project, today: Date): { from: string; to: string; asAt: string; revFrom: string; revTo: string } {
  const r = latestReport(p), asAt = (r?.snapshot?.workbook?.meta.asAt || r?.date || today.toISOString()).slice(0, 10);
  const from = addDays(asAt, 1);
  const months = Number((p.contract as { repMonths?: number } | undefined)?.repMonths) || 12;
  const to0 = addMonths(from, months), to = to0 > p.end ? p.end : to0;
  // The budget revision covers what is left after the 12 months, up to the end date.
  const revFrom = to < p.end ? addDays(to, 1) : from;
  return { from, to, asAt, revFrom, revTo: p.end };
}

/**
 * Planned monthly rate for a staff line (guidelines, step 5): the latest cost rounded up, plus a margin for salary
 * adjustments that grows with the time left — local staff €40 (≤ 12 months) or €125, HQ staff €100 or €225.
 */
export function staffRate(code: string, latest: number, monthsLeft: number): number {
  if (!(latest > 0)) return 0;
  const hq = /^1\.2\./.test(code), long = monthsLeft > 12;
  return Math.ceil(latest / 5) * 5 + (hq ? (long ? 225 : 100) : (long ? 125 : 40));
}

/** Lines of the CoE budget template, in order, with their unit; every forecast lists them even when not budgeted. */
const STANDARD: [string, string, string][] = ([
  ['1', 'Human resources', ''], ['1.1', 'Local', ''], ['1.1.1', 'Local team', ''], ['1.1.1.1', 'Senior project manager', 'Per month'], ['1.1.1.2', 'Project manager', 'Per month'],
  ['1.1.1.3', 'Senior project officer', 'Per month'], ['1.1.1.4', 'Project officer', 'Per month'], ['1.1.1.5', 'Linguistic assistant', 'Per month'], ['1.1.1.6', 'Financial assistant', 'Per month'],
  ['1.1.1.7', 'Project assistant', 'Per month'], ['1.1.2', 'Local long-term consultant', 'Per month'], ['1.1.3', 'Local short-term consultant', 'Per day'], ['1.2', 'International', ''],
  ['1.2.1', 'Project management HQ', ''], ['1.2.1.1', 'Senior project manager', 'Per month'], ['1.2.1.2', 'Project manager', 'Per month'], ['1.2.1.3', 'Senior project officer', 'Per month'],
  ['1.2.1.4', 'Project officer', 'Per month'], ['1.2.1.5', 'Linguistic assistant', 'Per month'], ['1.2.1.6', 'Financial assistant', 'Per month'], ['1.2.1.7', 'Project assistant', 'Per month'],
  ['1.2.2', 'International long-term consultant', 'Per month'], ['1.2.3', 'International short-term consultant', 'Per day'], ['1.3', 'Per diems', ''], ['1.3.1', 'International', 'Per diem'],
  ['1.3.2', 'Local', 'Per diem'], ['2', 'Travel', ''], ['2.1', 'International travel', 'Per return flight'], ['2.2', 'Local transportation (within the beneficiary country of the project)', 'Per trip'],
  ['3', 'Equipment and supplies for project beneficiaries/recipients', ''], ['3.1', 'Equipment', 'Per item'], ['3.2', 'Specify…', 'Per item'], ['4', 'Local office', ''],
  ['4.1', 'Vehicle costs', 'Per month'], ['4.2', 'Office rent and related charges', 'Per month'], ['4.3', 'Consumables - office supplies', 'Per month'], ['4.4', 'Office furniture and expenses', 'Per month'],
  ['4.5', 'Other services', 'Per month'], ['5', 'Other costs, services', ''], ['5.1', 'Publications', 'Per item'], ['5.2', 'Studies/research', 'Per item'], ['5.3', 'Auditing costs', 'Per item'],
  ['5.4', 'Evaluation costs', 'Per item'], ['5.5.1', 'Translation', 'Per 250 words'], ['5.5.2', 'Interpretation', 'Per person/day'], ['5.6', 'Financial services (bank guarantee costs etc.)', 'Per item'],
  ['5.7', 'Cost of conferences/seminars', 'Per event'], ['5.8', 'Visibility actions', 'Per item'], ['6', 'Other', ''], ['6.1', 'Grants', 'Per item'], ['6.2', 'Specify…', 'Per item'],
] as [string, string, string][]);
const STD = new Map(STANDARD.map(([c, d, u]) => [c, { d, u }]));
const STD_GROUP = new Set(STANDARD.filter(([, , u]) => !u).map(([c]) => c));

type Row = (Cell | XCell)[];
export function forecastSheets(p: Project, today: Date): SheetSpec[] {
  const per = forecastPeriod(p, today), L = lines(p);
  const monthsLeft = Math.max(0, (parseDate(p.end).getTime() - parseDate(per.from).getTime()) / MONTH);
  const names = p.approvedBudget?.names ?? {};
  const isSpecial = (c: string) => c === '10' || /^8(\.|$)/.test(c);
  const leafs = L.filter((l) => !isSpecial(l.code) && !L.some((o) => o !== l && o.code.startsWith(l.code + '.')));
  const leafBy = new Map(leafs.map((l) => [l.code, l]));
  const desc = (c: string) => leafBy.get(c)?.description || (!c.includes('.') && STD.get(c)?.d) || names[c] || STD.get(c)?.d || (c.includes('.') ? '' : HEADINGS[c] ?? '');
  const byNum = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
  const contract = p.contractNo || (p.contract as { number?: string } | undefined)?.number;
  const ident = [p.jp || p.pmm ? `JP ${p.jp ?? p.pmm}` : '', p.bh ? `BH ${p.bh}` : ''].filter(Boolean).join(' - ');

  const rows: Row[] = [], heights: Record<number, number> = {}, merges: string[] = [];
  const kind: ('title' | 'band' | 'head' | 'group' | 'line' | 'sub' | 'total' | 'blank' | 'note' | 'sum')[] = [];
  const codeAt: string[] = [];
  const blank = (st?: XCell['st']): Row => Array.from({ length: W }, () => (st ? { st } : ''));
  const push = (r: Row, k: (typeof kind)[number], h?: number, code = '') => { rows.push(r); kind.push(k); codeAt.push(code); if (h) heights[rows.length] = h; return rows.length; };
  const val = (r: number, c: number) => { const x = rows[r - 1]?.[c] as XCell | undefined; return typeof x?.v === 'number' ? x.v : 0; };
  const variation = (r: number, st: XCell['st']): XCell => { const e = val(r, C.cost), u = val(r, C.rounded); return { f: `+IF(E${r}>0,(U${r}-E${r})/E${r},"")`, v: e > 0 ? (u - e) / e : undefined, st }; };

  // 1–4: title, instructions band, column groups and sub-headers
  const t = blank(); t[0] = { v: [p.name, `Contract n°${contract ?? ''}`, ident].join('\n'), st: 'rTitle' }; push(t, 'title', 54); merges.push('A1:U1');
  const b = blank();
  b[C.pUnits] = { v: 'MANDATORY FOR DETERMINING THE AMOUNT OF THE NEXT INSTALMENT PAYMENT TO BE REQUESTED WITH THE ANNUAL OFFICIAL REPORT', st: 'rBan' };
  b[C.rUnits] = { v: 'TO BE FILLED OUT ONLY IF PROJECT TEAMS ARE REQUESTING A BUDGET REVISION (ADDENDUM/NOTIFICATION)', st: 'rBan' };
  for (const c of [C.pRate, C.planned, C.rRate, C.rCost]) b[c] = { st: 'rBan' };
  push(b, 'band', 115); merges.push('J2:L2', 'M2:O2');
  const g = blank('rHead');
  g[C.units] = { v: 'Budget for all Years\nContractual', st: 'rHead' };
  g[C.aUnits] = { v: `Actual expenditure\nas at ${dmy(per.asAt)}`, st: 'rHead' };
  g[C.sc] = { v: 'Spent and\ncommitted(2)\n(in EUR)', st: 'rHead' };
  g[C.pUnits] = { v: `Planned expenditure \nfrom ${dmy(per.from)} to ${dmy(per.to)} (12 months)`, st: 'rHead' };
  g[C.rUnits] = { v: `Planned expenditure \nfrom ${dmy(per.revFrom)} to ${dmy(per.revTo)} (for budget revision)`, st: 'rHead' };
  g[C.qUnits] = { v: 'Budget proposal\n(calculated)', st: 'rHead' };
  g[C.sUnits] = { v: 'Budget proposal\n(Rounded version)', st: 'rHead' };
  g[C.vari] = { v: 'Indicative \nVariation', st: 'rHead' };
  push(g, 'head', 48); merges.push('C3:E3', 'F3:H3', 'I3:I4', 'J3:L3', 'M3:O3', 'P3:R3', 'S3:U3', 'V3:V4');
  const sub = ['Description', 'Unit', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', '# of units', 'Unit rate \n(in EUR)', 'Spent(1)\n(in EUR)', '',
    '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)',
    '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', ''];
  push(sub.map((v) => ({ v, st: 'rHead' as const })), 'head', 32);

  // Headings 1–6 with their group rows and lines, each closed by its sub-total.
  const subRow = new Map<string, number>(), lineRow = new Map<string, number>();
  for (const h of ['1', '2', '3', '4', '5', '6']) {
    // The template's lines and groups, plus the project's own lines; a parent of project lines is shown as a group row
    // only when the template has it (as a group or as a line now broken down), so e.g. 5.5 never appears.
    const mine = leafs.filter((l) => l.code.split('.')[0] === h).map((l) => l.code);
    const std = STANDARD.map(([c]) => c).filter((c) => c.split('.')[0] === h && !mine.some((m) => c.startsWith(m + '.')));
    const parents = mine.flatMap((c) => c.split('.').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('.'))).filter((c) => STD.has(c));
    const codes = [...new Set([...std, ...mine, ...parents])].sort(byNum);
    const first = rows.length + 1;
    for (const code of codes) {
      const isGroup = !leafBy.has(code) && (STD_GROUP.has(code) || mine.some((m) => m.startsWith(code + '.')));
      const r = rows.length + 1, row = blank();
      row[0] = { v: `${code} ${desc(code)}`.trim(), st: code === h ? 'rLabB' : 'rLab' };
      if (isGroup) { for (let i = 1; i < W; i++) row[i] = { st: 'rLab' }; push(row, 'group', 15, code); continue; }
      // A template line the project has not budgeted keeps its formulas and input cells, with empty amounts.
      const empty = !leafBy.has(code);
      const l: BudgetLine = leafBy.get(code) ?? { code, description: desc(code), unit: STD.get(code)?.u, approved: 0, actual: 0 } as BudgetLine;
      const F = (c: number) => `${col(c)}${r}`;
      const units = l.approvedUnits, rate = l.unitRate, budget = n(l.approved);
      const aUnits = l.reportedUnits, actual = n(l.actual), sc = lineExposure(l);
      const aRate = aUnits ? actual / aUnits : l.reportedUnitRate ?? 0;
      const staff = isStaff(code), finance = staff || isChargeBack(code), inSt = finance ? 'rIn' : 'rInY';
      row[C.unit] = { v: l.unit ?? '', st: 'rUnit' };
      row[C.units] = { v: units ?? undefined, st: 'rNum' }; row[C.rate] = { v: rate ?? undefined, st: 'rNum' };
      row[C.cost] = units != null && rate != null && Math.abs(units * rate - budget) < 1 ? { f: `IF(ISBLANK(${F(C.units)}),"",${F(C.units)}*${F(C.rate)})`, v: budget, st: 'rNum' } : { v: budget, st: 'rNum' };
      row[C.aUnits] = { v: aUnits ?? 0, st: 'rNum' };
      row[C.aRate] = aUnits ? { f: `${F(C.actual)}/${F(C.aUnits)}`, v: aRate, st: 'rNum' } : { v: aRate, st: 'rNum' };
      row[C.actual] = { v: actual, st: 'rNum' }; row[C.sc] = { v: sc, st: 'rNum' };
      // Planned rates start from what is known: staff at the latest cost plus the guideline margin, charging back at the
      // latest monthly rate, activities at the budget rate. Units are typed in.
      const pr = staff ? staffRate(code, aRate || rate || 0, monthsLeft) || undefined : isChargeBack(code) ? (aRate ? Math.round(aRate) : rate ?? undefined) : rate ?? undefined;
      row[C.pUnits] = { st: inSt }; row[C.pRate] = { v: pr, st: inSt };
      row[C.planned] = { f: `+${F(C.pRate)}*${F(C.pUnits)}`, v: 0, st: 'rNum' };
      row[C.rUnits] = { st: inSt }; row[C.rRate] = { v: pr, st: inSt };
      row[C.rCost] = { f: `+${F(C.rRate)}*${F(C.rUnits)}`, v: 0, st: 'rNum' };
      // Staff lines build the proposal on what is spent; other lines on spent and committed (as in the template).
      const qU = staff ? (aUnits ?? 0) : aRate ? Math.round(sc / aRate) : rate && sc ? Math.round(sc / rate) : 0, qC = staff ? actual : sc;
      row[C.qUnits] = staff ? { f: `${F(C.aUnits)}+${F(C.pUnits)}+${F(C.rUnits)}`, v: qU, st: 'rNum' }
        : { f: `+IF(${F(C.aRate)}<>0,ROUND(${F(C.sc)}/${F(C.aRate)},0)+${F(C.pUnits)}+${F(C.rUnits)},IF(AND(${F(C.rate)}>0,${F(C.sc)}<>0),ROUND(${F(C.sc)}/${F(C.rate)},0)+${F(C.pUnits)}+${F(C.rUnits)},${F(C.pUnits)}+${F(C.rUnits)}))`, v: qU, st: 'rNum' };
      row[C.proposal] = { f: staff ? `${F(C.actual)}+${F(C.planned)}+${F(C.rCost)}` : `+${F(C.sc)}+${F(C.planned)}+${F(C.rCost)}`, v: qC, st: 'rNum' };
      row[C.qRate] = { f: `+IF(${F(C.qUnits)}>0,${F(C.proposal)}/${F(C.qUnits)},0)`, v: qU > 0 ? qC / qU : 0, st: 'rNum' };
      row[C.sUnits] = { f: `+${F(C.qUnits)}`, v: qU, st: 'rNum' };
      row[C.sRate] = { f: `+ROUND(${F(C.qRate)},0)`, v: qU > 0 ? Math.round(qC / qU) : 0, st: 'rNum' };
      row[C.rounded] = { f: `+${F(C.sRate)}*${F(C.sUnits)}`, v: qU > 0 ? Math.round(qC / qU) * qU : 0, st: 'rNum' };
      if (empty) for (const c of [C.units, C.rate, C.cost, C.aUnits, C.aRate, C.actual, C.sc]) row[c] = { st: 'rNum' };
      push(row, 'line', 15, code); lineRow.set(code, r);
      row[C.vari] = variation(r, 'rPct');
    }
    const last = rows.length, r = last + 1, row = blank('rSubN');
    row[0] = { v: `Sub-total ${h} ${STD.get(h)?.d ?? HEADINGS[h] ?? names[h] ?? ''}`.trim(), st: 'rSubL' };
    for (const c of SUMMED) {
      const v = rows.slice(first - 1, last).reduce((a, x) => a + (typeof (x[c] as XCell)?.v === 'number' ? (x[c] as XCell).v as number : 0), 0);
      row[c] = { f: `SUM(${col(c)}${first}:${col(c)}${last})`, v, st: 'rSubN' };
    }
    push(row, 'sub', 15, h); subRow.set(h, r);
    row[C.vari] = variation(r, 'rPctB');
  }

  // 7–11 in the wording of the template.
  const line = (label: string, cell: (c: number) => XCell | undefined, bold = true) => {
    push(blank(), 'blank', 15);
    const r = rows.length + 1, row = blank(bold ? 'rSubN' : undefined);
    row[0] = { v: label, st: bold ? 'rSubL' : 'rLab' };
    for (const c of SUMMED) { const x = cell(c); if (x) row[c] = { st: bold ? 'rSubN' : 'rNum', ...x }; }
    push(row, 'total', 15); if (val(r, C.cost)) row[C.vari] = variation(r, bold ? 'rPctB' : 'rPct');
    return r;
  };
  const subs = [...subRow.values()];
  const r7 = line('7. Sub-total Direct eligible costs of the action (1+2+3+4+5+6)', (c) => ({ f: subs.map((r) => `${col(c)}${r}`).join('+'), v: subs.reduce((a, r) => a + val(r, c), 0) }));
  const cont = L.filter((l) => /^8(\.|$)/.test(l.code) && !L.some((o) => o !== l && o.code.startsWith(l.code + '.')));
  const cv: Record<number, number> = { [C.cost]: cont.reduce((a, l) => a + n(l.approved), 0), [C.actual]: cont.reduce((a, l) => a + n(l.actual), 0), [C.sc]: cont.reduce((a, l) => a + lineExposure(l), 0) };
  const r8 = line('8. Provision for contingency reserve (maximum 5% of 7. Sub-total of direct eligible costs of the Action) ', (c) => (cont.length && cv[c] != null ? { v: cv[c] } : undefined), false);
  const r9 = line('9. Total direct eligible costs of the action (7 + 8)', (c) => ({ f: `${col(c)}${r7}+${col(c)}${r8}`, v: val(r7, c) + val(r8, c) }));
  const r10 = line('10. Administrative costs (maximum 7% of 9. Total direct eligible costs of the action)(3)', (c) => ({ f: `ROUND(${col(c)}${r9}*7/100,2)`, v: Math.round(val(r9, c) * 7) / 100 }), false);
  line('11. Total eligible costs (9 + 10)', (c) => ({ f: `${col(c)}${r9}+${col(c)}${r10}`, v: val(r9, c) + val(r10, c) }));

  // Footnotes
  push(blank(), 'blank', 15);
  const as = dmy(per.from);
  for (const text of [`(1) Expenditure accounted for in the Council of Europe financial records as of ${as}`,
    `(2) Committed activities not yet accounted for as expenditure in the CoE financial records as of ${as}`,
    '(3) A levy of 7% is applied in accordance with the CM decision (CM(2013)123) and adjusted in line with the actual expenditure as presented in this Interim Financial Report.']) {
    const row = blank(); row[0] = { v: text, st: 'rNote' }; const r = push(row, 'note', 15); merges.push(`A${r}:I${r}`);
  }

  // Summary by kind of cost (staff, activities, charging back) and the staff ratio.
  push(blank(), 'blank', 15);
  const hd = blank(); hd[0] = { v: 'Summary', st: 'rHead' };
  const SC = [C.cost, C.actual, C.sc, C.planned, C.rounded];
  ['Budget for all Years', 'Actual expenditure', 'Spent and committed', 'Planned expenditure (12 months + revision)', 'Budget proposal (Rounded version)'].forEach((x, i) => { hd[SC[i]] = { v: x, st: 'rHead' }; });
  push(hd, 'sum', 32);
  const rowsOf = (test: (code: string) => boolean) => [...lineRow].filter(([c]) => test(c)).map(([, r]) => r);
  const sumRef = (R: number[], c: number): XCell => {
    if (c === C.planned) return R.length ? { f: R.map((r) => `L${r}+O${r}`).join('+'), v: R.reduce((a, r) => a + val(r, C.planned) + val(r, C.rCost), 0) } : { v: 0 };
    return R.length ? { f: R.map((r) => `${col(c)}${r}`).join('+'), v: R.reduce((a, r) => a + val(r, c), 0) } : { v: 0 };
  };
  const sumRow = (label: string, R: number[] | ((c: number) => XCell), bold = false) => {
    const row = blank(); row[0] = { v: label, st: bold ? 'rSubL' : 'rLab' };
    for (const c of SC) row[c] = { st: bold ? 'rSubN' : 'rNum', ...(typeof R === 'function' ? R(c) : sumRef(R, c)) };
    return push(row, 'sum', 15);
  };
  const sLocal = sumRow('Staff local', rowsOf((c) => /^1\.1\.1\./.test(c)));
  const sHQ = sumRow('Staff HQ', rowsOf((c) => /^1\.2\.1\./.test(c)));
  const both = (a: number, b2: number) => (c: number): XCell => ({ f: `${col(c)}${a}+${col(c)}${b2}`, v: val(a, c) + val(b2, c) });
  const sStaff = sumRow('Total staff', both(sLocal, sHQ), true);
  const act = [
    sumRow('Consultants', rowsOf((c) => /^1\.[12]\.[23](\.|$)/.test(c))),
    sumRow('Per diem', rowsOf((c) => /^1\.3(\.|$)/.test(c))),
    sumRow('Travel', rowsOf((c) => c.split('.')[0] === '2')),
    sumRow('Equipment', rowsOf((c) => c.split('.')[0] === '3')),
    sumRow('Local office (without charging back)', rowsOf((c) => c.split('.')[0] === '4' && !isChargeBack(c))),
    sumRow('Other services', rowsOf((c) => c.split('.')[0] === '5')),
    sumRow('Grants', rowsOf((c) => c.split('.')[0] === '6')),
  ];
  const sAct = sumRow('Total activities', (c) => ({ f: act.map((r) => `${col(c)}${r}`).join('+'), v: act.reduce((a, r) => a + val(r, c), 0) }), true);
  const sCb = sumRow('Charging back (4.2 + 4.4)', rowsOf(isChargeBack));
  const sDir = sumRow('Total direct', (c) => ({ f: `${col(c)}${sStaff}+${col(c)}${sAct}+${col(c)}${sCb}`, v: val(sStaff, c) + val(sAct, c) + val(sCb, c) }), true);
  const ratio = blank(); ratio[0] = { v: 'Staff ratio (staff ÷ total direct)', st: 'rLabB' };
  for (const c of SC) { const d = val(sDir, c); ratio[c] = { f: `IF(${col(c)}${sDir}>0,${col(c)}${sStaff}/${col(c)}${sDir},"")`, v: d > 0 ? val(sStaff, c) / d : undefined, st: 'rPct' }; }
  push(ratio, 'sum', 15);

  const widths = [84, 15, 10.5, 13, 14.5, 10.5, 12.8, 14.5, 16.5, 10.5, 12.8, 14.5, 10.5, 12.8, 14.5, 10.5, 12.8, 14.5, 10.5, 12.8, 14.5, 10];
  const forecast: SheetSpec = { name: 'Forecast', rows, freeze: 4, merges, heights, landscape: true, widths };

  // Donor clean version: the rounded proposal against the contractual budget, linked to the Forecast sheet.
  const ref = (r: number, c: number, st: XCell['st']): XCell => ({ f: `Forecast!${col(c)}${r}`, v: (rows[r - 1][c] as XCell)?.v, st });
  const end = rows.findIndex((_, i) => kind[i] === 'note');
  const donor = (variation: boolean): SheetSpec => {
    const out: Row[] = [], hh: Record<number, number> = {}, mm: string[] = [];
    const w = variation ? 11 : 8, bl = (st?: XCell['st']): Row => Array.from({ length: w }, () => (st ? { st } : ''));
    const tt = bl(); tt[0] = { v: [p.name, `Contract n°${contract ?? ''}`, ident].join('\n'), st: 'rTitle' }; out.push(tt); hh[1] = 54; mm.push(`A1:${col(w - 1)}1`);
    out.push(bl());
    const prop = 'Budget proposal\nRevised (' + new Date(today).toLocaleString('en-GB', { month: 'short', year: '2-digit' }).toUpperCase().replace(' ', '-') + ') / addendum n° / notification n°';
    const g2 = bl('rHead'); g2[2] = { v: 'Budget for all Years\nContractual', st: 'rHead' };
    if (variation) { g2[5] = { v: 'Variation\n(in EUR)', st: 'rHead' }; g2[6] = { v: prop, st: 'rHead' }; g2[9] = { v: 'Variation', st: 'rHead' }; g2[10] = { v: 'Justification', st: 'rHead' }; mm.push('C3:E3', 'F3:F4', 'G3:I3', 'J3:J4', 'K3:K4'); }
    else { g2[5] = { v: prop, st: 'rHead' }; mm.push('C3:E3', 'F3:H3'); }
    out.push(g2); hh[3] = 48;
    const s2 = ['Description', 'Unit', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', ...(variation ? ['', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', '', ''] : ['# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)'])];
    out.push(s2.map((v) => ({ v, st: 'rHead' as const }))); hh[4] = 32;
    for (let i = 4; i < end; i++) {
      const r = i + 1, k = kind[i], src = rows[i], row = bl();
      if (k === 'blank') { out.push(row); continue; }
      const bold = k === 'sub' || (k === 'total' && (src[0] as XCell).st === 'rSubL'), num = bold ? 'rSubN' : 'rNum';
      row[0] = { v: (src[0] as XCell).v, st: bold ? 'rSubL' : k === 'group' && codeAt[i].length === 1 ? 'rLabB' : 'rLab' };
      for (let c = 1; c < w; c++) row[c] = { st: k === 'group' ? 'rLab' : num };
      if (k === 'group') { out.push(row); continue; }
      if (k === 'line') { row[1] = { v: (src[C.unit] as XCell).v, st: 'rUnit' }; row[2] = ref(r, C.units, num); row[3] = ref(r, C.rate, num); }
      row[4] = ref(r, C.cost, num);
      const o = variation ? 6 : 5;
      if (k === 'line') { row[o] = ref(r, C.sUnits, num); row[o + 1] = ref(r, C.sRate, num); }
      row[o + 2] = ref(r, C.rounded, num);
      if (variation) {
        const R = out.length + 1, e = val(r, C.cost), u = val(r, C.rounded);
        row[5] = { f: `+I${R}-E${R}`, v: u - e, st: num };
        row[9] = { f: `+IF(E${R}>0,F${R}/E${R},"")`, v: e > 0 ? (u - e) / e : undefined, st: bold ? 'rPctB' : 'rPct' };
        row[10] = k === 'line' || k === 'sub' ? { st: 'rInY' } : { st: num };
      }
      out.push(row); hh[out.length] = 15;
    }
    return { name: variation ? 'variation' : 'Budget presentation', rows: out, freeze: 4, merges: mm, heights: hh, landscape: true,
      widths: variation ? [84, 15, 10.5, 12.8, 14.5, 14.5, 10.5, 12.8, 14.5, 10, 60] : [84, 15, 10.5, 12.8, 14.5, 10.5, 12.8, 14.5] };
  };
  return [forecast, donor(false), donor(true)];
}
export type { BudgetLine };
