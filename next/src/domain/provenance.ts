import { burnGap, elapsed, forecastRate, HEADINGS, latestReport, lineCommitted, lineExposure, lines, money, n } from './calc';
import { isExtraction } from './extraction';
import { outcome } from './insights';
import { costPerf } from './costPerf';
import type { BudgetLine, Project, ReportingPeriod } from './types';
import type { WorkbookSummary } from './workbook';

/**
 * Where a figure comes from: the rule it follows, the amounts it is made of, the file and sheet they were read
 * from, and the postings or purchase orders behind it. Every screen figure answers "why this number?" the same way.
 */
export type Figure = 'budget' | 'spent' | 'committed' | 'exposure' | 'remaining' | 'pace' | 'projected' | 'unused' | 'planned' | 'vsplan' | 'need';
export type LineField = 'approved' | 'actual' | 'committed' | 'exposure' | 'balance';
export type Unit = 'eur' | 'pct' | /** percentage points */ 'pp' | 'months' | 'units' | /** a multiple */ 'times';
export interface TraceTerm { label: string; value: number; unit?: Unit; op?: '+' | '−' | '×' | '÷' | '='; note?: string }
export interface TracePart { code: string; label: string; value: number }
export interface TracePosting { date: string; ref: string; who: string; text: string; amount: number }
export interface Trace {
  title: string; value: number; unit: Unit;
  /** the rule, in one plain sentence */ how: string;
  /** the amounts the figure is made of, in reading order; the last one (op '=') is the figure */ terms: TraceTerm[];
  /** file, sheet, date — where the amounts were read */ sources: { label: string; value: string }[];
  /** what it is made of, by budget heading or line */ parts?: { title: string; rows: TracePart[] };
  /** dated postings or purchase orders behind a line */ postings?: { title: string; rows: TracePosting[]; count: number; total: number };
  /** corrections made on reading and anything to know before quoting the figure */ notes: string[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const day = (s?: string) => (s ? s.slice(0, 10) : '');
const nice = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmt = (v: number) => r2(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The file behind the current figures: name, sheet, the date the figures stand at and when it was loaded. */
export function reportSource(p: Project, r: ReportingPeriod | undefined = latestReport(p)): Trace['sources'] {
  if (!r) return [{ label: 'Report', value: 'No financial report loaded — the figures typed on the project are shown' }];
  const wb = r.snapshot?.workbook as WorkbookSummary | undefined, ext = isExtraction(r.snapshot);
  const out: Trace['sources'] = [{ label: 'Report', value: `${r.name}${r.type ? ` · ${r.type}` : ''}` }];
  const file = r.fileName ?? wb?.fileName; if (file) out.push({ label: 'File', value: file });
  const grid = (wb?.meta as { grid?: string } | undefined)?.grid;
  out.push({ label: 'Read from', value: ext ? `System extraction${wb?.entries?.length ? ` · ${wb.entries.length} dated postings` : ''}${wb?.pos?.length ? ` · ${wb.pos.length} purchase orders` : ''}` : grid ? `Sheet “${grid}”` : 'Report grid' });
  const asAt = wb?.meta?.situationDate || wb?.meta?.asAt || r.date; if (asAt) out.push({ label: 'Figures as at', value: day(asAt) });
  const loaded = r.registeredAt ?? wb?.importedAt; if (loaded) out.push({ label: 'Loaded', value: day(loaded) });
  return out;
}

function readingNotes(p: Project, r: ReportingPeriod | undefined): string[] {
  const N: string[] = [], wb = r?.snapshot?.workbook as WorkbookSummary | undefined;
  if (!r) return N;
  if (isExtraction(r.snapshot)) N.push('Raw system extraction: spent is the sum of the dated postings on each budget line; the budgets come from the approved budget on file.');
  const m = wb?.meta as { levyTaken?: number; unallocated?: number } | undefined;
  if (m?.levyTaken) N.push(`€${r2(m.levyTaken).toLocaleString('en-GB', { minimumFractionDigits: 2 })} levy on donor tranches is kept out of the administrative costs, which are counted as 7% of the direct costs.`);
  if (m?.unallocated && Math.abs(m.unallocated) > 0.5) N.push(`€${r2(m.unallocated).toLocaleString('en-GB', { minimumFractionDigits: 2 })} is posted without a reporting line and is not in any budget line.`);
  const older = (p.reportingPeriods ?? []).filter((x) => x.id !== r.id && x.snapshot?.lines?.length).length;
  if (older) N.push(`${older} earlier report${older > 1 ? 's are' : ' is'} on file; the screens follow the latest one.`);
  return N;
}

const head = (code: string) => code.split('.')[0];
/** A total split by budget heading, largest first; headings at zero are left out. */
function byHeading(L: BudgetLine[], f: (l: BudgetLine) => number): TracePart[] {
  const by = new Map<string, number>(); for (const l of L) by.set(head(l.code), (by.get(head(l.code)) ?? 0) + f(l));
  return [...by].filter(([, v]) => Math.abs(v) > 0.005).map(([c, v]) => ({ code: c, label: HEADINGS[c] ?? `Heading ${c}`, value: r2(v) })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/** A project figure explained. */
export function trace(p: Project, f: Figure, today: Date): Trace {
  const m = money(p), L = lines(p), r = latestReport(p), src = reportSource(p, r), notes = readingNotes(p, r);
  const ab = p.approvedBudget;
  // A report may round its spent + committed column on its own: then the three columns are quoted as they stand.
  const gap = m.exposure - m.spent - m.committed, agree = Math.abs(gap) < 0.02;
  const gapNote = agree ? [] : [`The report’s spent + committed column differs by ${fmt(Math.abs(gap))} from spent plus committed taken separately; each column is shown as the report gives it.`];
  const budgetSrc: Trace['sources'] = ab ? [{ label: 'Approved budget', value: ab.source || 'budget annex' }, ...(ab.importedAt ? [{ label: 'Loaded', value: day(ab.importedAt) }] : [])] : [{ label: 'Budget', value: 'Typed on the project (no approved budget file loaded)' }];
  switch (f) {
    case 'budget': {
      const terms: TraceTerm[] = ab ? [{ label: 'Direct costs', value: ab.direct }, ...(ab.contingency ? [{ label: 'Contingency reserve', value: ab.contingency, op: '+' as const }] : []), { label: 'Administrative costs', value: ab.admin, op: '+' }, { label: 'Total budget', value: m.budget, op: '=' }] : [{ label: 'Total budget', value: m.budget, op: '=' }];
      const N = ab && Math.abs(ab.direct + ab.contingency + ab.admin - m.budget) > 1 ? [`The parts add up to ${r2(ab.direct + ab.contingency + ab.admin).toLocaleString('en-GB')} — the project budget was set to a different total (contract or a later version).`] : [];
      return { title: 'Total budget', value: m.budget, unit: 'eur', how: ab ? 'The total of the approved budget in force: direct costs, contingency and administrative costs.' : 'The budget typed on the project.', terms, sources: budgetSrc, parts: ab ? { title: 'By budget heading', rows: byHeading(ab.lines, (l) => n(l.approved)) } : undefined, notes: N };
    }
    case 'spent':
      return { title: 'Spent to date', value: m.spent, unit: 'eur', how: 'The sum of the “actual” column of every budget line in the latest financial report.', terms: [{ label: `${L.filter((l) => n(l.actual)).length} budget lines with spending`, value: m.spent, op: '=' }], sources: src, parts: { title: 'By budget heading', rows: byHeading(L, (l) => n(l.actual)) }, notes };
    case 'committed':
      return { title: 'Committed', value: m.committed, unit: 'eur', how: 'Open purchase orders not yet invoiced: spent + committed of each line, less what is already spent.', terms: agree ? [{ label: 'Spent + committed', value: m.exposure }, { label: 'Spent', value: m.spent, op: '−' }, { label: 'Committed', value: m.committed, op: '=' }] : [{ label: 'Committed column of the report', value: m.committed, op: '=' }], sources: src, parts: { title: 'By budget heading', rows: byHeading(L, lineCommitted) }, notes: [...gapNote, ...notes] };
    case 'exposure':
      return { title: 'Spent + committed', value: m.exposure, unit: 'eur', how: 'What is already paid plus what is ordered: the report’s own spent + committed column, line by line.', terms: agree ? [{ label: 'Spent', value: m.spent }, { label: 'Committed', value: m.committed, op: '+' }, { label: 'Spent + committed', value: m.exposure, op: '=' }] : [{ label: 'Spent + committed column of the report', value: m.exposure, op: '=' }], sources: src, parts: { title: 'By budget heading', rows: byHeading(L, lineExposure) }, notes: [...gapNote, ...notes] };
    case 'remaining':
      return { title: 'Uncommitted balance', value: m.remaining, unit: 'eur', how: 'What is still free to use: the total budget less everything spent or ordered.', terms: [{ label: 'Total budget', value: m.budget }, { label: 'Spent + committed', value: m.exposure, op: '−', note: agree ? `spent ${fmt(m.spent)} + committed ${fmt(m.committed)}` : undefined }, { label: 'Uncommitted balance', value: m.remaining, op: '=' }], sources: [...budgetSrc.slice(0, 1), ...src], parts: { title: 'Balance by budget heading', rows: byHeading(L, (l) => n(l.approved) - lineExposure(l)) }, notes };
    case 'pace': {
      const el = elapsed(p, today), sh = m.budget ? m.spent / m.budget : 0;
      return { title: 'Pace vs time', value: burnGap(p, today), unit: 'pp', how: 'The share of the budget spent, less the share of the implementation period that has passed. Below zero the project spends slower than time runs.',
        terms: [{ label: 'Share of the budget spent', value: sh, unit: 'pct', note: `${r2(m.spent).toLocaleString('en-GB')} of ${r2(m.budget).toLocaleString('en-GB')}` }, { label: 'Share of the period elapsed', value: el, unit: 'pct', op: '−', note: `${nice(p.start)} → ${nice(p.end)}, today ${nice(today.toISOString().slice(0, 10))}` }, { label: 'Pace vs time', value: sh - el, unit: 'pp', op: '=' }],
        sources: src, notes: p.datesTbc ? ['The project dates are not confirmed yet — the elapsed share is counted as zero.', ...notes] : notes };
    }
    case 'planned': case 'vsplan': case 'need': {
      const c = costPerf(p, today), span = `${nice(p.start)} → ${nice(p.end)}, report of ${nice(c.asAt)}`;
      if (f === 'planned') return { title: 'Planned by now', value: c.pv, unit: 'eur', how: 'The plan spreads the total budget evenly over the project period: what should be spent by the date of the latest report.',
        terms: [{ label: 'Total budget', value: c.bac }, { label: 'Share of the period passed', value: c.timeGone, unit: 'pct', op: '×', note: span }, { label: 'Planned by now', value: c.pv, op: '=' }], sources: [...budgetSrc.slice(0, 1), ...src], notes };
      if (f === 'vsplan') return { title: 'Spent against plan', value: c.fei ?? 0, unit: 'pct', how: 'Spent divided by what the plan expects by now. 100% is on plan; below 95% the project is behind it, below 85% well behind.',
        terms: [{ label: 'Spent', value: c.ac }, { label: 'Planned by now', value: c.pv, op: '÷', note: `${fmt(c.bac)} × ${(c.timeGone * 100).toFixed(1)}% of the period` }, { label: 'Spent against plan', value: c.fei ?? 0, unit: 'pct', op: '=' }], sources: src, notes: [c.fei == null ? 'Nothing is planned yet: the project period has not started at the report date.' : `${fmt(Math.abs(c.sv))} ${c.sv >= 0 ? 'ahead of' : 'behind'} the plan (spent less planned by now).`, ...notes] };
      return { title: 'Pace needed to use the budget', value: c.tcpiRate ?? 0, unit: 'times', how: 'The monthly spending needed to use the whole budget by the end date, as a multiple of what the project spends a month today. Above 1.0 it has to speed up.',
        terms: [{ label: 'Total budget', value: c.bac }, { label: 'Spent', value: c.ac, op: '−' }, { label: 'Months left', value: c.monthsLeft, unit: 'months', op: '÷', note: `to ${nice(p.end)}` }, { label: 'Needed a month', value: c.needRate, op: '=' }, { label: 'Spent a month today', value: c.rate, op: '÷', note: forecastRate(p, today).recent ? 'average since the start, blended with the rate between the last two reports' : 'average since the start' }, { label: 'Pace needed (× today)', value: c.tcpiRate ?? 0, unit: 'times', op: '=' }], sources: src, notes: c.tcpiRate == null ? ['No spending yet, so there is no pace to compare with.', ...notes] : notes };
    }
    case 'projected': case 'unused': {
      const o = outcome(p, today), fr = forecastRate(p, today), byRate = m.spent + o.rate * o.monthsLeft;
      const terms: TraceTerm[] = [{ label: 'Spent to date', value: m.spent }, { label: `Monthly rate (${o.basis})`, value: o.rate, op: '+', note: fr.recent ? 'average since the start, blended half and half with the rate between the last two reports' : 'average since the start of the project' }, { label: 'Months left', value: o.monthsLeft, unit: 'months', op: '×' }, { label: 'Spending at this pace', value: byRate, op: '=' }];
      if (m.exposure > byRate + 0.5) terms.push({ label: 'Already spent + committed (higher, so it is used)', value: m.exposure, op: '=' });
      if (f === 'projected') return { title: 'Projected at the end', value: o.projected, unit: 'eur', how: 'Spending so far plus the monthly rate over the months left — never less than what is already spent or ordered.', terms, sources: src, notes: [`To use the whole budget the project needs ${r2(o.needRate).toLocaleString('en-GB')} a month from now on.`, ...notes] };
      return { title: 'Unused at the end', value: o.unused, unit: 'eur', how: 'The total budget less the spending projected at the end date.', terms: [{ label: 'Total budget', value: m.budget }, { label: 'Projected at the end', value: Math.min(o.projected, m.budget), op: '−', note: `spent ${r2(m.spent).toLocaleString('en-GB')} + ${r2(o.rate).toLocaleString('en-GB')} a month × ${o.monthsLeft.toFixed(1)} months` }, { label: 'Unused at the end', value: o.unused, op: '=' }], sources: src, notes };
    }
  }
}

const FIELD: Record<LineField, string> = { approved: 'Budget', actual: 'Spent', committed: 'Committed', exposure: 'Spent + committed', balance: 'Balance' };
/** A budget-line figure explained, with the postings or purchase orders behind it. */
export function traceLine(p: Project, code: string, f: LineField): Trace | null {
  const L = lines(p), own = L.find((x) => x.code === code);
  const kids = L.filter((x) => x.code === code || x.code.startsWith(code + '.'));
  if (!kids.length) return null;
  // A heading row: the sum of its lines; a line: its own figures.
  const leafs = own && kids.length === 1 ? [own] : kids.filter((k) => !kids.some((o) => o !== k && o.code.startsWith(k.code + '.')));
  const sum = (g: (l: BudgetLine) => number) => r2(leafs.reduce((a, l) => a + g(l), 0));
  const v = { approved: sum((l) => n(l.approved)), actual: sum((l) => n(l.actual)), committed: sum(lineCommitted), exposure: sum(lineExposure), balance: 0 }; v.balance = r2(v.approved - v.exposure);
  const r = latestReport(p), wb = r?.snapshot?.workbook as WorkbookSummary | undefined, src = reportSource(p, r), notes: string[] = [];
  const label = own?.description || HEADINGS[code] || `Line ${code}`, title = `${FIELD[f]} · ${code} ${label}`;
  const wl = wb?.lines.find((x) => x.code === code), grid = (wb?.meta as { grid?: string } | undefined)?.grid;
  if (wl?.row && grid && !isExtraction(r?.snapshot)) src.splice(3, 0, { label: 'Cell', value: `Row ${wl.row} of sheet “${grid}”` });
  const mine = (c: string) => c === code || c.startsWith(code + '.');
  const parts = leafs.length > 1 ? { title: 'Lines of this heading', rows: leafs.map((l) => ({ code: l.code, label: l.description ?? '', value: r2(f === 'approved' ? n(l.approved) : f === 'actual' ? n(l.actual) : f === 'committed' ? lineCommitted(l) : f === 'exposure' ? lineExposure(l) : n(l.approved) - lineExposure(l)) })).filter((x) => Math.abs(x.value) > 0.005) } : undefined;
  if (f === 'approved') {
    const ab = p.approvedBudget, bl = ab?.lines.find((x) => x.code === code);
    const terms: TraceTerm[] = own && own.approvedUnits && own.unitRate ? [{ label: `Units (${own.unit || 'unit'})`, value: n(own.approvedUnits), unit: 'units' }, { label: 'Unit rate', value: n(own.unitRate), op: '×' }, { label: 'Budget', value: v.approved, op: '=' }] : [{ label: 'Budget', value: v.approved, op: '=' }];
    if (own && own.approvedUnits && own.unitRate && Math.abs(n(own.approvedUnits) * n(own.unitRate) - v.approved) > 1) notes.push('Units × rate does not give the budget of this line exactly — the budget column of the file is used.');
    if (bl && Math.abs(n(bl.approved) - v.approved) > 0.5) notes.push(`The original approved budget of this line was ${r2(n(bl.approved)).toLocaleString('en-GB', { minimumFractionDigits: 2 })}; the figure shown is the budget in force in the latest report.`);
    return { title, value: v.approved, unit: 'eur', how: 'The budget of the line in the budget in force: units × unit rate.', terms, sources: ab ? [{ label: 'Approved budget', value: ab.source || 'budget annex' }, ...src] : src, parts, notes };
  }
  const E = (wb?.entries ?? []).filter((e) => mine(e.line)), PO = (wb?.pos ?? []).filter((x) => mine(x.line));
  if (f === 'actual') {
    const tot = r2(E.reduce((a, e) => a + e.amount, 0));
    if (E.length && Math.abs(tot - v.actual) > 1) notes.push(`The dated postings add up to ${tot.toLocaleString('en-GB', { minimumFractionDigits: 2 })}; the line total of the report is used.`);
    if (own?.unitsEstimated) notes.push('The units of this line are estimated from the purchase orders; the finance team counts them in the report.');
    const rows = [...E].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 12).map((e) => ({ date: e.date, ref: e.doc || e.po, who: e.supplier, text: e.description || e.detail, amount: r2(e.amount) }));
    return { title, value: v.actual, unit: 'eur', how: leafs.length > 1 ? 'The sum of the “actual” column of the lines under this heading.' : 'The “actual” column of this line in the latest financial report: every invoice and direct posting booked on it.',
      terms: [{ label: E.length ? `${E.length} posting${E.length > 1 ? 's' : ''} on this line` : 'Actual column of the report', value: v.actual, op: '=' }], sources: src, parts,
      postings: E.length ? { title: 'Largest postings', rows, count: E.length, total: tot } : undefined, notes };
  }
  const open = PO.filter((x) => (x.balance ?? 0) > 0.5), rows = [...open].sort((a, b) => b.balance - a.balance).slice(0, 12).map((x) => ({ date: x.date, ref: x.po, who: x.supplier, text: x.description || x.nature, amount: r2(x.balance) }));
  const postings = open.length ? { title: 'Open purchase orders', rows, count: open.length, total: r2(open.reduce((a, x) => a + x.balance, 0)) } : undefined;
  const ok = Math.abs(v.exposure - v.actual - v.committed) < 0.02;
  if (f === 'committed') return { title, value: v.committed, unit: 'eur', how: 'The part of the purchase orders on this line that is ordered but not yet invoiced.', terms: ok ? [{ label: 'Spent + committed', value: v.exposure }, { label: 'Spent', value: v.actual, op: '−' }, { label: 'Committed', value: v.committed, op: '=' }] : [{ label: 'Committed column of the report', value: v.committed, op: '=' }], sources: src, parts, postings, notes };
  if (f === 'exposure') return { title, value: v.exposure, unit: 'eur', how: 'What is paid plus what is ordered on this line.', terms: ok ? [{ label: 'Spent', value: v.actual }, { label: 'Committed', value: v.committed, op: '+' }, { label: 'Spent + committed', value: v.exposure, op: '=' }] : [{ label: 'Spent + committed column of the report', value: v.exposure, op: '=' }], sources: src, parts, postings, notes };
  return { title, value: v.balance, unit: 'eur', how: 'What is still free on this line: its budget less everything spent or ordered.', terms: [{ label: 'Budget', value: v.approved }, { label: 'Spent + committed', value: v.exposure, op: '−', note: ok ? `spent ${fmt(v.actual)} + committed ${fmt(v.committed)}` : undefined }, { label: 'Balance', value: v.balance, op: '=' }], sources: src, parts, notes };
}
