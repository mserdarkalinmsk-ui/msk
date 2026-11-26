/**
 * Portfolio analysis behind the story and the Analysis screen:
 *  - why a project is behind plan, heading by heading;
 *  - whether the money left can still be spent by the end date (the pace needed against the best pace reached);
 *  - how spending against plan and the staff share moved from report to report.
 * Every figure comes from the reports already loaded; nothing is assumed beyond the linear plan the monitoring sheet uses.
 */
import { asOf, elapsed, forecastRate, lines, money, n, parseDate, reportsByDate } from './calc';
import { perfTrend } from './monitor';
import { outcome } from './insights';
import { ADMIN_LINE } from './terms';
import type { Project } from './types';

const DAY = 86_400_000, MONTH = 30.4375 * DAY;
export const HEAD_LABEL: Record<string, string> = { '1': 'Human resources', '2': 'Travel', '3': 'Equipment and supplies', '4': 'Local office', '5': 'Other costs, services', '6': 'Grants', '7': 'Other' };

/** Leaf lines of the direct costs (no admin line, no contingency). */
const directLeaves = (p: Project) => {
  const L = lines(p);
  return L.filter((l) => !L.some((x) => x !== l && x.code.startsWith(l.code + '.'))).filter((l) => { const h = l.code.split('.')[0]; return h !== ADMIN_LINE && h !== '8' && h !== '9'; });
};

export interface Driver { heading: string; label: string; budget: number; planned: number; spent: number; /** spent − planned: below zero = behind */ gap: number; /** share of the total shortfall (behind headings only) */ share: number }
/** Where the gap to the linear plan comes from: each heading's spending against its budget × time elapsed. */
export function gapDrivers(p: Project, today: Date): { planned: number; spent: number; gap: number; el: number; drivers: Driver[] } {
  const el = elapsed(p, asOf(p, today)), H = new Map<string, { budget: number; spent: number }>();
  for (const l of directLeaves(p)) {
    const k = l.code.split('.')[0], h = H.get(k) ?? { budget: 0, spent: 0 };
    h.budget += n(l.approved); h.spent += n(l.actual); H.set(k, h);
  }
  const D = [...H].filter(([, h]) => h.budget > 0 || h.spent > 0).map(([k, h]) => ({ heading: k, label: HEAD_LABEL[k] ?? `Heading ${k}`, budget: h.budget, planned: h.budget * el, spent: h.spent, gap: h.spent - h.budget * el, share: 0 }));
  const short = D.reduce((a, d) => a + Math.min(0, d.gap), 0);
  for (const d of D) d.share = short < 0 && d.gap < 0 ? d.gap / short : 0;
  const planned = D.reduce((a, d) => a + d.planned, 0), spent = D.reduce((a, d) => a + d.spent, 0);
  return { planned, spent, gap: spent - planned, el, drivers: D.sort((a, b) => a.gap - b.gap) };
}

export type CapacityVerdict = 'too early' | 'done' | 'on pace' | 'reached before' | 'stretch' | 'out of reach';
export interface Capacity { remaining: number; monthsLeft: number; need: number; avg: number; best: number; bestFrom?: string; bestTo?: string; /** need ÷ best pace reached */ ratio: number; verdict: CapacityVerdict; /** started less than a tenth of its time ago with nothing spent: no pace to judge */ early: boolean; /** left unspent at the end if the pace stays as it is */ unspent: number }
/**
 * Can the money left be spent by the end date? The monthly pace needed is set against the average pace and the best pace
 * reached between two reports (at least six weeks apart, so a single catch-up posting does not count as a pace).
 */
export function capacity(p: Project, today: Date): Capacity {
  const m = money(p), at = asOf(p, today).getTime(), end = parseDate(p.end).getTime();
  const remaining = Math.max(0, m.budget - m.spent), monthsLeft = Math.max(0, (end - at) / MONTH);
  const avg = forecastRate(p, today).rate;
  const pts = reportsByDate(p).filter((r) => r.snapshot?.lines?.length && !/approved budget/i.test(r.type ?? ''))
    .map((r) => ({ d: r.date, t: parseDate(r.date).getTime(), v: r.snapshot!.lines.reduce((a, l) => a + n(l.actual), 0) }));
  pts.unshift({ d: p.start, t: parseDate(p.start).getTime(), v: 0 });
  let best = avg, bestFrom: string | undefined, bestTo: string | undefined;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const dt = pts[j].t - pts[i].t; if (dt < 42 * DAY) continue;
    const r = (pts[j].v - pts[i].v) / (dt / MONTH);
    if (r > best) { best = r; bestFrom = pts[i].d; bestTo = pts[j].d; }
  }
  const need = monthsLeft > 0.25 ? remaining / monthsLeft : remaining > 0.5 ? Infinity : 0;
  const ratio = best > 0 ? need / best : need > 0 ? Infinity : 0;
  const early = m.spent < 0.5 && elapsed(p, asOf(p, today)) < 0.1;
  const verdict: CapacityVerdict = early ? 'too early' : remaining < 0.5 ? 'done' : need <= avg * 1.1 ? 'on pace' : need <= best ? 'reached before' : need <= best * 1.5 ? 'stretch' : 'out of reach';
  // Left unspent as the end-of-project forecast says (spending at the pace, never below spent + committed).
  return { remaining, monthsLeft, need, avg, best, bestFrom, bestTo, ratio, verdict, early, unspent: early ? 0 : outcome(p, today).unused };
}

export interface TrendPoint { date: string; perf: number; staff: number | null; spent: number }
/** Spending against plan and the staff share of spending at each report; the change over the last report. */
export function trendOf(p: Project): { points: TrendPoint[]; dPerf: number | null; dStaff: number | null; worsening: boolean } {
  const T = perfTrend(p), R = reportsByDate(p);
  const points = T.map((t) => {
    const r = R.find((x) => x.date === t.date && x.snapshot?.lines?.length);
    const L = r?.snapshot?.lines ?? [], all = L.filter((l) => !L.some((x) => x !== l && x.code.startsWith(l.code + '.')) && l.code.split('.')[0] !== ADMIN_LINE);
    const tot = all.reduce((a, l) => a + n(l.actual), 0), st = all.filter((l) => /^1\.[12]\.1(\.|$)/.test(l.code)).reduce((a, l) => a + n(l.actual), 0);
    return { date: t.date, perf: t.perf, staff: tot > 0 ? st / tot : null, spent: t.spent };
  });
  const a = points.at(-2), b = points.at(-1);
  const dPerf = a && b ? b.perf - a.perf : null, dStaff = a && b && a.staff != null && b.staff != null ? b.staff - a.staff : null;
  return { points, dPerf, dStaff, worsening: (dPerf != null && dPerf < -0.03) || (dStaff != null && dStaff > 0.05) };
}

/** Where each project ends at its current pace: spent at the end and what stays unspent (capped at the budget). */
// The end-of-project forecast's projection, so the Analysis and the story read the same as the project page and Ending soon.
export function endOf(p: Project, today: Date) {
  const m = money(p), atEnd = Math.min(m.budget, outcome(p, today).projected);
  return { budget: m.budget, spent: m.spent, atEnd, unspent: Math.max(0, m.budget - atEnd), share: m.budget ? atEnd / m.budget : 0 };
}

/**
 * The portfolio walk from planned to spent (direct costs): the net gap of each heading across the projects, the total
 * shortfall of the headings behind, and the heading that carries most of it. Projects that have just started are left out.
 */
export function portfolioWalk(P: Project[], today: Date) {
  const G = P.filter((p) => !capacity(p, today).early).map((p) => gapDrivers(p, today));
  const heads = [...new Set(G.flatMap((g) => g.drivers.map((d) => d.heading)))].sort();
  const steps = heads.map((h) => ({ heading: h, label: `${h} ${HEAD_LABEL[h] ?? ''}`.trim(), gap: G.reduce((a, g) => a + (g.drivers.find((d) => d.heading === h)?.gap ?? 0), 0) })).filter((x) => Math.abs(x.gap) >= 1);
  const planned = G.reduce((a, g) => a + g.planned, 0), spent = G.reduce((a, g) => a + g.spent, 0), shortfall = steps.reduce((a, x) => a + Math.min(0, x.gap), 0);
  const lead = [...steps].sort((a, b) => a.gap - b.gap)[0];
  return { planned, spent, gap: spent - planned, steps, shortfall, lead: lead && lead.gap < 0 ? { ...lead, share: shortfall < 0 ? lead.gap / shortfall : 0 } : null };
}
