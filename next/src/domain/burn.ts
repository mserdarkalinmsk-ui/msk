import { money, parseDate, spendPoints } from './calc';
import type { Project } from './types';

const MONTH = 30.4375 * 864e5;
export interface Interval { from: number; to: number; months: number; spent: number; rate: number }
export interface BurnAnalysis {
  intervals: Interval[]; rate: number; prevRate: number | null; accel: number | null;
  planRate: number; needRate: number; monthsLeft: number; projectedEnd: number; projectedUse: number; curve: { t: number; v: number }[];
}

/** Spending curve and the burn rate between two dates (two reports), set against the plan and the pace needed to finish. */
export function burn(p: Project, fromT: number | null, toT: number, today: Date): BurnAnalysis {
  const pts = spendPoints(p), s = parseDate(p.start).getTime(), e = parseDate(p.end).getTime(), B = money(p).budget;
  const intervals: Interval[] = pts.slice(1).map((b, i) => { const a = pts[i], m = Math.max(0.25, (b.t - a.t) / MONTH); return { from: a.t, to: b.t, months: m, spent: b.v - a.v, rate: (b.v - a.v) / m }; });
  const at = (t: number) => pts.filter((x) => x.t <= t).at(-1) ?? pts[0];
  const A = fromT == null ? pts[0] : at(fromT), Z = at(toT);
  const m = Math.max(0.25, (Z.t - A.t) / MONTH), rate = (Z.v - A.v) / m;
  const before = pts.filter((x) => x.t < A.t).at(-1);
  const prevRate = before ? (A.v - before.v) / Math.max(0.25, (A.t - before.t) / MONTH) : null;
  const total = Math.max(1, (e - s) / MONTH), planRate = B / total;
  const monthsLeft = Math.max(0, (e - Math.max(Z.t, today.getTime())) / MONTH);
  const needRate = monthsLeft ? Math.max(0, B - Z.v) / monthsLeft : 0;
  const projectedEnd = Math.min(B * 1.5, Z.v + rate * monthsLeft);
  return { intervals, rate, prevRate, accel: prevRate ? rate / prevRate - 1 : null, planRate, needRate, monthsLeft, projectedEnd, projectedUse: B ? projectedEnd / B : 0, curve: pts };
}
