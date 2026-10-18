import { forecastRate, lineCommitted, lines, money, parseDate, spendPoints } from './calc';
import type { Project } from './types';

const MONTH = 30.4375 * 864e5;
/** One what-if: extend the end date, change the budget, speed up / slow down spending, cut staff costs. */
export interface ScenarioIn { name: string; extend: number; budgetPct: number; pacePct: number; staffPct: number }
export interface ScenarioOut extends ScenarioIn {
  end: string; budget: number; months: number; rate: number; projected: number; balance: number; use: number; need: number;
  staffSaving: number; verdict: 'fits' | 'underspend' | 'overrun'; notes: string[];
}
export const PRESETS: ScenarioIn[] = [
  { name: 'Current course', extend: 0, budgetPct: 0, pacePct: 0, staffPct: 0 },
  { name: '6-month extension', extend: 6, budgetPct: 0, pacePct: 0, staffPct: 0 },
  { name: 'Budget −10 %', extend: 0, budgetPct: -10, pacePct: 0, staffPct: 0 },
];

const addMonths = (iso: string, m: number) => { const d = parseDate(iso); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString().slice(0, 10); };

/**
 * Projects each scenario to the (new) end date: spent + open commitments + the monthly forecast rate × pace over the
 * months left; staff cuts reduce the human-resources part of that rate. Balance > 0 is money left unused.
 */
export function runScenario(p: Project, s: ScenarioIn, today: Date): ScenarioOut {
  const m = money(p), L = lines(p), now = Math.max(today.getTime(), spendPoints(p).at(-1)?.t ?? 0);
  const end = addMonths(p.end, s.extend), months = Math.max(0, (parseDate(end).getTime() - now) / MONTH);
  const budget = m.budget * (1 + s.budgetPct / 100);
  const leaf = L.filter((l) => !L.some((x) => x !== l && x.code.startsWith(l.code + '.')));
  const hr = leaf.filter((l) => l.code.split('.')[0] === '1'), hrB = hr.reduce((a, l) => a + (l.approved ?? 0), 0), hrSpent = hr.reduce((a, l) => a + (l.actual ?? 0) + lineCommitted(l), 0);
  const sinceStart = Math.max(1, (now - parseDate(p.start).getTime()) / MONTH);
  const base = forecastRate(p, today).rate || m.exposure / sinceStart, hrShare = m.budget ? Math.min(0.9, hrB / m.budget) : 0;
  // An extension spreads the planned remaining work over more months: the monthly rate falls in proportion when
  // the pace is unchanged, so extending alone does not invent extra spending.
  const origMonths = Math.max(0, (parseDate(p.end).getTime() - now) / MONTH);
  const stretch = s.extend && origMonths > 0 ? origMonths / months : 1;
  const rate = base * stretch * (1 + s.pacePct / 100) * (1 - hrShare * (s.staffPct / 100));
  const projected = m.exposure + rate * months;
  const balance = budget - projected, use = budget ? projected / budget : 0, need = months ? Math.max(0, (budget - m.exposure) / months) : 0;
  const staffSaving = base * hrShare * (s.staffPct / 100) * months;
  const notes: string[] = [];
  if (s.budgetPct < 0 && budget < m.exposure) notes.push(`the cut goes below what is already spent or committed (${m.exposure.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
  if (s.extend > 0) notes.push(`a no-cost extension needs an addendum before ${p.end}`);
  if (Math.abs(s.budgetPct) > 0) notes.push('a budget change needs a contract amendment');
  if (s.staffPct > 0 && hrB) notes.push(`staff remaining ${Math.max(0, hrB - hrSpent).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} would be reduced by ~${staffSaving.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const verdict = use > 1.005 ? 'overrun' : use < 0.9 ? 'underspend' : 'fits';
  return { ...s, end, budget, months, rate, projected, balance, use, need, staffSaving, verdict, notes };
}
