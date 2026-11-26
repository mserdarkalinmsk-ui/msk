import { addMonths, deadlines, money } from './calc';
import { roster } from './staff';
import type { Project } from './types';
import type { WorkbookSummary } from './workbook';

export type StepState = 'done' | 'overdue' | 'due' | 'upcoming';
export interface Step { k: string; label: string; hint: string; due: string; state: StepState; auto?: string; offset: number }

/** Closure steps relative to the end date (months: negative = before the end). */
export const STEPS: { k: string; label: string; hint: string; m: number }[] = [
  { k: 'plan', label: 'Closure plan agreed', hint: 'Remaining activities, final event, hand-over and reporting calendar', m: -6 },
  { k: 'staff', label: 'Staff and consultant contracts aligned to the end date', hint: 'No contract running beyond the end; exit or transfer decided', m: -4 },
  { k: 'procure', label: 'Last purchases ordered', hint: 'No new purchase orders after this date unless delivered before the end', m: -3 },
  { k: 'assets', label: 'Transfer of equipment and assets prepared', hint: 'Inventory and hand-over certificates for the beneficiaries', m: -2 },
  { k: 'visibility', label: 'Final event and visibility deliverables', hint: 'Publications, final conference, EU visibility requirements', m: -1 },
  { k: 'commitments', label: 'Open purchase orders settled', hint: 'All commitments paid or cancelled', m: 1 },
  { k: 'narrative', label: 'Final narrative report', hint: 'Results against the logframe, lessons learned', m: 3 },
  { k: 'financial', label: 'Final financial report', hint: 'All costs to the end date, in the approved budget format', m: 3 },
  { k: 'verification', label: 'Expenditure verification and audit', hint: 'Auditor report if required by the contract', m: 4 },
  { k: 'payment', label: 'Final payment claim / recovery', hint: 'Balance of the contribution', m: 5 },
  { k: 'archive', label: 'Project file archived', hint: 'Documents kept for the period required by the contract', m: 6 },
];

/** The closure timeline of a project: each step's due date and state, ticked by hand or checked from the data on file. */
export function closureSteps(p: Project, today: Date, wb?: WorkbookSummary): Step[] {
  const t = today.toISOString().slice(0, 10), soon = addMonths(t, 1).slice(0, 10);
  const done = p.closure?.done ?? {};
  const R = roster(p, today), beyond = R.filter((a) => a.status === 'Active' && a.end && a.end > p.end);
  const openPO = wb ? wb.pos.filter((x) => /open/i.test(x.status) && x.balance > 0.5).reduce((s, x) => s + x.balance, 0) : money(p).committed;
  const final = deadlines(p, today).find((d) => d.kind === 'Final report');
  const auto: Record<string, { v?: boolean; why: string }> = {
    staff: { v: R.length ? beyond.length === 0 : undefined, why: beyond.length ? `${beyond.length} contract(s) end after the project` : 'no contract beyond the end' },
    commitments: { v: wb ? openPO < 1 : undefined, why: openPO >= 1 ? `€${openPO.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} still open` : 'no open purchase orders' },
    financial: { v: final ? final.status === 'submitted' : undefined, why: final?.status === 'submitted' ? 'final report on file' : '' },
  };
  return STEPS.map((s) => {
    const due = (s.k === 'financial' || s.k === 'narrative') && final ? final.due : addMonths(p.end, s.m).slice(0, 10);
    const v = done[s.k] ?? auto[s.k]?.v ?? false;
    const state: StepState = v ? 'done' : due < t ? 'overdue' : due <= soon ? 'due' : 'upcoming';
    return { k: s.k, label: s.label, hint: s.hint, due, state, offset: s.m, auto: done[s.k] == null && auto[s.k]?.v != null ? auto[s.k].why : auto[s.k] && !auto[s.k].v ? auto[s.k].why : undefined };
  });
}

/** Projects in their closure window: ending within six months, or ended and not fully closed. */
export const inClosure = (p: Project, today: Date, S: Step[], months = 6) => {
  const t = today.toISOString().slice(0, 10);
  return !p.datesTbc && addMonths(t, months).slice(0, 10) >= p.end && S.some((s) => s.state !== 'done');
};
