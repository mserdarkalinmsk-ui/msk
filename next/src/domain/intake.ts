import { ADMIN_LINE, FORMAT } from './terms';
import { EXTRACTION, extractionLines } from './extraction';
import type { BudgetLine, Project, ReportingPeriod } from './types';
import { summarize, toBudgetLines, type Workbook } from './workbook';

/**
 * The one way a financial workbook becomes a stored report, whichever screen it came from
 * (Smart import, Import report, Bulk reports, Portfolio import).
 */
export function snapshotOf(wb: Workbook, p: Project, fileName?: string): NonNullable<ReportingPeriod['snapshot']> {
  const ext = !!wb.meta.extraction;
  return { format: ext ? EXTRACTION : FORMAT.workbook, lines: ext ? extractionLines(wb, p) : toBudgetLines(wb), ...(wb.staff?.length ? { staffRecords: wb.staff, staffGroups: wb.staffGroups } : {}), workbook: summarize(wb, fileName) };
}

export interface ReadCheck { level: 'ok' | 'warning' | 'error'; text: string }
export interface ReadReport { lines: number; spent: number; sc: number; checks: ReadCheck[]; blocking: boolean }

const eur = (n: number) => '€' + Math.round(n).toLocaleString('en-GB');
const sum = (L: BudgetLine[], f: (l: BudgetLine) => number | null | undefined) => L.reduce((a, l) => a + (f(l) ?? 0), 0);

/**
 * What the app will store from a workbook, checked against the file itself: every euro of the file must land on a
 * line, the file must belong to the project, and lines outside the approved budget are named. An error blocks the
 * import (the user may still force it); warnings are shown.
 */
export function readCheck(wb: Workbook, p: Project, lines: BudgetLine[] = snapshotOf(wb, p).lines): ReadReport {
  const C: ReadCheck[] = [], m = wb.meta;
  const spent = sum(lines, (l) => l.actual), sc = sum(lines, (l) => l.spentCommitted ?? n(l.actual) + n(l.committed));
  // What the file itself says was spent: the totals block of a report, or every entry of a system extraction.
  const T = wb.totals;
  const fileSpent = m.extraction ? wb.lines.reduce((a, l) => a + (l.actual.cost ?? 0), 0) + (T.admin?.actual ?? 0)
    : T.eligible ? T.eligible.actual - (T.contingency?.actual ?? 0) : T.direct ? T.direct.actual + (T.admin?.actual ?? 0) : null;
  const fileSc = m.extraction ? wb.lines.reduce((a, l) => a + (l.sc ?? 0), 0) + (T.admin?.sc ?? 0)
    : T.eligible?.sc ? T.eligible.sc - (T.contingency?.sc ?? 0) : null;
  if (fileSpent != null) {
    const ok = Math.abs(fileSpent - spent) <= 1;
    C.push({ level: ok ? 'ok' : 'error', text: ok ? `Spent ${eur(spent)} on ${lines.length} lines matches the file` : `Lines add up to ${eur(spent)} spent but the file says ${eur(fileSpent)} — ${eur(fileSpent - spent)} would be lost` });
  } else C.push({ level: 'warning', text: 'No totals in the file to check the lines against' });
  if (fileSc != null && fileSc > 0) {
    const ok = Math.abs(fileSc - sc) <= 1;
    C.push({ level: ok ? 'ok' : 'error', text: ok ? `Spent + committed ${eur(sc)} matches the file` : `Lines add up to ${eur(sc)} spent + committed but the file says ${eur(fileSc)}` });
  }
  if (m.unallocated) C.push({ level: 'warning', text: `${eur(m.unallocated)} in the file has no reporting line (e.g. levies) and is not counted` });
  if (p.bh && m.bh && p.bh !== m.bh) C.push({ level: 'error', text: `File is for BH ${m.bh}, the project is BH ${p.bh}` });
  if (p.jp && m.jp && p.jp !== m.jp) C.push({ level: 'error', text: `File is for JP ${m.jp}, the project is JP ${p.jp}` });
  if (p.contractNo && m.contract && p.contractNo !== m.contract) C.push({ level: 'error', text: `File is for contract ${m.contract}, the project has ${p.contractNo}` });
  if (p.approvedBudget?.lines?.length) {
    const codes = new Set(p.approvedBudget.lines.map((l) => l.code));
    const out = lines.filter((l) => l.code !== ADMIN_LINE && !codes.has(l.code) && !/\.0$/.test(l.code) && (n(l.actual) || n(l.spentCommitted)));
    if (out.length) C.push({ level: 'warning', text: `Not in the approved budget: ${out.map((l) => `${l.code} (${eur(n(l.spentCommitted) || n(l.actual))})`).join(', ')}` });
    const eb = !m.extraction ? T.eligible?.budget : undefined;
    if (eb && Math.abs(eb - p.approvedBudget.total) > 1) C.push({ level: 'warning', text: `Budget in the file ${eur(eb)} differs from the approved budget ${eur(p.approvedBudget.total)} (${p.approvedBudget.source}); the approved budget is kept` });
  } else if (m.extraction) C.push({ level: 'warning', text: 'No approved budget on the project yet: lines show amounts only until a budget is added' });
  return { lines: lines.length, spent, sc, checks: C, blocking: C.some((c) => c.level === 'error') };
}
const n = (x: number | null | undefined) => x ?? 0;

/** Which document an approved budget comes from: a budget workbook beats a budget table copied into a DoA or contract. */
export const budgetRank = (source = '') => (/\.xls[xm]?$/i.test(source) ? 2 : 1);
