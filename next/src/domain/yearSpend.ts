import { byPeriodThenImport, spendPoints } from './calc';
import type { Project } from './types';
import type { WorkbookSummary } from './workbook';

/**
 * What a project spent in a calendar year. From the dated postings of its latest report (invoices and GL entries
 * dated in the year) when the report carries them; else the difference between the cumulative spending of the
 * last report on or before the year end and of the last one before the year began, with the dates said.
 */
export interface YearSpend { v: number; basis: 'postings' | 'reports' | 'none'; from?: string; to?: string }
export function spentInYear(p: Project, y: number): YearSpend {
  const rep = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.workbook).sort(byPeriodThenImport).at(-1);
  const E = (rep?.snapshot?.workbook as WorkbookSummary | undefined)?.entries;
  if (E?.length) return { v: Math.round(E.filter((e) => e.date.startsWith(String(y))).reduce((a, e) => a + e.amount, 0) * 100) / 100, basis: 'postings' };
  const pts = spendPoints(p); if (!pts.length) return { v: 0, basis: 'none' };
  const end = Date.UTC(y, 11, 31, 23), start = Date.UTC(y, 0, 1);
  const upTo = [...pts].filter((x) => x.t <= end).at(-1), before = [...pts].filter((x) => x.t < start).at(-1);
  if (!upTo || upTo.t < start) return { v: 0, basis: 'none' };
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  return { v: Math.round((upTo.v - (before?.v ?? 0)) * 100) / 100, basis: 'reports', from: before ? iso(before.t) : undefined, to: iso(upTo.t) };
}
