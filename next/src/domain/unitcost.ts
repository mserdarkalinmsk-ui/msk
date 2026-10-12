import { HEADINGS, lines } from './calc';
import type { Project } from './types';

export interface UnitPoint { p: Project; code: string; description: string; unit: string; budgetRate: number | null; actualRate: number | null; units: number | null; vsBudget: number | null; vsMedian: number | null }
export interface UnitGroup { key: string; label: string; unit: string; heading: string; points: UnitPoint[]; median: number; min: number; max: number; spread: number; flags: number; comparable: boolean }

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
const normUnit = (u: string) => u.trim().toLowerCase().replace(/^per\s+/, '').replace(/s$/, '');

/**
 * Unit rates of the same budget line across projects (the CoE template numbers lines the same way: 1.1.1.2 project
 * manager, 5.5.2 interpretation …). Budget rate = approved ÷ units; actual rate = reported cost ÷ reported units.
 * Each project is compared with the portfolio median of the group and its own budget rate.
 */
export function unitCosts(P: Project[]): UnitGroup[] {
  const by = new Map<string, UnitPoint[]>();
  for (const p of P) for (const l of lines(p)) {
    const br = l.unitRate ?? (l.approvedUnits ? (l.approved ?? 0) / l.approvedUnits : null);
    const ar = l.reportedUnitRate ?? (l.reportedUnits ? (l.actual ?? 0) / l.reportedUnits : null);
    if (!(br && br > 0) && !(ar && ar > 0)) continue;
    const unit = normUnit(l.unit ?? '');
    const key = `${l.code}|${unit}`;
    by.set(key, [...(by.get(key) ?? []), { p, code: l.code, description: l.description ?? '', unit, budgetRate: br && br > 0 ? br : null, actualRate: ar && ar > 0 ? ar : null, units: l.approvedUnits ?? null, vsBudget: br && ar && br > 0 && ar > 0 ? ar / br - 1 : null, vsMedian: null }]);
  }
  const out: UnitGroup[] = [];
  for (const [key, pts] of by) {
    const ref = pts.map((x) => x.actualRate ?? x.budgetRate!).filter((v) => v > 0);
    const med = median(ref);
    // Lump-sum style units (item, lump sum, package) or rates more than 8× apart are different things, not dearer ones.
    const comparable = pts.length > 1 && !/^(item|lump ?sum|global|package|lot|unit)$/.test(pts[0].unit) && Math.max(...ref) / Math.max(1e-9, Math.min(...ref)) <= 8;
    for (const x of pts) x.vsMedian = comparable && med ? (x.actualRate ?? x.budgetRate!) / med - 1 : null;
    const all = pts.flatMap((x) => [x.budgetRate, x.actualRate].filter((v): v is number => !!v));
    const desc = [...pts.reduce((m, x) => m.set(x.description, (m.get(x.description) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0][0];
    const code = pts[0].code, h = code.split('.')[0];
    const flags = pts.filter((x) => (x.vsBudget ?? 0) > 0.15 || (x.vsMedian ?? 0) > 0.25).length;
    out.push({ key, label: `${code} ${desc}`, unit: pts[0].unit, heading: HEADINGS[h] ? `${h} ${HEADINGS[h]}` : h, points: pts, median: med, min: Math.min(...all), max: Math.max(...all), spread: med ? (Math.max(...all) - Math.min(...all)) / med : 0, flags, comparable });
  }
  return out.sort((a, b) => b.flags - a.flags || b.points.length - a.points.length || a.key.localeCompare(b.key, undefined, { numeric: true }));
}
