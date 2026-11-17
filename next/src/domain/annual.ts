import { HEADINGS, lineCommitted, lines, money, parseDate, projectYearOf, projectYears, spendAt } from './calc';
import type { Project } from './types';

const MONTH = 30.4375 * 864e5;
export interface AnnualPlan { /** 'project': year 1 from the start date; 'calendar': 1 Jan – 31 Dec */ kind: 'project' | 'calendar'; /** the year today falls in */ current: number; /** name and dates of each year */ label: Record<number, { name: string; from: string; to: string }>; years: number[]; past: Record<number, number>; rows: { h: string; label: string; budget: number; spent: number; committed: number; free: number; byYear: Record<number, number> }[]; total: Record<number, number>; remaining: number }

type Period = { y: number; a: number; b: number; name: string; from: string; to: string };
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/** The years of a project: project years (from the start date), or calendar years for a portfolio sum. */
function periods(p: Project, kind: AnnualPlan['kind']): Period[] {
  if (kind === 'project') return projectYears(p.start, p.end).map((x) => ({ y: x.n, a: parseDate(x.from).getTime(), b: parseDate(x.to).getTime() + 864e5, name: x.label, from: x.from, to: x.to }));
  const out: Period[] = [];
  for (let y = parseDate(p.start).getUTCFullYear(); y <= parseDate(p.end).getUTCFullYear(); y++) out.push({ y, a: Date.UTC(y, 0, 1), b: Date.UTC(y + 1, 0, 1), name: String(y), from: iso(Math.max(Date.UTC(y, 0, 1), parseDate(p.start).getTime())), to: iso(Math.min(Date.UTC(y + 1, 0, 1) - 864e5, parseDate(p.end).getTime())) });
  return out;
}
/** Months of [from, to] that fall in each year. */
function monthsPerYear(P: Period[], from: number, to: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (const x of P) { const a = Math.max(from, x.a), b = Math.min(to, x.b); if (b > a) out[x.y] = (b - a) / MONTH; }
  return out;
}

/**
 * Cash still to be paid per year until the end date (project years by default; calendar years to add projects up), by heading: open commitments within the next three
 * months, the uncommitted balance spread evenly over the months left. Past years show spending already recorded.
 */
export function annualPlan(p: Project, today: Date, kind: AnnualPlan['kind'] = 'project'): AnnualPlan {
  const now = today.getTime(), s = parseDate(p.start).getTime(), e = parseDate(p.end).getTime(), P = periods(p, kind);
  const from = Math.max(now, s), L = lines(p).filter((l) => !lines(p).some((x) => x !== l && x.code.startsWith(l.code + '.')));
  const left = monthsPerYear(P, from, Math.max(from + 1, e)), totalLeft = Object.values(left).reduce((a, b) => a + b, 0) || 1;
  const soon = monthsPerYear(P, from, Math.min(Math.max(from + 1, e), from + 3 * MONTH)), soonTot = Object.values(soon).reduce((a, b) => a + b, 0) || 1;
  const byH = new Map<string, { budget: number; spent: number; committed: number }>();
  for (const l of L) { const h = l.code.split('.')[0]; const x = byH.get(h) ?? { budget: 0, spent: 0, committed: 0 }; x.budget += l.approved ?? 0; x.spent += l.actual ?? 0; x.committed += lineCommitted(l); byH.set(h, x); }
  if (!byH.size) { const m = money(p); byH.set('*', { budget: m.budget, spent: m.spent, committed: m.committed }); }
  const past: Record<number, number> = {};
  for (const x of P) { const a = Math.max(s, x.a), b = Math.min(now, x.b); if (b > a) past[x.y] = Math.max(0, spendAt(p, b) - spendAt(p, a)); }
  const years = [...new Set([...Object.keys(past), ...Object.keys(left)].map(Number))].sort();
  const rows = [...byH].sort((a, b) => +a[0] - +b[0]).map(([h, x]) => {
    const free = Math.max(0, x.budget - x.spent - x.committed), byYear: Record<number, number> = {};
    for (const y of years) byYear[y] = (x.committed * (soon[y] ?? 0)) / soonTot + (free * (left[y] ?? 0)) / totalLeft;
    return { h, label: HEADINGS[h] ?? (h === '*' ? 'Whole project' : h), ...x, free, byYear };
  });
  const total: Record<number, number> = {};
  for (const y of years) total[y] = rows.reduce((a, r) => a + r.byYear[y], 0);
  const current = kind === 'project' ? projectYearOf(p.start, iso(Math.max(now, s))) : today.getUTCFullYear();
  const label: AnnualPlan['label'] = {}; for (const x of P) label[x.y] = { name: x.name, from: x.from, to: x.to };
  return { kind, current, label, years, past, rows, total, remaining: rows.reduce((a, r) => a + r.free + r.committed, 0) };
}
