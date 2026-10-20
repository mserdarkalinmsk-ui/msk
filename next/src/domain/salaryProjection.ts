/**
 * Local salary projection (Türkiye): the raise policy of the Inflation & FX Monitor — July–June financial year; when CPI
 * compounded since the last reset passes the threshold (7%) a raise (7%, or the cumulative rate when a single month alone
 * passes the threshold) applies from the 1st of the following month; a June trigger is not applied on 1 July but goes to
 * the January catch-up, which adds the gap between the CPI and the raises of the previous financial year.
 * Known CPI (TurkStat, monthly %) is used where available and an assumed monthly rate after it; the salary in euros also
 * moves with the assumed monthly change of EUR/TRY.
 */
export const CPI_TR: Record<string, number> = {
  '2022-07': 2.37, '2022-08': 1.46, '2022-09': 3.08, '2022-10': 3.54, '2022-11': 2.88, '2022-12': 1.18, '2023-01': 6.65, '2023-02': 3.15, '2023-03': 2.29,
  '2023-04': 2.39, '2023-05': 0.04, '2023-06': 3.92, '2023-07': 9.49, '2023-08': 9.09, '2023-09': 4.75, '2023-10': 3.43, '2023-11': 3.28, '2023-12': 2.93,
  '2024-01': 6.70, '2024-02': 4.53, '2024-03': 3.16, '2024-04': 3.60, '2024-05': 3.37, '2024-06': 1.64, '2024-07': 3.23, '2024-08': 2.89, '2024-09': 2.97,
  '2024-10': 2.88, '2024-11': 2.24, '2024-12': 1.03, '2025-01': 5.03, '2025-02': 2.27, '2025-03': 2.46, '2025-04': 3.00, '2025-05': 1.53, '2025-06': 1.37,
  '2025-07': 2.06, '2025-08': 2.04, '2025-09': 3.23, '2025-10': 2.55, '2025-11': 0.87, '2025-12': 0.89, '2026-01': 4.84, '2026-02': 2.96, '2026-03': 1.94,
  '2026-04': 4.18, '2026-05': 1.71, '2026-06': 0.99, '2026-07': 1.78, '2026-08': 1.84, '2026-09': 1.84,
};
export const CPI_LAST = Object.keys(CPI_TR).sort().at(-1)!;

export interface InflationSettings { on: boolean; cpi?: number; fx?: number; threshold?: number; raise?: number; /** months typed by the user after the embedded series */ extra?: Record<string, number> }
export interface RaiseEvent { month: string; pct: number; kind: 'raise' | 'spike' | 'catch-up'; projected: boolean }

const key = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;
const next = (k: string) => { const [y, m] = k.split('-').map(Number); return m === 12 ? key(y + 1, 1) : key(y, m + 1); };

/** Average monthly CPI of the last `n` known months — the default assumption. */
export function recentCpi(n = 6, extra: Record<string, number> = {}): number {
  const all = { ...CPI_TR, ...extra }, ks = Object.keys(all).sort().slice(-n);
  return Math.round(ks.reduce((a, k) => a + all[k], 0) / ks.length * 100) / 100;
}

/** Salary index by month (1 = July 2022) under the policy, with the raises applied and whether they are projected. */
export function salaryPath(until: string, s: InflationSettings): { index: Map<string, number>; events: RaiseEvent[]; lastKnown: string } {
  const threshold = s.threshold ?? 7, raise = s.raise ?? 7, known = { ...CPI_TR, ...(s.extra ?? {}) }, assumed = s.cpi ?? recentCpi(6, s.extra);
  const lastKnown = Object.keys(known).sort().at(-1)!;
  let cpiIndex = 100, raiseIndex = 100, monitor = 100, pending = false, pendingPct = raise, pendingSpike = false, knownInFY = 0, sal = 1;
  const completed = new Map<number, number>(), index = new Map<string, number>(), events: RaiseEvent[] = [];
  for (let k = '2022-07'; k <= until; k = next(k)) {
    const [y, m] = k.split('-').map(Number), proj = !(k in known), inf = known[k] ?? assumed;
    if (m === 7) { pending = false; pendingPct = raise; cpiIndex = 100; raiseIndex = 100; monitor = 100; knownInFY = 0; }
    if (pending) { raiseIndex *= 1 + pendingPct / 100; sal *= 1 + pendingPct / 100; events.push({ month: k, pct: pendingPct, kind: pendingSpike ? 'spike' : 'raise', projected: proj }); monitor = 100; pending = false; pendingPct = raise; }
    if (m === 1) { const gap = completed.get(y - 2); if (gap != null && gap > 0.005) { sal *= 1 + gap / 100; events.push({ month: k, pct: gap, kind: 'catch-up', projected: proj }); } }
    cpiIndex *= 1 + inf / 100; knownInFY++; monitor *= 1 + inf / 100;
    const cum = (monitor / 100 - 1) * 100;
    if (cum > threshold + 1e-10) { pending = m !== 6; pendingSpike = inf > threshold + 1e-10; pendingPct = pendingSpike ? cum : raise; }
    if (m === 6 && knownInFY === 12) completed.set(y - 1, (Math.round(cpiIndex * 100) / 100 / (Math.round(raiseIndex * 100) / 100) - 1) * 100);
    index.set(k, sal);
  }
  return { index, events, lastKnown };
}

/**
 * Average euro cost factor over [from, to] against the month of the latest known cost (`base`, a date):
 * salary index ÷ EUR/TRY index, month by month.
 */
export function costFactor(base: string, from: string, to: string, s: InflationSettings): number {
  const b = base.slice(0, 7), f = from.slice(0, 7), t = to.slice(0, 7);
  const { index } = salaryPath(t > b ? t : b, s), s0 = index.get(b) ?? 1, fx = (s.fx ?? 0) / 100;
  let sum = 0, cnt = 0, i = 0;
  for (let k = next(b); k <= t; k = next(k)) { i++; if (k < f) continue; sum += (index.get(k) ?? s0) / s0 / Math.pow(1 + fx, i); cnt++; }
  return cnt ? sum / cnt : 1;
}
