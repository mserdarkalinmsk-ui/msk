import type { Workbook } from './workbook';

/**
 * What kind of document a workbook is, from what it holds rather than its file name: a budget proposal (no spending
 * columns, often a secured-funding block), a system extraction, a final or an interim report (with or without the
 * forecast). Each answer says why, and how sure it is; an unsure one is for the user to confirm.
 */
export type DocKind = 'proposal' | 'extraction' | 'final' | 'interim' | 'report';
export interface DocType { kind: DocKind; label: string; type: string; sure: boolean; why: string[] }

export function docType(wb: Workbook): DocType {
  const m = wb.meta, w = m.words ?? {}, roles = (m.blocks ?? []).map((b) => b.role);
  const hasActual = roles.includes('actual') || wb.lines.some((l) => (l.actual.cost ?? 0) !== 0);
  if (m.extraction) return { kind: 'extraction', label: 'System extraction', type: 'System extraction', sure: true, why: ['entries per reporting line, no report grid'] };
  if (!hasActual) {
    const why = ['no actual-expenditure columns'];
    if (m.secured) why.push('a secured-funding block');
    if (w.proposal) why.push('"budget proposal" in the heading');
    return { kind: 'proposal', label: 'Budget (proposal or approved)', type: 'Latest Approved Budget', sure: true, why };
  }
  if (w.final && !w.interim) return { kind: 'final', label: 'Final financial report', type: 'Final Report', sure: true, why: ['"final report" in the heading'] };
  const why = ['actual expenditure columns'];
  if (m.periodFrom) why.push('a reporting period');
  if (roles.includes('planned') || w.forecast) why.push('planned expenditure (forecast)');
  if (w.interim) why.push('"interim report" in the heading');
  return { kind: 'interim', label: 'Interim financial report', type: 'Interim Financial Report', sure: !!(m.periodFrom || w.interim), why };
}

/** Key of a file format: the headings of its column blocks. Corrections made by hand are remembered under it. */
export const formatKey = (wb: Workbook) => (wb.meta.blocks ?? []).map((b) => b.key).join('|');
