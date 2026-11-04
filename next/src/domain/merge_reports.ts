import { latestReport, money } from './calc';
import { reportFrom } from './autoimport';
import { docType } from './doctype';
import { ADMIN_LINE } from './terms';
import type { ApprovedBudget } from './documents';
import type { Project, ReportingPeriod } from './types';
import { toBudgetLines, type Workbook } from './workbook';

/**
 * The one way a workbook joins a project, whatever screen it was loaded from: a budget (no spending) becomes the
 * approved budget; a report replaces its earlier reading (same date or same file) or is added; identifiers missing on
 * the project are taken from the file. The receipt says what changed, and which report still stays ahead.
 */
export interface Receipt { project: string; added: number; replaced: number; budget?: number; spentBefore: number; spentAfter: number; latest?: string; ahead?: string }

export function budgetFromWorkbook(wb: Workbook, source: string): ApprovedBudget {
  const L = toBudgetLines(wb).map(({ code, description, unit, approved, approvedUnits, unitRate }) => ({ code, description, unit, approved, approvedUnits, unitRate }));
  const T = wb.totals, admin = T.admin?.budget ?? L.find((l) => l.code === ADMIN_LINE)?.approved ?? 0, cont = T.contingency?.budget ?? 0;
  const direct = T.direct?.budget ?? L.filter((l) => l.code !== ADMIN_LINE && l.code !== '8').reduce((a, l) => a + (l.approved ?? 0), 0);
  const total = Math.round((T.eligible?.budget ?? direct + admin + cont) * 100) / 100;
  return { lines: L, direct, admin, contingency: cont, total, source, linesSum: direct, importedAt: new Date().toISOString() };
}

export const isBudgetFile = (wb: Workbook) => docType(wb).kind === 'proposal';

export function mergeReports(p: Project, files: { wb: Workbook; fileName: string }[]): { patch: Partial<Project>; receipt: Receipt } {
  const R: ReportingPeriod[] = [...(p.reportingPeriods ?? [])];
  let q: Project = { ...p }, added = 0, replaced = 0, budget: ApprovedBudget | undefined;
  for (const { wb, fileName } of [...files].sort((a, b) => (a.wb.meta.periodTo ?? '').localeCompare(b.wb.meta.periodTo ?? ''))) {
    const m = wb.meta; q = { ...q, bh: q.bh || m.bh, contractNo: q.contractNo || m.contract, jp: q.jp || m.jp };
    if (isBudgetFile(wb)) { budget = budgetFromWorkbook(wb, fileName); continue; }
    const { report, replaces } = reportFrom(wb, fileName, { ...q, reportingPeriods: R });
    const i = R.findIndex((x) => x.id === (replaces ?? report.id));
    if (i >= 0) { R[i] = report; replaced++; } else { R.push(report); added++; }
  }
  R.sort((a, b) => a.date.localeCompare(b.date));
  const patch: Partial<Project> = { reportingPeriods: R, bh: q.bh, contractNo: q.contractNo, jp: q.jp, ...(budget ? { approvedBudget: budget, budget: budget.total } : {}) };
  // Without an approved budget the latest report's total is the project budget.
  const after = { ...p, ...patch } as Project, last = latestReport(after);
  const eb = last?.snapshot?.workbook?.totals?.eligible?.budget;
  if (!after.approvedBudget && eb && Math.abs(eb - p.budget) > 1) patch.budget = Math.round(eb * 100) / 100;
  const loaded = new Set(files.map((f) => f.fileName));
  const ahead = last && last.fileName && !loaded.has(last.fileName) && added + replaced ? last : undefined;
  return { patch, receipt: { project: p.bh ? `BH ${p.bh}` : p.code, added, replaced, budget: budget?.total, spentBefore: money(p).spent, spentAfter: money({ ...p, ...patch } as Project).spent, latest: last?.name, ahead: ahead ? `${ahead.name} (${ahead.date})` : undefined } };
}

/** One line per project for the message after an import. */
export const receiptText = (r: Receipt) => {
  const parts = [r.added && `${r.added} report${r.added > 1 ? 's' : ''} added`, r.replaced && `${r.replaced} replaced`, r.budget && `approved budget €${r.budget.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`].filter(Boolean).join(', ');
  const d = r.spentAfter - r.spentBefore;
  return `${r.project}: ${parts || 'nothing new'}${Math.abs(d) > 0.5 ? ` · spent ${d > 0 ? '+' : '−'}€${Math.abs(d).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}${r.ahead ? ` · still showing ${r.ahead} — a later report` : ''}`;
};
