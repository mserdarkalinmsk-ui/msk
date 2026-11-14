import { elapsed, HEADINGS, perProject, lineExposure, lines, n, parseDate } from './calc';
import { headings } from './insights';
import type { Project } from './types';
import { ahead, type Basis } from './forecast';

/**
 * Early warning for budget changes (EU–CoE): for each heading, the spending expected by the end date at the
 * current pace, the transfer it will need, and whether that transfer stays a notification (within the
 * flexibility of the amount originally entered) or will need an addendum — before it happens.
 */
export type Stage = 'ok' | 'watch' | 'notify' | 'notify-now' | 'addendum';
export const STAGE: Record<Stage, { label: string; tone: string; order: number }> = {
  'addendum': { label: 'Addendum ahead', tone: 'critical', order: 0 },
  'notify-now': { label: 'Notify now', tone: 'serious', order: 1 },
  'notify': { label: 'Notification ahead', tone: 'warning', order: 2 },
  'watch': { label: 'Watch', tone: 'neutral', order: 3 },
  'ok': { label: 'On track', tone: 'good', order: 4 },
};
export interface HeadWarn {
  p: Project; code: string; label: string; baseline: number; current: number; exposure: number; projected: number;
  need: number; changeIfCovered: number; flex: number; stage: Stage; basis: Basis; by: string | null; from?: { code: string; label: string; spare: number }; why: string; lines: string[];
}
const MONTH = 30.44 * 864e5;

export const earlyWarnings = perProject(earlyWarningsOf);
function earlyWarningsOf(p: Project, today: Date): HeadWarn[] {
  if (!p.approvedBudget?.lines?.length || p.datesTbc) return [];
  const H = headings(p), flex = H.flex, el = elapsed(p, today), L = lines(p);
  const t0 = parseDate(p.start).getTime(), t1 = parseDate(p.end).getTime(), now = today.getTime();
  const monthsGone = Math.max(1, (now - t0) / MONTH); void t1;
  const actual = (c: string) => L.filter((l) => l.code.split('.')[0] === c).reduce((a, l) => a + n(l.actual), 0);
  const rows = H.rows.map((h) => {
    const a = actual(h.code);
    // At the end date: spent + committed today, then the report's plan for the heading and the heading's pace after it.
    const f = ahead(p, today, el < 0.1 ? 0 : a / monthsGone, (l) => l.code.split('.')[0] === h.code);
    const projected = h.exposure + f.add;
    return { h, a, projected, basis: f.basis, spare: Math.max(0, h.approved - projected) };
  });
  return rows.map(({ h, a, projected, basis }) => {
    const need = projected - h.approved, after = h.approved + Math.max(0, need);
    const changeIfCovered = h.baseline ? (after - h.baseline) / h.baseline : 0;
    const already = h.baseline ? Math.abs(h.approved - h.baseline) / h.baseline : 0;
    const over = L.filter((l) => l.code.split('.')[0] === h.code && n(l.approved) > 0 && lineExposure(l) > n(l.approved) + 1).map((l) => l.code);
    // When spent + committed reaches the heading budget at the current pace.
    const pace = a / monthsGone;
    const by = need > 0 ? (h.exposure >= h.approved ? today.toISOString().slice(0, 10) : pace > 0 ? new Date(now + ((h.approved - h.exposure) / pace) * MONTH).toISOString().slice(0, 10) : null) : null;
    let stage: Stage = 'ok', why = 'Spending at the current pace stays within the heading.';
    if (need > 1 && changeIfCovered > flex + 1e-9) { stage = 'addendum'; why = `At the current pace the heading needs ${Math.round(changeIfCovered * 100)}% more than agreed — beyond the ${Math.round(flex * 100)}% flexibility.`; }
    else if (h.exposure > h.approved + 1) { stage = 'notify-now'; why = 'Spent + committed is already above the heading budget — transfer and notify now.'; }
    else if (need > 1) { stage = 'notify'; why = `Will run short by the end date; a transfer of about ${need.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € stays within ${Math.round(flex * 100)}%.`; }
    else if (already > flex * 0.7 || h.approved && h.exposure / h.approved > 0.9 || over.length) { stage = 'watch'; why = already > flex * 0.7 ? `Already ${Math.round(already * 100)}% from the agreement — little room left for further transfers.` : over.length ? `Line${over.length > 1 ? 's' : ''} ${over.join(', ')} above budget — a transfer within the heading is enough.` : 'Over 90% used.'; }
    // Where the money could come from: the heading with the largest spare amount still inside its own flexibility.
    const src = rows.filter((r) => r.h.code !== h.code).map((r) => ({ code: r.h.code, label: HEADINGS[r.h.code] ?? r.h.code, spare: Math.min(r.spare, Math.max(0, r.h.approved - r.h.baseline * (1 - flex))) })).sort((x, y) => y.spare - x.spare)[0];
    return { p, code: h.code, label: h.label, baseline: h.baseline, current: h.approved, exposure: h.exposure, projected, need: Math.max(0, need), changeIfCovered, flex, stage, basis, by, from: need > 1 && src?.spare > 0 ? src : undefined, why, lines: over };
  });
}

export function portfolioWarnings(P: Project[], today: Date): HeadWarn[] {
  return P.flatMap((p) => earlyWarnings(p, today)).filter((w) => w.stage !== 'ok').sort((a, b) => STAGE[a.stage].order - STAGE[b.stage].order || b.need - a.need);
}
