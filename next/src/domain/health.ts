import { ADMIN_LINE } from './terms';
import { byPeriodThenImport, latestReport, parseDate, reportsByDate } from './calc';
import { headings } from './insights';
import type { Project } from './types';
import { sameDoc } from './applydocs';
import { isExtraction } from './extraction';
import { readCheck } from './intake';
import type { Workbook } from './workbook';

export type Level = 'ok' | 'warn' | 'bad';
export interface Finding { level: Level; text: string; fix?: 'report' | 'documents' | 'edit' | 'reports' | AutoFix }
/** Fixes that are safe to apply in one click. */
export type AutoFix = 'use-approved' | 'dedupe-docs' | 'dedupe-reports';
export interface Health { p: Project; level: Level; findings: Finding[] }

const pctDiff = (a: number, b: number) => (b ? Math.abs(a - b) / b : a ? 1 : 0);
const eur = (v: number) => `€${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Consistency checks per project: report totals, template recognition, budgets, duplicates and freshness. */
export function health(p: Project, today: Date): Health {
  const F: Finding[] = [];
  const add = (level: Level, text: string, fix?: Finding['fix']) => F.push({ level, text, fix });
  const R = reportsByDate(p), last = latestReport(p), wb = last?.snapshot?.workbook;

  if (p.datesTbc) add('warn', 'Start and end dates not confirmed (set-up)', 'documents');
  const days = (parseDate(p.end).getTime() - parseDate(p.start).getTime()) / 864e5;
  if (!p.datesTbc && days < 90) add('bad', `Implementation period is only ${Math.round(days)} days — check the dates`, 'edit');
  if (!p.budget) add('bad', 'No project budget', 'edit');

  if (!last) add('warn', 'No financial report loaded yet', 'report');
  else {
    const age = (today.getTime() - parseDate(last.date).getTime()) / 864e5;
    if (age > 120) add('warn', `Latest report is ${Math.round(age / 30)} months old (${last.date})`, 'report');
    if (wb && isExtraction(last.snapshot)) {
      // A system extraction has no totals block: check that every entry landed on a line instead.
      for (const c of readCheck(wb as unknown as Workbook, p, last.snapshot!.lines).checks) add(c.level === 'ok' ? 'ok' : c.level === 'error' ? 'bad' : 'warn', `System extraction: ${c.text}`, c.level === 'ok' ? undefined : 'reports');
    } else if (wb) {
      const lay = wb.meta.layout ?? {}, T = wb.totals;
      if (!lay.direct || !T.direct) add('bad', 'Direct-cost total row not recognised — re-upload the report', 'report');
      if (!lay.admin || !T.admin) add('bad', 'Administrative-costs row missing in the stored reading — re-upload the report so it is read with the current rules', 'report');
      if (!lay.eligible || !T.eligible) add('warn', 'Total eligible costs row not recognised — re-upload the report', 'report');
      if (lay.direct && lay.admin && lay.eligible) add('ok', `Template ${lay.direct} · ${lay.admin} · ${lay.eligible}${lay.contingency ? ` (contingency ${lay.contingency})` : ' (no contingency row)'}`);
      const leaf = wb.lines.filter((l) => l.leaf);
      const sb = leaf.reduce((a, l) => a + (l.budget.cost ?? 0), 0), sa = leaf.reduce((a, l) => a + (l.actual.cost ?? 0), 0);
      if (T.direct) {
        if (Math.abs(sb - T.direct.budget) > 1) add('bad', `Budget lines add up to ${eur(sb)} but the direct total says ${eur(T.direct.budget)}`, 'reports');
        else add('ok', 'Budget lines add up to the direct total');
        if (Math.abs(sa - T.direct.actual) > 1) add('bad', `Actual lines add up to ${eur(sa)} but the direct total says ${eur(T.direct.actual)}`, 'reports');
      }
      if (T.direct && T.admin && T.eligible) {
        const s = T.direct.budget + (T.contingency?.budget ?? 0) + T.admin.budget;
        if (Math.abs(s - T.eligible.budget) > 1) add('bad', `Direct + admin${T.contingency ? ' + contingency' : ''} = ${eur(s)}, total eligible says ${eur(T.eligible.budget)}`, 'reports');
        if (pctDiff(T.eligible.budget, p.budget) > 0.01) add('warn', `Report total budget ${eur(T.eligible.budget)} differs from the project budget ${eur(p.budget)}`, 'edit');
        const r7 = T.direct.budget ? T.admin.budget / T.direct.budget : 0;
        if (r7 > 0.0705) add('warn', `Administrative costs are ${(r7 * 100).toFixed(1)}% of direct costs (max 7%)`, 'reports');
      }
    } else if (!last.snapshot!.lines.some((l) => l.code === ADMIN_LINE)) add('warn', 'Report read without the CoE layout — no administrative-costs line', 'report');
  }

  const ab = p.approvedBudget;
  if (!ab) add('warn', 'No approved budget (baseline) loaded — heading flexibility cannot be checked', 'documents');
  else {
    if (ab.contingency && ab.admin && Math.abs(ab.contingency - ab.admin) < 1) add('bad', 'Approved budget has the 7% admin also counted as contingency — re-upload the budget document', 'documents');
    if (Math.abs(ab.total - p.budget) > 1) add(pctDiff(ab.total, p.budget) > 0.01 ? 'bad' : 'warn', `Approved budget total ${eur(ab.total)} (${ab.source}) differs from the project budget ${eur(p.budget)}`, 'use-approved');
    const H = headings(p);
    if (H.rows.some((r) => r.status === 'breach')) add('warn', `Heading change above the ${Math.round(H.flex * 100)}% flexibility: ${H.rows.filter((r) => r.status === 'breach').map((r) => r.label).join(', ')}`, 'reports');
  }

  const months = R.filter((r) => r.snapshot?.lines?.length).map((r) => r.date.slice(0, 7));
  const dup = [...new Set(months.filter((m, i) => months.indexOf(m) !== i))];
  if (dup.length) add('warn', `More than one report for ${dup.join(', ')} — the most recent import is used`, 'dedupe-reports');
  const D = p.documents ?? [], dupD = D.filter((d, i) => D.some((x, k) => k < i && sameDoc(x.name, d.name)));
  if (dupD.length) add('warn', `${dupD.length} document${dupD.length > 1 ? 's' : ''} uploaded twice (${dupD.map((d) => d.name).slice(0, 2).join(', ')})`, 'dedupe-docs');

  const level: Level = F.some((f) => f.level === 'bad') ? 'bad' : F.some((f) => f.level === 'warn') ? 'warn' : 'ok';
  return { p, level, findings: F.sort((a, b) => ['bad', 'warn', 'ok'].indexOf(a.level) - ['bad', 'warn', 'ok'].indexOf(b.level)) };
}

/** Applies a one-click fix to a copy of the project; removed copies go to the trash through the caller. */
export function applyFix(p: Project, fix: AutoFix): { p: Project; removed: { kind: 'report' | 'document'; data: unknown; label: string }[] } {
  const q: Project = JSON.parse(JSON.stringify(p)), removed: { kind: 'report' | 'document'; data: unknown; label: string }[] = [];
  if (fix === 'use-approved' && q.approvedBudget) q.budget = Math.round(q.approvedBudget.total * 100) / 100;
  if (fix === 'dedupe-docs') { const D = q.documents ?? []; q.documents = D.filter((d, i) => { const keep = !D.some((x, k) => k > i && sameDoc(x.name, d.name)); if (!keep) removed.push({ kind: 'document', data: d, label: d.name }); return keep; }); }
  if (fix === 'dedupe-reports') {
    // Within a month the most recent import stays (the same rule the screens use).
    const R = q.reportingPeriods ?? [], key = (r: (typeof R)[number]) => `${r.date.slice(0, 7)}`;
    const newer = (a: (typeof R)[number], b: (typeof R)[number]) => byPeriodThenImport(a, b) < 0;
    q.reportingPeriods = R.filter((r, i) => { const keep = !r.snapshot?.lines?.length || !R.some((x, k) => k !== i && x.snapshot?.lines?.length && key(x) === key(r) && (newer(r, x) || (!newer(x, r) && k > i))); if (!keep) removed.push({ kind: 'report', data: r, label: r.name }); return keep; });
  }
  return { p: q, removed };
}
