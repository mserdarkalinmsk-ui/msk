import { HEADINGS, latestReport, lineExposure, lines, n, parseDate } from './calc';
import type { BudgetLine, Project } from './types';
import type { Cell, SheetSpec, XCell } from '../ui/xlsxwrite';

/**
 * Forecast workbooks following the CoE "Templates for reporting and forecasting" and the forecast guidelines:
 *  - payment    JP "if budget revision with payment": next 12 months (instalment) + planned to the end (revision)
 *  - twelve     JP "Report with the 12-month forecast": next 12 months only
 *  - revision   JP/VC "budget revision and extension": planned to the end (or to the extended end)
 *  - extension  JP/VC "Extension with details": planned to the end (savings), then the extension period
 * Columns A–I come from the latest report; then blocks of planned expenditure (green cells for finance — staff and
 * charging back 4.2/4.4 — yellow ones for the project team), the budget proposal calculated and rounded, and the
 * indicative variation. Donor sheets ("Budget presentation", "variation") are linked to the rounded proposal.
 * Loaded back through Import, the Forecast sheet is read like any financial report with a forecast.
 */
export type ForecastKind = 'payment' | 'twelve' | 'revision' | 'extension';
export interface ForecastOptions {
  kind: ForecastKind;
  programme: 'JP' | 'VC';
  /** new end date when the project is extended */ extendTo?: string;
  /** JP: notification or addendum, with its number */ change?: 'notification' | 'addendum'; changeNo?: string;
  /** line that takes the rounding so the rounded proposal keeps the direct budget (5.7 by default in the app) */ balance?: string;
}
export const FORECAST_KINDS: Record<ForecastKind, { label: string; hint: string; programmes: ('JP' | 'VC')[] }> = {
  payment: { label: 'Budget revision with payment', hint: 'Next 12 months for the next instalment + planned expenditure to the end for a budget revision (with the annual report)', programmes: ['JP'] },
  twelve: { label: '12-month forecast', hint: 'Next 12 months only — for the JP unit to calculate the next instalment', programmes: ['JP'] },
  revision: { label: 'Budget revision and extension', hint: 'Planned expenditure to the end (or to the new end date) — simple revision of the budget', programmes: ['JP', 'VC'] },
  extension: { label: 'Extension with details', hint: 'Planned expenditure to the current end (savings), then the extension period', programmes: ['JP', 'VC'] },
};

const dmy = (d: string) => { const [y, m, dd] = d.slice(0, 10).split('-'); return `${dd}/${m}/${y}`; };
const addDays = (d: string, k: number) => new Date(parseDate(d).getTime() + k * 864e5).toISOString().slice(0, 10);
const addMonths = (d: string, k: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCMonth(x.getUTCMonth() + k); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
const col = (i: number): string => (i >= 26 ? col(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));
const monYY = (d: Date) => d.toLocaleString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }).toUpperCase().replace(' ', '-');
// A description · B unit · C–E budget · F–H actual · I spent and committed; the blocks follow from J.
const C = { unit: 1, units: 2, rate: 3, cost: 4, aUnits: 5, aRate: 6, actual: 7, sc: 8 };
const MONTH = 30.44 * 864e5;
/** Staff lines (salaries) and charging back (4.2 office rent, 4.4 office furniture) are prepared by finance. */
const isStaff = (code: string) => /^1\.[12]\.1\./.test(code);
const isChargeBack = (code: string) => code === '4.2' || code === '4.4';

export function defaultOptions(p: Project): ForecastOptions {
  return { kind: p.jp ? 'payment' : 'revision', programme: p.jp ? 'JP' : 'VC' };
}

export function forecastPeriod(p: Project, today: Date, o: ForecastOptions = defaultOptions(p)) {
  const r = latestReport(p), asAt = (r?.snapshot?.workbook?.meta.asAt || r?.date || today.toISOString()).slice(0, 10);
  const from = addDays(asAt, 1);
  const months = Number((p.contract as { repMonths?: number } | undefined)?.repMonths) || 12;
  const to12 = addMonths(from, months) > p.end ? p.end : addMonths(from, months);
  const ext = o.extendTo && o.extendTo > p.end ? o.extendTo : undefined;
  // First block: 12 months (payment, twelve) or to the end (revision: to the new end when extended; extension: to the current end).
  const to = o.kind === 'payment' || o.kind === 'twelve' ? to12 : o.kind === 'revision' ? ext ?? p.end : p.end;
  // A project ending within the 12 months has no period left after them: the revision columns cover the same months.
  const short = to12 >= p.end;
  return { asAt, from, to, revFrom: short ? from : addDays(to12, 1), revTo: p.end, extFrom: addDays(p.end, 1), extTo: ext, short, months };
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
export const STANDARD_LINES = STANDARD;
const STD = new Map(STANDARD.map(([c, d, u]) => [c, { d, u }]));
const STD_GROUP = new Set(STANDARD.filter(([, , u]) => !u).map(([c]) => c));

/**
 * A block of three columns (# of units, unit rate, cost):
 *  input  typed in (green/yellow), cost = rate × units
 *  calc   what is spent (staff) or spent and committed (others) plus the listed input blocks
 *  sum    the sum of earlier blocks (extension: savings + extension)
 *  round  the rounded version of a calculated block
 */
type Block = { id: string; type: 'input' | 'calc' | 'sum' | 'round'; head: string; of?: string[] };

function blocksFor(o: ForecastOptions, per: ReturnType<typeof forecastPeriod>, title: string): Block[] {
  const twelve = per.short ? '(to the end of the project)' : `(${per.months} months)`;
  if (o.kind === 'twelve') return [{ id: 'p', type: 'input', head: `Planned expenditure \nfrom ${dmy(per.from)} to ${dmy(per.to)} ${twelve}` }];
  if (o.kind === 'payment') return [
    { id: 'p', type: 'input', head: `Planned expenditure \nfrom ${dmy(per.from)} to ${dmy(per.to)} ${twelve}` },
    { id: 'r', type: 'input', head: `Planned expenditure \nfrom ${dmy(per.revFrom)} to ${dmy(per.revTo)} (for budget revision)` },
    { id: 'q', type: 'calc', head: 'Budget proposal\n(calculated)', of: ['p', 'r'] },
    { id: 's', type: 'round', head: `Budget proposal\n(Rounded version)${title}`, of: ['q'] },
  ];
  if (o.kind === 'revision') return [
    { id: 'p', type: 'input', head: `Planned expenditure \nfrom ${dmy(per.from)} to ${dmy(per.to)} (for budget revision${per.extTo ? '/extension' : ''})` },
    { id: 'q', type: 'calc', head: 'Budget proposal\n(calculated)', of: ['p'] },
    { id: 's', type: 'round', head: `Budget proposal\n(Rounded version)${per.extTo ? `\nWith extension until ${dmy(per.extTo)}` : ''}${title}`, of: ['q'] },
  ];
  return [
    { id: 'p', type: 'input', head: `Planned expenditure \nfrom ${dmy(per.from)} to ${dmy(per.to)} (end of the project)` },
    { id: 'm', type: 'calc', head: 'Budget proposal\n(savings)', of: ['p'] },
    { id: 'e', type: 'input', head: `Planned expenditure \nfrom ${dmy(per.extFrom)} to ${per.extTo ? dmy(per.extTo) : '../../..'} (for extension)` },
    { id: 'q', type: 'sum', head: 'Budget proposal\n(calculated)', of: ['m', 'e'] },
    { id: 's', type: 'round', head: `Budget proposal\n(Rounded version)\nWith extension until ${per.extTo ? dmy(per.extTo) : '../../..'}${title}`, of: ['q'] },
  ];
}

type Row = (Cell | XCell)[];
/** Planned units and rates typed in the app (see forecastPlan), written into the input cells. */
export type DraftLines = Record<string, Partial<Record<string, { u?: number; r?: number }>>>;
/**
 * working  every sheet, everything visible (finance)
 * team     guidelines step 7: the rounded proposal and the variation columns hidden before it goes to the project team
 * donor    guidelines steps 9–10: "Budget presentation" and "variation" with values only, the Forecast sheet hidden
 */
export type ForecastMode = 'working' | 'team' | 'donor';
export function forecastSheets(p: Project, today: Date, o: ForecastOptions = defaultOptions(p), draft?: DraftLines, mode: ForecastMode = 'working'): SheetSpec[] {
  const per = forecastPeriod(p, today, o), L = lines(p);
  const monthsLeft = Math.max(0, (parseDate(per.extTo ?? p.end).getTime() - parseDate(per.from).getTime()) / MONTH);
  const names = p.approvedBudget?.names ?? {};
  const isSpecial = (c: string) => c === '10' || /^8(\.|$)/.test(c);
  const leafs = L.filter((l) => !isSpecial(l.code) && !L.some((x) => x !== l && x.code.startsWith(l.code + '.')));
  const leafBy = new Map(leafs.map((l) => [l.code, l]));
  const desc = (c: string) => leafBy.get(c)?.description || (!c.includes('.') && STD.get(c)?.d) || names[c] || STD.get(c)?.d || (c.includes('.') ? '' : HEADINGS[c] ?? '');
  const byNum = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
  const contract = p.contractNo || (p.contract as { number?: string } | undefined)?.number;
  const jp = o.programme === 'JP';
  const ident = [jp ? (p.jp || p.pmm ? `JP ${p.jp ?? p.pmm}` : '') : (p.pmm || p.jp ? `VC ${p.pmm ?? p.jp}` : ''), p.bh ? `BH ${p.bh}` : ''].filter(Boolean).join(' - ');
  const titleLines = [p.name, ...(jp ? [`Contract n°${contract ?? ''}`] : []), ident];
  // How the revised budget is named (guidelines, step 8): VCs "Revised (MON-YY)"; JPs "Notification n°" or "Addendum n°".
  const revised = jp ? (o.change ? `${o.change === 'addendum' ? 'Addendum' : 'Notification'} n°${o.changeNo ?? '..'}` : '') : `Revised (${monYY(today)})`;
  const B = blocksFor(o, per, revised ? `\n${revised}` : '');
  const at = new Map<string, number>(); B.forEach((b, i) => at.set(b.id, 9 + i * 3));
  const roundB = B.find((b) => b.type === 'round');
  const vari = roundB && (jp || o.kind !== 'revision') ? 9 + B.length * 3 : -1; // VC "budget revision and extension" has no variation column
  const W = 9 + B.length * 3 + (vari >= 0 ? 1 : 0);
  const costCols = [C.cost, C.actual, C.sc, ...B.map((b) => at.get(b.id)! + 2)];
  const inputs = B.filter((b) => b.type === 'input');

  const rows: Row[] = [], heights: Record<number, number> = {}, merges: string[] = [];
  const kind: ('title' | 'band' | 'head' | 'group' | 'line' | 'sub' | 'total' | 'blank' | 'note' | 'sum')[] = [];
  const codeAt: string[] = [];
  const blank = (st?: XCell['st']): Row => Array.from({ length: W }, () => (st ? { st } : ''));
  const push = (r: Row, k: (typeof kind)[number], h?: number, code = '') => { rows.push(r); kind.push(k); codeAt.push(code); if (h) heights[rows.length] = h; return rows.length; };
  const val = (r: number, c: number) => { const x = rows[r - 1]?.[c] as XCell | undefined; return typeof x?.v === 'number' ? x.v : 0; };
  const rc = roundB ? at.get(roundB.id)! + 2 : -1;
  const variation = (r: number, st: XCell['st']): XCell => { const e = val(r, C.cost), u = val(r, rc); return { f: `+IF(E${r}>0,(${col(rc)}${r}-E${r})/E${r},"")`, v: e > 0 ? (u - e) / e : undefined, st }; };

  // 1–4: title, instructions band (payment), column groups and sub-headers
  const t = blank(); t[0] = { v: titleLines.join('\n'), st: 'rTitle' }; push(t, 'title', 18 * titleLines.length); merges.push(`A1:${col(vari >= 0 ? W - 2 : W - 1)}1`);
  const band = blank();
  if (o.kind === 'payment') {
    const p0 = at.get('p')!, r0 = at.get('r')!;
    band[p0] = { v: 'MANDATORY FOR DETERMINING THE AMOUNT OF THE NEXT INSTALMENT PAYMENT TO BE REQUESTED WITH THE ANNUAL OFFICIAL REPORT', st: 'rBan' };
    band[r0] = { v: 'TO BE FILLED OUT ONLY IF PROJECT TEAMS ARE REQUESTING A BUDGET REVISION (ADDENDUM/NOTIFICATION)', st: 'rBan' };
    for (const c of [p0 + 1, p0 + 2, r0 + 1, r0 + 2]) band[c] = { st: 'rBan' };
    merges.push(`${col(p0)}2:${col(p0 + 2)}2`, `${col(r0)}2:${col(r0 + 2)}2`);
  }
  push(band, 'band', o.kind === 'payment' ? 115 : 15);
  const g = blank('rHead');
  g[C.units] = { v: jp ? 'Budget for all Years\nContractual' : 'Budget for all Years', st: 'rHead' };
  g[C.aUnits] = { v: `Actual expenditure\nas at ${dmy(per.asAt)}`, st: 'rHead' };
  g[C.sc] = { v: 'Spent and\ncommitted(2)\n(in EUR)', st: 'rHead' };
  for (const b of B) { const c = at.get(b.id)!; g[c] = { v: b.head, st: 'rHead' }; merges.push(`${col(c)}3:${col(c + 2)}3`); }
  if (vari >= 0) { g[vari] = { v: 'Indicative \nVariation', st: 'rHead' }; merges.push(`${col(vari)}3:${col(vari)}4`); }
  push(g, 'head', 60); merges.push('C3:E3', 'F3:H3', 'I3:I4');
  const sub: string[] = ['Description', 'Unit', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', '# of units', 'Unit rate \n(in EUR)', 'Spent(1)\n(in EUR)', ''];
  for (let i = 0; i < B.length; i++) sub.push('# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)');
  if (vari >= 0) sub.push('');
  push(sub.map((v) => ({ v, st: 'rHead' as const })), 'head', 32);

  // Headings 1–6 with their group rows and lines, each closed by its sub-total.
  const subRow = new Map<string, number>(), lineRow = new Map<string, number>();
  for (const h of ['1', '2', '3', '4', '5', '6']) {
    // The template's lines and groups plus the project's own lines; a parent of project lines is shown as a group row only
    // when the template has it, so e.g. 5.5 never appears and no template line is put under a project line.
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
      const staff = isStaff(code), cb = isChargeBack(code), inSt = staff || cb ? 'rIn' : 'rInY';
      row[C.unit] = { v: l.unit ?? '', st: 'rUnit' };
      if (empty) for (const c of [C.units, C.rate, C.cost, C.aUnits, C.aRate, C.actual, C.sc]) row[c] = { st: 'rNum' };
      else {
        row[C.units] = { v: units ?? undefined, st: 'rNum' }; row[C.rate] = { v: rate ?? undefined, st: 'rNum' };
        row[C.cost] = units != null && rate != null && Math.abs(units * rate - budget) < 1 ? { f: `IF(ISBLANK(${F(C.units)}),"",${F(C.units)}*${F(C.rate)})`, v: budget, st: 'rNum' } : { v: budget, st: 'rNum' };
        row[C.aUnits] = { v: aUnits ?? 0, st: 'rNum' };
        row[C.aRate] = aUnits ? { f: `${F(C.actual)}/${F(C.aUnits)}`, v: aRate, st: 'rNum' } : { v: aRate, st: 'rNum' };
        row[C.actual] = { v: actual, st: 'rNum' }; row[C.sc] = { v: sc, st: 'rNum' };
      }
      // Planned rates start from what is known: staff at the latest cost plus the guideline margin, charging back at the
      // latest monthly rate, activities at the budget rate. Units are typed in.
      const pr = staff ? staffRate(code, aRate || rate || 0, monthsLeft) || undefined : cb ? (aRate ? Math.round(aRate) : rate ?? undefined) : rate ?? undefined;
      const cv = new Map<string, { u: number; c: number }>(); // cached units and cost per block
      for (const b of B) {
        const c = at.get(b.id)!, U = F(c), R = F(c + 1), K = F(c + 2);
        if (b.type === 'input') {
          const dc = draft?.[code]?.[b.id], du = dc?.u || undefined, dr = dc?.r ?? pr;
          row[c] = { v: du, st: inSt }; row[c + 1] = { v: dr, st: inSt }; row[c + 2] = { f: `+${R}*${U}`, v: (du ?? 0) * (dr ?? 0), st: 'rNum' }; cv.set(b.id, { u: du ?? 0, c: (du ?? 0) * (dr ?? 0) });
        } else if (b.type === 'calc') {
          // Staff build on what is spent; charging back on its units and spent + committed; others on spent and committed.
          const add = (b.of ?? []).map((id) => at.get(id)!);
          const plusU = add.map((x) => `+${col(x)}${r}`).join(''), plusC = add.map((x) => `+${col(x + 2)}${r}`).join('');
          const ins = (b.of ?? []).map((id) => cv.get(id) ?? { u: 0, c: 0 });
          const u0 = (staff || cb ? (aUnits ?? 0) : aRate ? Math.round(sc / aRate) : rate && sc ? Math.round(sc / rate) : 0) + ins.reduce((a, x) => a + x.u, 0);
          const c0 = (staff ? actual : sc) + ins.reduce((a, x) => a + x.c, 0);
          row[c] = staff || cb ? { f: `${F(C.aUnits)}${plusU}`, v: u0, st: 'rNum' }
            : { f: `+IF(${F(C.aRate)}<>0,ROUND(${F(C.sc)}/${F(C.aRate)},0)${plusU},IF(AND(${F(C.rate)}>0,${F(C.sc)}<>0),ROUND(${F(C.sc)}/${F(C.rate)},0)${plusU},0${plusU}))`, v: u0, st: 'rNum' };
          row[c + 2] = { f: `${staff ? F(C.actual) : F(C.sc)}${plusC}`, v: c0, st: 'rNum' };
          row[c + 1] = { f: `+IF(${U}>0,${K}/${U},0)`, v: u0 > 0 ? c0 / u0 : 0, st: 'rNum' };
          cv.set(b.id, { u: u0, c: c0 });
        } else if (b.type === 'sum') {
          const of = (b.of ?? []).map((id) => at.get(id)!), u0 = (b.of ?? []).reduce((a, id) => a + (cv.get(id)?.u ?? 0), 0), c0 = (b.of ?? []).reduce((a, id) => a + (cv.get(id)?.c ?? 0), 0);
          row[c] = { f: '+' + of.map((x) => `${col(x)}${r}`).join('+'), v: u0, st: 'rNum' };
          row[c + 2] = { f: '+' + of.map((x) => `${col(x + 2)}${r}`).join('+'), v: c0, st: 'rNum' };
          row[c + 1] = { f: `+IF(${U}>0,${K}/${U},0)`, v: u0 > 0 ? c0 / u0 : 0, st: 'rNum' };
          cv.set(b.id, { u: u0, c: c0 });
        } else {
          const s = at.get(b.of![0])!, q = cv.get(b.of![0])!, rate0 = q.u > 0 ? Math.round(q.c / q.u) : 0;
          row[c] = { f: `+${col(s)}${r}`, v: q.u, st: 'rNum' };
          row[c + 1] = { f: `+ROUND(${col(s + 1)}${r},0)`, v: rate0, st: 'rNum' };
          row[c + 2] = { f: `+${R}*${U}`, v: rate0 * q.u, st: 'rNum' };
          cv.set(b.id, { u: q.u, c: rate0 * q.u });
        }
      }
      push(row, 'line', 15, code); lineRow.set(code, r);
      if (vari >= 0) row[vari] = variation(r, 'rPct');
    }
    const last = rows.length, r = last + 1, row = blank('rSubN');
    row[0] = { v: `Sub-total ${h} ${STD.get(h)?.d ?? HEADINGS[h] ?? names[h] ?? ''}`.trim(), st: 'rSubL' };
    for (const c of costCols) {
      const v = rows.slice(first - 1, last).reduce((a, x) => a + (typeof (x[c] as XCell)?.v === 'number' ? (x[c] as XCell).v as number : 0), 0);
      row[c] = { f: `SUM(${col(c)}${first}:${col(c)}${last})`, v, st: 'rSubN' };
    }
    push(row, 'sub', 15, h); subRow.set(h, r);
    if (vari >= 0) row[vari] = variation(r, 'rPctB');
  }

  // The balance line takes the rounding of the other lines: the rounded proposal then equals the direct budget exactly.
  const plugRow = o.balance && roundB ? lineRow.get(o.balance) : undefined;
  if (plugRow) {
    const L2 = [...lineRow.values()], target = L2.reduce((a, r) => a + val(r, C.cost), 0), others = L2.reduce((a, r) => a + (r === plugRow ? 0 : val(r, rc)), 0);
    const v = Math.round((target - others) * 100) / 100, row = rows[plugRow - 1], old = val(plugRow, rc), U = `${col(rc - 2)}${plugRow}`, K = `${col(rc)}${plugRow}`;
    const slack = L2.reduce((a, r) => a + Math.abs(val(r, rc - 2)) * 0.5, 0) + 1;
    if (v >= 0 && Math.abs(v - old) <= slack) {
      row[rc] = { v, st: 'rNum' }; row[rc - 1] = { f: `+IF(${U}>0,${K}/${U},0)`, v: val(plugRow, rc - 2) > 0 ? v / val(plugRow, rc - 2) : 0, st: 'rNum' };
      if (vari >= 0) row[vari] = variation(plugRow, 'rPct');
      const h = o.balance!.split('.')[0], sr = subRow.get(h); if (sr) { (rows[sr - 1][rc] as XCell).v = val(sr, rc) - old + v; if (vari >= 0) rows[sr - 1][vari] = variation(sr, 'rPctB'); }
    }
  }

  // 7–11 in the wording of the template.
  const line = (label: string, cell: (c: number) => XCell | undefined, bold = true) => {
    push(blank(), 'blank', 15);
    const r = rows.length + 1, row = blank(bold ? 'rSubN' : undefined);
    row[0] = { v: label, st: bold ? 'rSubL' : 'rLab' };
    for (const c of costCols) { const x = cell(c); if (x) row[c] = { st: bold ? 'rSubN' : 'rNum', ...x }; }
    push(row, 'total', 15); if (vari >= 0 && val(r, C.cost)) row[vari] = variation(r, bold ? 'rPctB' : 'rPct');
    return r;
  };
  const subs = [...subRow.values()];
  const r7 = line('7. Sub-total Direct eligible costs of the action (1+2+3+4+5+6)', (c) => ({ f: subs.map((r) => `${col(c)}${r}`).join('+'), v: subs.reduce((a, r) => a + val(r, c), 0) }));
  const cont = L.filter((l) => /^8(\.|$)/.test(l.code) && !L.some((x) => x !== l && x.code.startsWith(l.code + '.')));
  const contV: Record<number, number> = { [C.cost]: cont.reduce((a, l) => a + n(l.approved), 0), [C.actual]: cont.reduce((a, l) => a + n(l.actual), 0), [C.sc]: cont.reduce((a, l) => a + lineExposure(l), 0) };
  const r8 = line('8. Provision for contingency reserve (maximum 5% of 7. Sub-total of direct eligible costs of the Action) ', (c) => (cont.length && contV[c] != null ? { v: contV[c] } : undefined), false);
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
  if (roundB) {
    push(blank(), 'blank', 15);
    const pc = inputs.map((b) => at.get(b.id)! + 2);
    const SC = [C.cost, C.actual, C.sc, pc[0], rc];
    const hd = blank(); hd[0] = { v: 'Summary', st: 'rHead' };
    ['Budget for all Years', 'Actual expenditure', 'Spent and committed', 'Planned expenditure (all planned columns)', 'Budget proposal (Rounded version)'].forEach((x, i) => { hd[SC[i]] = { v: x, st: 'rHead' }; });
    push(hd, 'sum', 32);
    const rowsOf = (test: (code: string) => boolean) => [...lineRow].filter(([c]) => test(c)).map(([, r]) => r);
    const sumRef = (R: number[], c: number): XCell => {
      if (c === pc[0]) return R.length ? { f: R.map((r) => pc.map((x) => `${col(x)}${r}`).join('+')).join('+'), v: R.reduce((a, r) => a + pc.reduce((s, x) => s + val(r, x), 0), 0) } : { v: 0 };
      return R.length ? { f: R.map((r) => `${col(c)}${r}`).join('+'), v: R.reduce((a, r) => a + val(r, c), 0) } : { v: 0 };
    };
    const sumRow = (label: string, R: number[] | ((c: number) => XCell), bold = false) => {
      const row = blank(); row[0] = { v: label, st: bold ? 'rSubL' : 'rLab' };
      for (const c of SC) row[c] = { st: bold ? 'rSubN' : 'rNum', ...(typeof R === 'function' ? R(c) : sumRef(R, c)) };
      return push(row, 'sum', 15);
    };
    const both = (a: number, b2: number) => (c: number): XCell => ({ f: `${col(c)}${a}+${col(c)}${b2}`, v: val(a, c) + val(b2, c) });
    const sLocal = sumRow('Staff local', rowsOf((c) => /^1\.1\.1\./.test(c)));
    const sHQ = sumRow('Staff HQ', rowsOf((c) => /^1\.2\.1\./.test(c)));
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
  }

  const widths = [84, 15, 10.5, 13, 14.5, 10.5, 12.8, 14.5, 16.5, ...B.flatMap(() => [10.5, 12.8, 14.5]), ...(vari >= 0 ? [10] : [])];
  const forecast: SheetSpec = { name: 'Forecast', rows, freeze: 4, merges, heights, landscape: true, widths,
    ...(mode === 'team' && roundB ? { hiddenCols: [rc - 2, rc - 1, rc, ...(vari >= 0 ? [vari] : [])] } : {}) };
  if (!roundB) return [forecast];

  // Donor clean version: the rounded proposal against the contractual budget, linked to the Forecast sheet.
  const ref = (r: number, c: number, st: XCell['st']): XCell => ({ f: `Forecast!${col(c)}${r}`, v: (rows[r - 1][c] as XCell)?.v, st });
  const end = rows.findIndex((_, i) => kind[i] === 'note');
  const prop = `Budget proposal\n${per.extTo ? `with extension until ${dmy(per.extTo)} / ` : ''}${revised || 'Revised / addendum n° / notification n°'}`;
  const donor = (variation: boolean): SheetSpec => {
    const just = variation && jp; // the justification column is for JPs only
    const out: Row[] = [], hh: Record<number, number> = {}, mm: string[] = [];
    const w = variation ? (just ? 11 : 10) : 8, bl = (st?: XCell['st']): Row => Array.from({ length: w }, () => (st ? { st } : ''));
    const tt = bl(); tt[0] = { v: titleLines.join('\n'), st: 'rTitle' }; out.push(tt); hh[1] = 18 * titleLines.length; mm.push(`A1:${col(w - 1)}1`);
    out.push(bl());
    const g2 = bl('rHead'); g2[2] = { v: jp ? 'Budget for all Years\nContractual' : 'Budget for all Years', st: 'rHead' };
    if (variation) { g2[5] = { v: 'Variation\n(in EUR)', st: 'rHead' }; g2[6] = { v: prop, st: 'rHead' }; g2[9] = { v: 'Variation', st: 'rHead' }; mm.push('C3:E3', 'F3:F4', 'G3:I3', 'J3:J4'); if (just) { g2[10] = { v: 'Justification', st: 'rHead' }; mm.push('K3:K4'); } }
    else { g2[5] = { v: prop, st: 'rHead' }; mm.push('C3:E3', 'F3:H3'); }
    out.push(g2); hh[3] = 48;
    const s2 = ['Description', 'Unit', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', ...(variation ? ['', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', '', ...(just ? [''] : [])] : ['# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)'])];
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
      const o2 = variation ? 6 : 5;
      if (k === 'line') { row[o2] = ref(r, rc - 2, num); row[o2 + 1] = ref(r, rc - 1, num); }
      row[o2 + 2] = ref(r, rc, num);
      if (variation) {
        const R = out.length + 1, e = val(r, C.cost), u = val(r, rc);
        row[5] = { f: `+I${R}-E${R}`, v: u - e, st: num };
        row[9] = { f: `+IF(E${R}>0,F${R}/E${R},"")`, v: e > 0 ? (u - e) / e : undefined, st: bold ? 'rPctB' : 'rPct' };
        if (just) row[10] = k === 'line' || k === 'sub' ? { st: 'rInY' } : { st: num };
      }
      out.push(row); hh[out.length] = 15;
    }
    return { name: variation ? 'variation' : 'Budget presentation', rows: out, freeze: 4, merges: mm, heights: hh, landscape: true,
      widths: variation ? [84, 15, 10.5, 12.8, 14.5, 14.5, 10.5, 12.8, 14.5, 10, ...(just ? [60] : [])] : [84, 15, 10.5, 12.8, 14.5, 10.5, 12.8, 14.5] };
  };
  if (mode !== 'donor') return [forecast, donor(false), donor(true)];
  // The donor file carries values, not links to the working sheet; the Forecast sheet stays in it, hidden (best practice).
  const values = (s: SheetSpec): SheetSpec => ({ ...s, rows: s.rows.map((r) => r.map((c) => (c && typeof c === 'object' && 'f' in c && c.f && /Forecast!/.test(c.f) ? { v: c.v, st: c.st } : c))) });
  return [values(donor(false)), values(donor(true)), { ...forecast, name: 'FORECAST', hidden: true }];
}

/** The file name of the guidelines: BH…-JP(or VC)…-Country-IFR-Forecast request-MON-Year. */
export function forecastFileName(p: Project, country: string, today: Date, o: ForecastOptions = defaultOptions(p), mode: ForecastMode = 'working'): string {
  const per = forecastPeriod(p, today, o), d = new Date(per.from + 'T00:00:00Z');
  const id = o.programme === 'JP' ? (p.jp ? `JP${p.jp}` : p.code) : (p.pmm ? `VC${p.pmm}` : p.code);
  if (mode === 'donor') {
    // Guidelines step 9: VCs "Revised Budget proposal-Donor version", JPs "Revised Budget proposal-For notification n°/Addendum n°".
    const t = new Date(today), mon = t.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    const what = o.programme === 'VC' ? 'Revised Budget proposal-Donor version' : `Revised Budget proposal-For ${o.change === 'addendum' ? 'Addendum' : 'notification'} n°${o.changeNo ?? ''}`;
    return `${[p.bh && `BH${p.bh}`, id, country, what, mon, t.getUTCFullYear()].filter(Boolean).join('-')}.xlsx`;
  }
  const what = o.kind === 'twelve' ? '12-month forecast' : o.kind === 'payment' ? 'Forecast request' : o.kind === 'extension' ? 'Extension request' : 'Budget revision request';
  return `${[p.bh && `BH${p.bh}`, id, country, 'IFR', what, d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase(), d.getUTCFullYear()].filter(Boolean).join('-')}.xlsx`;
}
export type { BudgetLine };

export interface ReportLook { /** logo band (PNG) */ logo?: { png: Uint8Array; w: number; h: number }; /** signature blocks, one line each (name, title, unit, organisation) */ sign1?: string; sign2?: string }
/**
 * The interim financial report sheet in the layout of the REPORT tab: logo band, project name, contract and JP/BH
 * references, budget / actual / spent and committed per line, totals 7–11, the footnotes, the certification and the
 * two signature blocks. Built from the same rows as the Forecast sheet (columns A–I).
 */
export function ifrSheet(p: Project, today: Date, o: ForecastOptions = defaultOptions(p), look: ReportLook = {}): SheetSpec {
  const f = forecastSheets(p, today, { ...o, kind: 'twelve' })[0], per = forecastPeriod(p, today, { ...o, kind: 'twelve' });
  const W = 9, rows: Row[] = [], heights: Record<number, number> = {}, merges: string[] = [];
  const blank = (): Row => Array.from({ length: W }, () => '');
  const width = look.logo ? Math.min(880, 75 * look.logo.w / look.logo.h) : 0; // a banner spans A–I, a plain logo stays ~75 pt high
  const band = look.logo ? Math.ceil(width * look.logo.h / look.logo.w / 15) + 1 : 0;
  for (let i = 0; i < band; i++) rows.push(blank());
  const title = String((f.rows[0][0] as XCell).v ?? '').split('\n').filter(Boolean);
  for (const t of title) { const r = blank(); r[0] = { v: t, st: 'rTitle' }; rows.push(r); merges.push(`A${rows.length}:I${rows.length}`); heights[rows.length] = 20; }
  rows.push(blank());
  const off = rows.length - 2; // forecast rows 3… land after the title
  const lastNote = f.rows.findIndex((r) => String((r[0] as XCell)?.v ?? '').startsWith('(3)'));
  for (let i = 2; i <= lastNote; i++) rows.push(f.rows[i].slice(0, W));
  (rows[off + 2][0] as XCell) = { v: `Interim financial report covering period from ${dmy(p.start)} to ${dmy(per.asAt)}`, st: 'rHead' };
  for (const m of f.merges ?? []) {
    const x = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(m); if (!x || +x[2] < 3 || x[3].length > 1 || x[3] > 'I' || +x[2] > lastNote + 1) continue;
    merges.push(`${x[1]}${+x[2] + off}:${x[3]}${+x[4] + off}`);
  }
  for (const [r, h] of Object.entries(f.heights ?? {})) if (+r >= 3 && +r <= lastNote + 1) heights[+r + off] = h;
  rows.forEach((r, i) => { if (String((r[0] as XCell)?.v ?? '').startsWith('8. ')) heights[i + 1] = 28; });
  rows.push(blank(), blank());
  const cert = blank(), r0 = rows.length + 1;
  cert[0] = { v: 'Expenditure incurred is in accordance with the Council of Europe Financial Regulations, the costs are eligible under and have been incurred in line with the project budget set out in the Agreement.', st: 'rNote' };
  cert[4] = { v: 'The total eligible costs presented in this financial report match expenditure accounted for in the Council of Europe financial records.', st: 'rNote' };
  rows.push(cert); heights[r0] = 48; merges.push(`A${r0}:C${r0}`, `E${r0}:I${r0}`);
  rows.push(blank());
  const d = blank(); d[0] = 'Date:'; d[4] = 'Date:'; rows.push(d); rows.push(blank());
  const s1 = (look.sign1 ?? '').split('\n'), s2 = (look.sign2 ?? '').split('\n');
  for (let i = 0; i < Math.max(s1.length, s2.length, 4); i++) { const r = blank(); r[0] = i ? s1[i] ?? '' : { v: s1[0], st: 'bold' }; r[4] = i ? s2[i] ?? '' : { v: s2[0], st: 'bold' }; rows.push(r); }
  const widths = [75, 15, 10, 11.2, 12.5, 9.2, 9.9, 11.8, 12.4], across = widths.reduce((a, w) => a + (w * 7 + 5) * 0.75, 0);
  // One printed page; the logo centred above the title.
  return { name: 'REPORT', rows, freeze: 0, merges, heights, portrait: true, onePage: true, widths,
    ...(look.logo ? { image: { ...look.logo, width, x: Math.max(0, (across - width) / 2) } } : {}) };
}
