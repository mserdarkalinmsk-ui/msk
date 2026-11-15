import { byUpload, lineExposure, lines, money, n } from './calc';
import { lineRate } from './rates';
import { reportDiff, type PoChange } from './reportDiff';
import { flexOf, nearOf, pctOf } from './flex';
import { headings } from './insights';
import { findErrors } from './ledger';
import { normalizeProject } from './normalize';
import { selfCheck } from './selfcheck';
import type { Project, ReportingPeriod } from './types';
import type { Entry, Workbook } from './workbook';

export type Stage = 'ok' | 'notification' | 'near' | 'addendum';
export interface ImportReview {
  before: { spent: number; sc: number }; after: { spent: number; sc: number };
  /** headings whose stage changes with this report */
  heads: { code: string; label: string; from: Stage; to: Stage; pct: number }[];
  /** what the import corrects on its own */
  fixed: string[];
  /** figures that do not agree inside the file or with the other screens */
  issues: { level: 'error' | 'warning'; text: string }[];
  /** new staff POs that will not last until their end */
  staffShort: number;
  /** budget lines whose figures change with this report, largest change first */
  lines: LineDelta[];
  /** purchase orders that are new, raised, reduced, closed or no longer in the file — against the report on file */
  pos: PoChange[];
  /** true when there is a report on file to compare with */
  compared: boolean;
}
export interface LineDelta { code: string; label: string; spent: number; dSpent: number; dSc: number; /** average unit cost before and after, when both reports count units */ rate?: { from: number; to: number }; /** the line is new in this report */ fresh?: boolean }

const stage = (over: number, flex: number): Stage => (over > flex ? 'addendum' : over > nearOf(flex) ? 'near' : over > 0.0001 ? 'notification' : 'ok');
const r2 = (v: number) => Math.round(v * 100) / 100;
const eur = (v: number) => '€' + v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isLevy = (e: Entry) => e.line === '10' && /tranche|prelev|levy/i.test(`${e.description} ${e.detail}`);

/**
 * What saving a report does to the project, before it is saved: spent and spent + committed before and after,
 * headings that change stage (notification / addendum), the corrections made on reading, and anything that does
 * not add up — in the file (entries against the line totals) or across the screens (the app's self-check).
 */
export function importReview(p: Project, report: ReportingPeriod, replaced: string[] = []): ImportReview {
  const P0 = normalizeProject(p);
  const P1 = normalizeProject({ ...p, reportingPeriods: [...(p.reportingPeriods ?? []).filter((r) => !replaced.includes(r.id)), report] });
  const m0 = money(P0), m1 = money(P1), fx = flexOf(p);
  const H0 = new Map(headings(P0).rows.map((h) => [h.code, h])), H1 = headings(P1).rows;
  const heads = H1.map((h) => { const a = H0.get(h.code); const from = a ? stage(a.overspend, fx) : 'ok', to = stage(h.overspend, fx); return { code: h.code, label: h.label, from, to, pct: h.overspend }; }).filter((h) => h.from !== h.to);
  const fixed: string[] = [], issues: ImportReview['issues'] = [];
  const raw = report.snapshot?.workbook as Workbook | undefined;
  const w = P1.reportingPeriods?.find((r) => r.id === report.id)?.snapshot?.workbook as Workbook | undefined;
  if (raw?.entries && w?.entries) {
    const key = (e: Entry) => `${e.doc}|${e.po}|${e.date}|${e.amount}`, was = new Map(raw.entries.map((e) => [key(e), e.line]));
    const moved = w.entries.filter((e) => was.get(key(e)) !== e.line);
    if (moved.length) fixed.push(`${moved.length} invoice${moved.length > 1 ? 's' : ''} of purchase orders split over several budget lines put on the line each names (${eur(r2(moved.reduce((a, e) => a + e.amount, 0)))})`);
  }
  if (w?.meta.levyTaken) fixed.push(`${eur(w.meta.levyTaken)} levy on donor tranches kept out of the administrative costs (these are 7% of the direct costs)`);
  if (p.approvedBudget && P0.approvedBudget && p.approvedBudget !== P0.approvedBudget) fixed.push('The 7% administrative costs of the approved budget, read as a contingency reserve, are counted as administrative costs');
  // The file against itself: the dated entries must add up to the line totals of the same file.
  if (w?.meta.extraction && w.entries?.length) {
    const by = new Map<string, number>(); for (const e of w.entries) if (e.line && e.line !== '10' && !isLevy(e)) by.set(e.line, (by.get(e.line) ?? 0) + e.amount);
    const off = w.lines.filter((l) => l.leaf && Math.abs((by.get(l.code) ?? 0) - (l.actual.cost ?? 0)) > 1);
    if (off.length) issues.push({ level: 'warning', text: `Dated entries and line totals of the file differ on ${off.length} line${off.length > 1 ? 's' : ''}: ${off.slice(0, 4).map((l) => `${l.code} (${eur(r2(by.get(l.code) ?? 0))} vs ${eur(r2(l.actual.cost ?? 0))})`).join(', ')}${off.length > 4 ? ' …' : ''} — the by-date and by-year views follow the entries, the statement the totals` });
  }
  if (w?.meta.situationDate) {
    const last = (p.reportingPeriods ?? []).filter((r) => !replaced.includes(r.id)).map((r) => r.snapshot?.workbook?.meta?.situationDate).filter(Boolean).sort().at(-1);
    if (last && w.meta.situationDate < last) issues.push({ level: 'warning', text: `Situation at ${w.meta.situationDate} is older than the report already on file (${last}) — the screens keep showing the newer one` });
  }
  if (m1.spent < m0.spent - 1 && !replaced.length) issues.push({ level: 'warning', text: `Spent goes down from ${eur(r2(m0.spent))} to ${eur(r2(m1.spent))} — a reversal, a cancelled invoice or an older file` });
  for (const s of selfCheck([P1])) issues.push({ level: 'error', text: `${s.figure} reads ${eur(r2(s.a.v))} on the ${s.a.label.toLowerCase()} but ${eur(r2(s.b.v))} on the ${s.b.label.toLowerCase()}` });
  let staffShort = 0;
  if (w?.entries?.length && w.pos?.length) staffShort = findErrors(w.entries, { pos: w.pos, asAt: w.meta.situationDate }).find((f) => f.kind === 'staff-short')?.rows.length ?? 0;
  // Line by line: what the screens read now against what they will read once this report is saved.
  const L0 = new Map(lines(P0).map((l) => [l.code, l])), had = lines(P0).some((l) => l.actual != null || l.spentCommitted != null);
  const delta: LineDelta[] = [];
  for (const l of lines(P1)) {
    const o = L0.get(l.code), dSpent = r2(n(l.actual) - n(o?.actual)), dSc = r2(lineExposure(l) - (o ? lineExposure(o) : 0));
    const ra = o ? lineRate(P0, o)?.rate : undefined, rb = lineRate(P1, l)?.rate, rate = ra && rb && Math.abs(rb / ra - 1) > 0.005 ? { from: ra, to: rb } : undefined;
    if (Math.abs(dSpent) > 0.5 || Math.abs(dSc) > 0.5 || rate) delta.push({ code: l.code, label: l.description ?? '', spent: r2(n(l.actual)), dSpent, dSc, rate, fresh: had && !o ? true : undefined });
  }
  delta.sort((a, b) => Math.abs(b.dSpent) + Math.abs(b.dSc) - Math.abs(a.dSpent) - Math.abs(a.dSc));
  const prevWb = [...(P0.reportingPeriods ?? [])].filter((r) => r.snapshot?.workbook?.pos?.length).sort(byUpload).at(-1)?.snapshot?.workbook as Workbook | undefined;
  const pos = prevWb && w?.pos?.length ? reportDiff(prevWb, w).pos : [];
  return { before: { spent: r2(m0.spent), sc: r2(m0.exposure) }, after: { spent: r2(m1.spent), sc: r2(m1.exposure) }, heads, fixed, issues, staffShort, lines: had ? delta : [], pos, compared: had };
}

export const STAGE_LABEL = (s: Stage, flex: number) => ({ ok: 'within budget', notification: `notification (within ${pctOf(flex)}%)`, near: `near addendum (${pctOf(nearOf(flex))}–${pctOf(flex)}%)`, addendum: `addendum (beyond ${pctOf(flex)}%)` })[s];
