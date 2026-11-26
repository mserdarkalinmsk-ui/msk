import { byUpload, HEADINGS, lines } from './calc';
import { usedUnitsOf } from './rates';
import type { Project } from './types';

export interface UnitPoint { p: Project; code: string; description: string; unit: string; budgetRate: number | null; actualRate: number | null; units: number | null; vsBudget: number | null; vsMedian: number | null; /** the spending is a package bought for a whole event, not this unit: kept out of the comparison */ note?: string }
export interface UnitGroup { key: string; label: string; unit: string; heading: string; points: UnitPoint[]; median: number; min: number; max: number; spread: number; flags: number; comparable: boolean }

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
const normUnit = (u: string) => u.trim().toLowerCase().replace(/^per\s+/, '').replace(/s$/, '');

/**
 * Unit rates of the same budget line across projects (the CoE template numbers lines the same way: 1.1.1.2 project
 * manager, 5.5.2 interpretation …). Budget rate = approved ÷ units; actual rate = reported cost ÷ reported units.
 * Each project is compared with the portfolio median of the group and its own budget rate.
 */
const EVENT_ORDER = /organi[sz]ation of|organi[sz]ing (the|a|an)\b|organizasyon(u| hizmet)|event organi[sz]/i;
/**
 * A line paid only through orders that buy a whole event (an organiser's "Organisation of the RTM …" with 1 unit for
 * the transport of everyone) has no rate per trip or per person: its cost ÷ units is the price of a package.
 */
function eventPackage(p: Project, code: string, unit: string): string | null {
  if (/event|meeting|conference|workshop|lump|package|item/.test(unit)) return null;
  const wb = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.workbook).sort(byUpload).at(-1)?.snapshot?.workbook;
  const pos = (wb?.pos ?? []).filter((x) => x.line === code && x.spent > 0.005);
  if (!pos.length || !pos.every((x) => EVENT_ORDER.test(x.description) && (x.units ?? 0) <= 2)) return null;
  return `paid as part of an event package (${pos.map((x) => `${x.supplier.trim() || 'PO ' + x.po}: ${x.description.slice(0, 60)}`).join('; ')}) — not a rate per ${unit || 'unit'}`;
}

export function unitCosts(P: Project[]): UnitGroup[] {
  const by = new Map<string, UnitPoint[]>();
  for (const p of P) for (const l of lines(p)) {
    const br = l.unitRate ?? (l.approvedUnits ? (l.approved ?? 0) / l.approvedUnits : null);
    // Units of a raw extraction are only estimated: they are counted at the latest full report's average cost.
    const u = usedUnitsOf(p, l), ar = l.unitsEstimated ? (u ? (l.actual ?? 0) / u : null) : l.reportedUnitRate ?? (u ? (l.actual ?? 0) / u : null);
    if (!(br && br > 0) && !(ar && ar > 0)) continue;
    const unit = normUnit(l.unit ?? '');
    const key = `${l.code}|${unit}`;
    const note = ar && ar > 0 ? eventPackage(p, l.code, unit) ?? undefined : undefined;
    by.set(key, [...(by.get(key) ?? []), { p, code: l.code, description: l.description ?? '', unit, budgetRate: br && br > 0 ? br : null, actualRate: ar && ar > 0 ? ar : null, units: l.approvedUnits ?? null, vsBudget: !note && br && ar && br > 0 && ar > 0 ? ar / br - 1 : null, vsMedian: null, note }]);
  }
  const out: UnitGroup[] = [];
  for (const [key, pts] of by) {
    // A package price says nothing about the rate: such a project is compared on its budget rate.
    const rate = (x: UnitPoint) => (x.note ? x.budgetRate : x.actualRate ?? x.budgetRate);
    const ref = pts.map((x) => rate(x) ?? 0).filter((v) => v > 0);
    const med = median(ref);
    // Lump-sum style units (item, lump sum, package) or rates more than 8× apart are different things, not dearer ones.
    const comparable = pts.length > 1 && !/^(item|lump ?sum|global|package|lot|unit)$/.test(pts[0].unit) && Math.max(...ref) / Math.max(1e-9, Math.min(...ref)) <= 8;
    for (const x of pts) x.vsMedian = comparable && med && rate(x) ? rate(x)! / med - 1 : null;
    const all = pts.flatMap((x) => [x.budgetRate, x.note ? null : x.actualRate].filter((v): v is number => !!v));
    const desc = [...pts.reduce((m, x) => m.set(x.description, (m.get(x.description) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0][0];
    const code = pts[0].code, h = code.split('.')[0];
    const flags = pts.filter((x) => (x.vsBudget ?? 0) > 0.15 || (x.vsMedian ?? 0) > 0.25).length;
    out.push({ key, label: `${code} ${desc}`, unit: pts[0].unit, heading: HEADINGS[h] ? `${h} ${HEADINGS[h]}` : h, points: pts, median: med, min: Math.min(...all), max: Math.max(...all), spread: med ? (Math.max(...all) - Math.min(...all)) / med : 0, flags, comparable });
  }
  return out.sort((a, b) => b.flags - a.flags || b.points.length - a.points.length || a.key.localeCompare(b.key, undefined, { numeric: true }));
}
