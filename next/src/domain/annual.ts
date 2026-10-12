import { HEADINGS, lineCommitted, lines, money, parseDate, spendAt } from './calc';
import type { Project } from './types';

const MONTH = 30.4375 * 864e5;
export interface AnnualPlan { years: number[]; past: Record<number, number>; rows: { h: string; label: string; budget: number; spent: number; committed: number; free: number; byYear: Record<number, number> }[]; total: Record<number, number>; remaining: number }

/** Months of [from, to] that fall in each calendar year. */
function monthsPerYear(from: number, to: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (let y = new Date(from).getUTCFullYear(); y <= new Date(to).getUTCFullYear(); y++) {
    const a = Math.max(from, Date.UTC(y, 0, 1)), b = Math.min(to, Date.UTC(y + 1, 0, 1));
    if (b > a) out[y] = (b - a) / MONTH;
  }
  return out;
}

/**
 * Cash still to be paid per calendar year until the end date, by heading: open commitments within the next three
 * months, the uncommitted balance spread evenly over the months left. Past years show spending already recorded.
 */
export function annualPlan(p: Project, today: Date): AnnualPlan {
  const now = today.getTime(), s = parseDate(p.start).getTime(), e = parseDate(p.end).getTime();
  const from = Math.max(now, s), L = lines(p).filter((l) => !lines(p).some((x) => x !== l && x.code.startsWith(l.code + '.')));
  const left = monthsPerYear(from, Math.max(from + 1, e)), totalLeft = Object.values(left).reduce((a, b) => a + b, 0) || 1;
  const soon = monthsPerYear(from, Math.min(Math.max(from + 1, e), from + 3 * MONTH)), soonTot = Object.values(soon).reduce((a, b) => a + b, 0) || 1;
  const byH = new Map<string, { budget: number; spent: number; committed: number }>();
  for (const l of L) { const h = l.code.split('.')[0]; const x = byH.get(h) ?? { budget: 0, spent: 0, committed: 0 }; x.budget += l.approved ?? 0; x.spent += l.actual ?? 0; x.committed += lineCommitted(l); byH.set(h, x); }
  if (!byH.size) { const m = money(p); byH.set('*', { budget: m.budget, spent: m.spent, committed: m.committed }); }
  const past: Record<number, number> = {};
  for (let y = new Date(s).getUTCFullYear(); y <= new Date(now).getUTCFullYear(); y++) {
    const a = Math.max(s, Date.UTC(y, 0, 1)), b = Math.min(now, Date.UTC(y + 1, 0, 1)); if (b > a) past[y] = Math.max(0, spendAt(p, b) - spendAt(p, a));
  }
  const years = [...new Set([...Object.keys(past), ...Object.keys(left)].map(Number))].sort();
  const rows = [...byH].sort((a, b) => +a[0] - +b[0]).map(([h, x]) => {
    const free = Math.max(0, x.budget - x.spent - x.committed), byYear: Record<number, number> = {};
    for (const y of years) byYear[y] = (x.committed * (soon[y] ?? 0)) / soonTot + (free * (left[y] ?? 0)) / totalLeft;
    return { h, label: HEADINGS[h] ?? (h === '*' ? 'Whole project' : h), ...x, free, byYear };
  });
  const total: Record<number, number> = {};
  for (const y of years) total[y] = rows.reduce((a, r) => a + r.byYear[y], 0);
  return { years, past, rows, total, remaining: rows.reduce((a, r) => a + r.free + r.committed, 0) };
}
