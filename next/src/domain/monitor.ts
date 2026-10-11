import { deadlines, elapsed, forecastRate, lineExposure, lines, money, parseDate, planStats, reportsByDate, reportTotals } from './calc';
import { roster } from './staff';
import type { Project } from './types';

const DAY = 86_400_000, MONTH = 30.4375 * DAY;

/** Performance (spent ÷ planned) at each financial report date — the monthly trend of the monitoring sheet. */
export function perfTrend(p: Project): { date: string; perf: number; spent: number }[] {
  return reportsByDate(p).filter((r) => r.snapshot?.lines?.length && !/approved budget/i.test(r.type)).map((r) => {
    const spent = reportTotals(r).actual, pl = money(p).budget * elapsed(p, parseDate(r.date));
    return { date: r.date, perf: pl ? spent / pl : 0, spent };
  });
}

export interface Score { score: number; level: 'low' | 'medium' | 'high'; parts: { label: string; points: number; why: string }[] }
/** Early-warning score 0–100: higher = more attention needed. */
export function warningScore(p: Project, today: Date, x: { perf: number; scp: number; staffRatio: number }): Score {
  const parts: Score['parts'] = [];
  const add = (label: string, points: number, why: string) => { if (points > 0.5) parts.push({ label, points: Math.round(points), why }); };
  add('Spending behind plan', Math.min(35, Math.max(0, (0.9 - x.perf) / 0.6 * 35)), `${Math.round(x.perf * 100)}% of planned spent`);
  add('Over planned with commitments', x.scp > 1 ? Math.min(15, (x.scp - 1) * 75) : 0, `S&C ${Math.round(x.scp * 100)}% of planned`);
  add('High staff ratio', x.staffRatio >= 0.5 ? 15 : x.staffRatio > 0.35 ? 6 : 0, `${Math.round(x.staffRatio * 100)}% of spending on staff`);
  const pl = planStats(p, today);
  add('Activities late', pl && pl.total ? Math.min(15, pl.late / pl.total * 45) : 0, pl ? `${pl.late} of ${pl.total} past the planned month` : '');
  const od = deadlines(p, today).filter((d) => d.status === 'overdue').length;
  add('Report overdue', od ? 20 : 0, `${od} report(s) overdue`);
  const t = perfTrend(p); const tr = t.length > 1 ? t.at(-1)!.perf - t.at(-2)!.perf : 0;
  add('Worsening trend', tr < -0.03 ? Math.min(10, -tr * 100) : 0, `${Math.round(tr * 100)} points since the previous report`);
  const score = Math.min(100, parts.reduce((a, b) => a + b.points, 0));
  return { score, level: score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low', parts: parts.sort((a, b) => b.points - a.points) };
}

/** Catch-up plan: monthly spend needed to be back on the linear plan within `months`, and the headings with the largest gap. */
export function catchUp(p: Project, today: Date, months = 3) {
  const m = money(p), s = parseDate(p.start).getTime(), e = parseDate(p.end).getTime();
  const target = Math.min(e, today.getTime() + months * MONTH);
  const plannedThen = m.budget * Math.max(0, Math.min(1, (target - s) / (e - s)));
  const need = Math.max(0, (plannedThen - m.spent) / months), rate = forecastRate(p, today).rate;
  const el = elapsed(p, today), L = lines(p);
  const H = new Map<string, { budget: number; spent: number }>();
  for (const l of L.filter((l) => !L.some((x) => x !== l && x.code.startsWith(l.code + '.')))) {
    const k = l.code.split('.')[0]; if (k === '10' || k === '8') continue;
    const h = H.get(k) ?? { budget: 0, spent: 0 }; h.budget += l.approved ?? 0; h.spent += lineExposure(l); H.set(k, h);
  }
  const gaps = [...H].map(([k, h]) => ({ heading: k, gap: h.budget * el - h.spent })).filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 2);
  return { need, rate, factor: rate ? need / rate : 0, gaps };
}

/** Staff cost projection to the end date at the current monthly staff cost. */
export function staffProjection(p: Project, today: Date, staffSpent: number) {
  const m = money(p), s = parseDate(p.start).getTime(), e = parseDate(p.end).getTime(), now = Math.min(e, today.getTime());
  const done = Math.max(1, (now - s) / MONTH), left = Math.max(0, (e - now) / MONTH);
  const monthly = staffSpent / done, projected = staffSpent + monthly * left;
  const R = roster(p, today), endingEarly = R.filter((a) => a.status === 'Active' && a.end && a.end < p.end).length;
  return { monthly, projected, share: m.budget ? projected / m.budget : 0, endingEarly, active: R.filter((a) => a.status === 'Active').length };
}
