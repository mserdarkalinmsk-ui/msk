import { lineExposure, lines, n, parseDate } from './calc';
import { headings } from './insights';
import { roster } from './staff';
import { defaultOptions, forecastPeriod, staffRate, STANDARD_LINES, type ForecastOptions } from './forecastTemplate';
import type { Project } from './types';
import { costFactor, type InflationSettings } from './salaryProjection';

/**
 * The forecast filled in inside the app: planned units and rates per line for each planned block of the chosen template,
 * computed exactly as the Excel template does (proposal = spent — staff — or spent and committed + planned; rounded
 * version; variation), with the 25% check per heading that decides between a notification and an addendum.
 */
export type BlockId = 'p' | 'r' | 'e';
export interface PlanCell { u?: number; r?: number }
export interface ForecastDraft { /** keep the total fixed: the remainder goes to this line (default on, 5.7) */ auto?: { on?: boolean; line?: string }; /** local salary projection (Türkiye raise policy) */ infl?: InflationSettings; opt: ForecastOptions; lines: Record<string, Partial<Record<BlockId, PlanCell>>>; rates?: { r42?: number; r44?: number }; updatedAt?: string; notes?: string[]; /** revision note: justification per heading, and who prepares / approves */ just?: Record<string, string>; sign?: { by?: string; ok?: string }; /** notification letter: reference and the text per changed line */ letter?: { ref?: string; no?: string; lines?: Record<string, string> } }

export const isStaffLine = (code: string) => /^1\.[12]\.1\.\d+$/.test(code);
export const isChargeBack = (code: string) => code === '4.2' || code === '4.4';
const MONTH = 30.44 * 864e5;

/** The planned blocks of a template with their periods. */
export function planBlocks(p: Project, today: Date, o: ForecastOptions): { id: BlockId; label: string; from: string; to: string }[] {
  const per = forecastPeriod(p, today, o);
  if (o.kind === 'twelve') return [{ id: 'p', label: per.short ? 'To the end of the project' : `Next ${per.months} months`, from: per.from, to: per.to }];
  if (o.kind === 'payment') return [{ id: 'p', label: per.short ? 'To the end of the project' : `Next ${per.months} months`, from: per.from, to: per.to }, { id: 'r', label: 'Budget revision', from: per.revFrom, to: per.revTo }];
  if (o.kind === 'revision') return [{ id: 'p', label: per.extTo ? 'To the new end date' : 'To the end of the project', from: per.from, to: per.to }];
  return [{ id: 'p', label: 'To the current end', from: per.from, to: per.to }, { id: 'e', label: 'Extension', from: per.extFrom, to: per.extTo ?? per.extFrom }];
}

export interface PlanLine {
  code: string; description: string; unit: string; empty: boolean; staff: boolean; cb: boolean;
  budget: number; bUnits?: number; actual: number; sc: number; aUnits: number; aRate: number; rate?: number; /** rate used when none is typed (as in the Excel) */ defRate?: number; /** per planned block, when it differs (local salaries under the inflation projection) */ defRates?: Partial<Record<BlockId, number>>;
  cells: Partial<Record<BlockId, { u: number; r: number; cost: number }>>; planned: number;
  propUnits: number; propCost: number; rounded: number; variation: number | null;
}
export interface PlanHeading { code: string; label: string; baseline: number; budget: number; rounded: number; planned: number; change: number; beyond: boolean; isNew: boolean }
export interface PlanResult {
  blocks: ReturnType<typeof planBlocks>; lines: PlanLine[]; heads: PlanHeading[]; flex: number;
  direct: { budget: number; rounded: number; planned: number }; admin: { budget: number; rounded: number }; total: { budget: number; rounded: number };
  decision: 'none' | 'notification' | 'addendum'; reasons: string[];
}

/** Lines of the forecast: the template's standard lines plus the project's own, as in the Excel. */
export function planLines(p: Project): { code: string; description: string; unit: string; empty: boolean }[] {
  const L = lines(p), special = (c: string) => c === '10' || /^8(\.|$)/.test(c);
  const leafs = L.filter((l) => !special(l.code) && !L.some((o) => o !== l && o.code.startsWith(l.code + '.')));
  const mine = new Map(leafs.map((l) => [l.code, l]));
  const std = STANDARD_LINES.filter(([c, , u]) => u && !leafs.some((l) => c.startsWith(l.code + '.')) && !leafs.some((l) => l.code.startsWith(c + '.')));
  const codes = [...new Set([...std.map(([c]) => c), ...mine.keys()])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return codes.map((c) => { const l = mine.get(c), s = STANDARD_LINES.find(([x]) => x === c); return { code: c, description: l?.description || s?.[1] || '', unit: l?.unit || s?.[2] || '', empty: !l }; });
}

export function computePlan(p: Project, today: Date, d: ForecastDraft | undefined): PlanResult {
  const o = d?.opt ?? defaultOptions(p), blocks = planBlocks(p, today, o), L = lines(p), byCode = new Map(L.map((l) => [l.code, l]));
  const per0 = forecastPeriod(p, today, o);
  const end = o.extendTo && o.extendTo > p.end ? o.extendTo : p.end, monthsLeft = Math.max(0, (parseDate(end).getTime() - parseDate(blocks[0].from).getTime()) / MONTH);
  const out: PlanLine[] = planLines(p).map((x) => {
    const l = byCode.get(x.code), staff = isStaffLine(x.code), cb = isChargeBack(x.code);
    const budget = n(l?.approved), actual = n(l?.actual), sc = l ? lineExposure(l) : 0, aUnits = n(l?.reportedUnits);
    const aRate = aUnits ? actual / aUnits : n(l?.reportedUnitRate), rate = l?.unitRate ?? undefined;
    const defRate = staff ? staffRate(x.code, aRate || rate || 0, monthsLeft) || undefined : cb ? (aRate ? Math.round(aRate) : rate) : rate;
    // Local staff under the inflation projection: latest cost × average raise and EUR/TRY effect over each planned period.
    const defRates: Partial<Record<BlockId, number>> = {};
    if (d?.infl?.on && /^1\.1\.1\./.test(x.code) && (aRate || rate)) for (const b of blocks) defRates[b.id] = Math.ceil((aRate || rate || 0) * costFactor(per0.asAt, b.from, b.to, d.infl) / 5) * 5;
    const cells: PlanLine['cells'] = {};
    let planned = 0, pu = 0;
    for (const b of blocks) {
      const c = d?.lines[x.code]?.[b.id]; if (!c) continue;
      const u = n(c.u), r = c.r != null ? n(c.r) : n(defRates[b.id] ?? defRate), cost = u * r; cells[b.id] = { u, r, cost }; planned += cost; pu += u;
    }
    // As in the template: staff build on what is spent, charging back on its units and spent + committed, others on spent + committed.
    const u0 = staff || cb ? aUnits : aRate ? Math.round(sc / aRate) : rate && sc ? Math.round(sc / rate) : 0, c0 = staff ? actual : sc;
    const propUnits = u0 + pu, propCost = c0 + planned;
    const rounded = propUnits > 0 ? Math.round(propCost / propUnits) * propUnits : propCost;
    return { ...x, staff, cb, budget, bUnits: l?.approvedUnits ?? undefined, actual, sc, aUnits, aRate, rate, defRate, defRates, cells, planned, propUnits, propCost, rounded, variation: budget > 0 ? (rounded - budget) / budget : null };
  });
  // Keep the total fixed: the balance line takes the rounding of the others, so the rounded proposal equals the budget.
  const plug = d ? autoLine(d) : null, pl = plug ? out.find((x) => x.code === plug) : undefined;
  if (pl) { const target = out.reduce((a, x) => a + x.budget, 0), others = out.reduce((a, x) => a + (x === pl ? 0 : x.rounded), 0); const v = Math.round((target - others) * 100) / 100;
    // Only the rounding of the rates (at most half a euro per unit) — never a real change typed on the line.
    const slack = out.reduce((a, x) => a + Math.abs(x.propUnits) * 0.5, 0) + 1;
    if (v >= 0 && Math.abs(v - pl.rounded) <= slack) pl.rounded = v; }
  const H = headings(p), flex = H.flex;
  const heads: PlanHeading[] = ['1', '2', '3', '4', '5', '6'].map((h) => {
    const ls = out.filter((x) => x.code.split('.')[0] === h), hr = H.rows.find((r) => r.code === h);
    const budget = ls.reduce((a, x) => a + x.budget, 0), rounded = ls.reduce((a, x) => a + x.rounded, 0), planned = ls.reduce((a, x) => a + x.planned, 0);
    const baseline = hr?.baseline ?? budget, change = baseline ? (rounded - baseline) / baseline : rounded ? 1 : 0;
    return { code: h, label: hr?.label ?? h, baseline, budget, rounded, planned, change, beyond: baseline > 0 && Math.abs(change) > flex + 1e-9, isNew: !baseline && rounded > 0.5 };
  });
  const dB = heads.reduce((a, h) => a + h.budget, 0), dR = heads.reduce((a, h) => a + h.rounded, 0), dP = heads.reduce((a, h) => a + h.planned, 0);
  const adminB = n(byCode.get('10')?.approved) || Math.round(dB * 7) / 100, adminR = Math.round(dR * 7) / 100;
  const reasons: string[] = [];
  for (const h of heads) if (h.beyond) reasons.push(`${h.code} ${h.label}: ${h.change > 0 ? '+' : ''}${Math.round(h.change * 1000) / 10}% against the agreement (limit ${Math.round(flex * 100)}%)`);
  for (const h of heads) if (h.isNew) reasons.push(`${h.code} ${h.label}: a new heading`);
  const tol = Math.max(50, dB * 0.0005); // rounding of the rounded version
  if (Math.abs(dR - dB) > tol) reasons.push(`Direct costs ${dR > dB ? 'exceed' : 'fall short of'} the budget by €${Math.abs(dR - dB).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — balance the plan (e.g. on 5.7) or it changes the total cost`);
  const changed = heads.some((h) => Math.abs(h.rounded - h.budget) > 1);
  const decision = o.kind === 'twelve' || dP === 0 ? 'none' : heads.some((h) => h.beyond || h.isNew) || Math.abs(dR - dB) > tol ? 'addendum' : changed ? 'notification' : 'none';
  return { blocks, lines: out, heads, flex, direct: { budget: dB, rounded: dR, planned: dP }, admin: { budget: adminB, rounded: adminR }, total: { budget: dB + adminB, rounded: dR + adminR }, decision, reasons };
}

/** Months of [from, to] covered by [a, b], in months of 30.44 days, to two decimals. */
export function monthsIn(from: string, to: string, a: string, b: string): number {
  const s = Math.max(parseDate(from).getTime(), parseDate(a).getTime()), e = Math.min(parseDate(to).getTime() + 864e5, parseDate(b).getTime() + 864e5);
  return e > s ? Math.round(((e - s) / MONTH) * 100) / 100 : 0;
}

/**
 * Guidelines steps 5 and 6: staff units from the contracts on each line (months of each contract in the planned period ×
 * FTE, contracts running to the end date carried on), rates from the latest cost plus the guideline margin; charging back
 * (4.2 office rent, 4.4 office furniture) on the local staff months at the given monthly rates.
 */
export function autofillStaff(p: Project, today: Date, d: ForecastDraft): ForecastDraft {
  const o = d.opt, blocks = planBlocks(p, today, o), end = o.extendTo && o.extendTo > p.end ? o.extendTo : p.end;
  const plan = computePlan(p, today, d), people = roster(p, today), notes: string[] = [];
  const monthsLeft = Math.max(0, (parseDate(end).getTime() - parseDate(blocks[0].from).getTime()) / MONTH);
  const next = { ...d, lines: { ...d.lines } };
  const localMonths: Partial<Record<BlockId, number>> = {};
  for (const x of plan.lines.filter((l) => l.staff)) {
    const who = people.filter((a) => a.code === x.code && a.status !== 'Ended');
    const cell: Partial<Record<BlockId, PlanCell>> = { ...next.lines[x.code] };
    const rate = staffRate(x.code, x.aRate || x.rate || 0, monthsLeft) || undefined;
    for (const b of blocks) {
      // A contract ending before the project end is assumed renewed to the end (the post stays); the guidelines ask to
      // check the fiche staff — the note below lists who was counted.
      const u = who.reduce((a, s) => a + (s.start ? monthsIn(b.from, b.to, s.start, end) * (s.fte ?? 1) : 0), 0);
      if (!who.length && !x.budget) continue;
      cell[b.id] = { u: Math.round(u * 100) / 100, r: cell[b.id]?.r ?? (d.infl?.on && /^1\.1\./.test(x.code) ? undefined : rate) };
      if (/^1\.1\./.test(x.code)) localMonths[b.id] = (localMonths[b.id] ?? 0) + u;
    }
    if (who.length) notes.push(`${x.code}: ${who.map((s) => `${s.display}${s.fte != null && s.fte !== 1 ? ` (${Math.round(s.fte * 100)}%)` : ''}${s.end && s.end < end ? `, contract to ${s.end} carried on` : ''}`).join('; ')}`);
    else if (x.budget) notes.push(`${x.code}: no contract on file — fill in by hand`);
    next.lines[x.code] = cell;
  }
  const r42 = d.rates?.r42 ?? (plan.lines.find((l) => l.code === '4.2')?.aRate ? Math.round(plan.lines.find((l) => l.code === '4.2')!.aRate) : undefined);
  const r44 = d.rates?.r44 ?? (plan.lines.find((l) => l.code === '4.4')?.aRate ? Math.round(plan.lines.find((l) => l.code === '4.4')!.aRate) : undefined);
  for (const [code, r] of [['4.2', r42], ['4.4', r44]] as const) {
    if (!plan.lines.some((l) => l.code === code && (l.budget || l.actual))) continue;
    const cell: Partial<Record<BlockId, PlanCell>> = {};
    for (const b of blocks) cell[b.id] = { u: Math.round((localMonths[b.id] ?? 0) * 100) / 100, r };
    next.lines[code] = cell;
  }
  notes.push(`4.2 / 4.4: units = local staff months (${blocks.map((b) => Math.round((localMonths[b.id] ?? 0) * 100) / 100).join(' + ')}), rates ${r42 ?? '—'} / ${r44 ?? '—'} per month`);
  return { ...next, rates: { r42, r44 }, notes, updatedAt: new Date().toISOString() };
}

/** Guidelines step 8: the difference with the budget goes on 5.7 (or the line given), in its last planned block. */
export function balanceOn(p: Project, today: Date, d: ForecastDraft, code = '5.7'): ForecastDraft {
  // The calculated proposal (spent and committed + planned) must equal the direct budget: the line's units are rounded to
  // two decimals and its rate takes the exact remainder, so the cost matches to the cent (the rounded version is kept
  // equal by computePlan, which gives the line the rounding of the other rates).
  const plan = computePlan(p, today, d), line = plan.lines.find((l) => l.code === code); if (!line) return d;
  const calc = plan.lines.reduce((a, l) => a + l.propCost, 0), diff = plan.direct.budget - calc;
  const b = plan.blocks.at(-1)!.id, cur = line.cells[b], have = cur ? cur.u * cur.r : 0;
  const need = have + diff, r0 = (cur?.r || line.defRate || line.aRate || 1);
  if (Math.abs(diff) < 0.005) return d;
  if (need <= 0) return { ...d, lines: { ...d.lines, [code]: { ...d.lines[code], [b]: { u: 0, r: r0 } } }, updatedAt: new Date().toISOString() };
  const u = Math.max(0.01, Math.round((need / r0) * 100) / 100), r = need / u;
  return { ...d, lines: { ...d.lines, [code]: { ...d.lines[code], [b]: { u, r } } }, updatedAt: new Date().toISOString() };
}

/** The plan with every rate resolved (typed, or the default the screen shows), as written into the Excel. */
export function resolvedLines(p: Project, today: Date, d: ForecastDraft): ForecastDraft['lines'] {
  const R = computePlan(p, today, d), out: ForecastDraft['lines'] = {};
  for (const l of R.lines) for (const [b, c] of Object.entries(l.cells) as [BlockId, { u: number; r: number }][]) (out[l.code] ??= {})[b] = { u: c.u || undefined, r: c.r };
  return out;
}

/**
 * The total stays fixed: the plug line (5.7 by default) takes in its last planned period whatever keeps the direct costs
 * equal to the budget. Off for the 12-month forecast, which is not a budget revision.
 */
export function autoLine(d: ForecastDraft): string | null { return d.opt.kind !== 'twelve' && d.auto?.on !== false ? d.auto?.line ?? '5.7' : null; }
export function effective(p: Project, today: Date, d: ForecastDraft): ForecastDraft {
  const code = autoLine(d); if (!code) return d;
  const b = planBlocks(p, today, d.opt).at(-1)!.id, keep = d.lines[code]?.[b]?.r;
  const cleared: ForecastDraft = { ...d, lines: { ...d.lines, [code]: { ...d.lines[code], [b]: { r: keep } } } };
  return balanceOn(p, today, cleared, code);
}
