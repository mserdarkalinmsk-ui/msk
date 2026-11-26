/*
 * Cost performance, after the earned value standard (PMI Practice Standard for EVM; ISO 21508), adapted to grant
 * projects and computed only from what the app holds:
 *   BAC  budget at completion — the project budget
 *   AC   actual cost — spent, from the latest report
 *   PV   planned value — the linear baseline: BAC × share of the period gone at the report date
 *   EV   earned value — measured only where progress is recorded: the planned amount of the Work Plan activities the
 *        project team marked done (a plan that has ended); never inferred from spending
 *   SPI = EV / PV, CPI = EV / AC (Work Plan level, when EV exists)
 *   Financial execution index FEI = AC / PV — how far spending keeps up with the baseline (no EV needed)
 *   EAC  estimate at completion, three ways: the current pace; the report's own plan (or the commitments) then the
 *        pace; the baseline's monthly rate from now on (the work left done as originally planned)
 *   VAC = BAC − EAC (positive: money that would stay unused at the end; negative: an overrun)
 *   TCPI-rate = monthly spending needed to use the budget by the end ÷ the current monthly spending
 */
import { elapsed, forecastRate, money, parseDate, spendPoints } from './calc';
import { ahead, type Basis, BASIS_LABEL } from './forecast';
import type { Project } from './types';
import { statusFate, wpName, wpUse, type WorkPlan } from './workplan';
import type { WorkbookSummary } from './workbook';

const MONTH = 30.4375 * 864e5;
const r2 = (v: number) => Math.round(v * 100) / 100;
const eur = (v: number) => '€' + r2(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface EacWay { key: 'pace' | 'plan' | 'baseline'; label: string; eac: number; vac: number; basis: string }
export interface WpEv { wp: string; from: string; to: string; pv: number; ev: number; ac: number | null; spi: number | null; cpi: number | null; done: number; postponed: number; cancelled: number; unknown: number; acts: number }
export interface CostPerf {
  /** no spending yet: too early for a pace or an estimate */ early: boolean;
  bac: number; ac: number; committed: number; sc: number; asAt: string; timeGone: number; monthsLeft: number;
  pv: number; fei: number | null; sv: number;
  rate: number; needRate: number; tcpiRate: number | null;
  eac: EacWay[]; main: EacWay;
  /** earned value by Work Plan, where activity statuses are recorded */ ev: WpEv[];
  /** what the figures rest on, for the reader */ notes: string[];
}

export function costPerf(p: Project, today: Date, wb?: WorkbookSummary | null): CostPerf {
  const m = money(p), pts = spendPoints(p), last = pts.at(-1);
  const asAtT = last && last.t > parseDate(p.start).getTime() ? last.t : today.getTime();
  const asAt = new Date(asAtT).toISOString().slice(0, 10);
  const timeGone = elapsed(p, new Date(asAtT));
  const end = parseDate(p.end).getTime(), monthsLeft = Math.max(0, (end - asAtT) / MONTH); // from the report date: spending is as at that day
  const pv = m.budget * timeGone;
  const { rate } = forecastRate(p, today);
  const needRate = monthsLeft ? Math.max(0, m.budget - m.spent) / monthsLeft : 0;
  const pace = m.spent + rate * monthsLeft;
  const a = ahead(p, new Date(asAtT), rate);
  const plan = m.exposure + a.add;
  const total = Math.max(1, (end - parseDate(p.start).getTime()) / MONTH), baseRate = m.budget / total, baseline = m.spent + baseRate * monthsLeft;
  const way = (key: EacWay['key'], label: string, eac: number, basis: string): EacWay => ({ key, label, eac: r2(eac), vac: r2(m.budget - eac), basis });
  const eac = [
    way('pace', "At today's pace", pace, `spent + ${eur(rate)} a month × ${monthsLeft.toFixed(1)} months left`),
    way('plan', a.basis === 'pace' ? "What is committed, then today's pace" : 'Following the report plan', plan, a.basis === 'pace' ? "spent + committed + today's pace for the months left" : `spent + committed + ${BASIS_LABEL[a.basis as Basis]}`),
    way('baseline', 'If spending returns to plan', baseline, `spent + the planned ${eur(baseRate)} a month × ${monthsLeft.toFixed(1)} months left`),
  ];
  const main = a.basis !== 'pace' ? eac[1] : eac[0];
  const notes: string[] = [];
  if (pts.length < 3) notes.push('Fewer than two reports on file: the monthly pace rests on one interval.');
  if (a.basis === 'pace') notes.push("The latest report has no planned expenditure, so the estimates use today's pace.");
  const ev = evByWorkPlan(p.workPlans ?? [], wb ?? null, today);
  if (!ev.length) notes.push('Delivery of the Work Plans can be measured once the activities of an ended Work Plan carry a status (done / postponed / cancelled); none recorded yet.');
  const early = m.spent < 0.5 && rate < 0.5;
  if (early) notes.unshift('No spending reported yet: too early to estimate where the project ends.');
  return { early, bac: r2(m.budget), ac: r2(m.spent), committed: r2(m.committed), sc: r2(m.exposure), asAt, timeGone, monthsLeft, pv: r2(pv), fei: pv > 0 ? m.spent / pv : null, sv: r2(m.spent - pv),
    rate: r2(rate), needRate: r2(needRate), tcpiRate: rate > 0 ? needRate / rate : null, eac, main, ev, notes };
}

/** Earned value of each ended Work Plan whose activities carry a status: PV the activities planned (cancelled ones
 * descoped), EV the planned amount of those done, AC what was spent on the plan (activity numbers and its dates). */
export function evByWorkPlan(plans: WorkPlan[], wb: WorkbookSummary | null, today: Date): WpEv[] {
  const t = today.toISOString().slice(0, 10);
  return [...plans].sort((a, b) => a.from.localeCompare(b.from)).filter((w) => w.to && w.to < t && (w.acts ?? []).some((x) => x.status && statusFate(x.status) !== 'unknown')).map((w) => {
    const A = w.acts ?? [], f = A.map((x) => ({ x, s: statusFate(x.status ?? '') }));
    const pv = f.filter((y) => y.s !== 'cancelled').reduce((s, y) => s + y.x.amount, 0), ev = f.filter((y) => y.s === 'done').reduce((s, y) => s + y.x.amount, 0);
    const ac = wb?.entries?.length ? wpUse(w, wb).spent : null;
    const n = (s: string) => f.filter((y) => y.s === s).length;
    return { wp: wpName(w), from: w.from, to: w.to, pv: r2(pv), ev: r2(ev), ac: ac == null ? null : r2(ac), spi: pv ? ev / pv : null, cpi: ac ? ev / ac : null, done: n('done'), postponed: n('postponed'), cancelled: n('cancelled'), unknown: n('unknown'), acts: A.length };
  });
}

/** Reading of an index against 1: on plan within ±5%, then watch, then off. */
export const band = (v: number | null, low = 0.95, bad = 0.85): 'good' | 'warn' | 'bad' | null => (v == null ? null : v >= low ? 'good' : v >= bad ? 'warn' : 'bad');
