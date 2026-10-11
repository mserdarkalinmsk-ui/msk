import { latestReport, parseDate } from './calc';
import { displayName, roster, type Person } from './staff';
import type { Project } from './types';

export interface StaffCost { person: Person; spent: number; committed: number; contracts: number; payrollMonths: number; monthly: number | null }
export interface StaffLine { project: Project; code: string; description: string; budgetMonths: number; budgetRate: number; budget: number; usedMonths: number; actualRate: number; spent: number; sc: number; remainingMonths: number; monthsToEnd: number; fteOnLine: number; need: number; gap: number; people: string[] }

/** Cost per person from the purchase-order (contract) and GL payroll rows of the reports. */
export function staffCosts(p: Project, today: Date): StaffCost[] {
  return roster(p, today).map((a) => {
    const po = a.contracts.filter((c) => c.recordKind !== 'Payroll observation');
    const gl = a.contracts.filter((c) => c.recordKind === 'Payroll observation');
    const spent = po.reduce((s, c) => s + (c.actual ?? 0), 0) + gl.reduce((s, c) => s + (c.actual ?? 0), 0);
    const committed = po.reduce((s, c) => s + Math.max(0, (c.exposure ?? c.actual ?? 0) - (c.actual ?? 0)), 0);
    const months = new Set(gl.map((c) => c.payrollPeriod).filter(Boolean)).size
      + po.reduce((s, c) => s + (c.start && c.end ? Math.max(0, Math.round((parseDate(c.end).getTime() - parseDate(c.start).getTime()) / 2_629_800_000)) : 0), 0);
    return { person: a, spent, committed, contracts: po.length, payrollMonths: months, monthly: months ? spent / months : null };
  });
}

/**
 * Staff budget lines (1.x.1.y, per month): budgeted vs used months, and whether the remaining
 * months cover the people on the line until the project ends (need = FTE × months to end).
 */
export function staffLines(p: Project, today: Date): StaffLine[] {
  const L = latestReport(p)?.snapshot?.lines ?? [];
  const R = roster(p, today);
  const end = parseDate(p.end).getTime();
  const monthsToEnd = Math.max(0, (end - today.getTime()) / 2_629_800_000);
  return L.filter((l) => /^1\.\d+\.1\.\d+$/.test(l.code) && (l.approved ?? 0) > 0).map((l) => {
    const on = R.filter((a) => a.code === l.code && a.status !== 'Ended'); // incl. payroll-only people whose contract dates are unknown
    const fte = on.reduce((s, a) => s + (a.fte ?? 1), 0);
    const budgetMonths = l.approvedUnits ?? 0, usedMonths = l.reportedUnits ?? 0;
    const remaining = Math.max(0, budgetMonths - usedMonths), need = fte * monthsToEnd;
    return {
      project: p, code: l.code, description: l.description ?? '', budgetMonths, budgetRate: l.unitRate ?? 0, budget: l.approved ?? 0, usedMonths,
      actualRate: l.reportedUnitRate ?? 0, spent: l.actual ?? 0, sc: l.spentCommitted ?? l.actual ?? 0, remainingMonths: remaining, monthsToEnd,
      fteOnLine: fte, need, gap: budgetMonths ? remaining - need : 0, people: on.map((a) => displayName(a.name)),
    };
  });
}
