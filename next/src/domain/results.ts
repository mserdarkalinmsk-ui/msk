import { elapsed, money } from './calc';
import type { Indicator } from './documents';
import { progress, tidy } from './logframe';
import type { Project } from './types';

export type IndState = 'reached' | 'on track' | 'behind' | 'off track' | 'not measured' | 'no target';
export interface IndRow { p: Project; x: Indicator; prog: number | null; state: IndState; stale: boolean }
export interface ResultRow { p: Project; n: number; measured: number; reached: number; behind: number; stale: number; results: number | null; spend: number; time: number; gap: number | null; flag: string | null }

const DAY = 864e5;
/**
 * Where an indicator stands against the time elapsed: results are expected to move roughly with time, so
 * progress well behind the elapsed share is "behind", far behind (or none past mid-term) is "off track".
 */
export function indState(x: Indicator, time: number): { prog: number | null; state: IndState } {
  const prog = progress(x);
  if (!tidy(x.target)) return { prog, state: 'no target' };
  if (prog == null) return { prog, state: 'not measured' };
  if (prog >= 1) return { prog, state: 'reached' };
  if (prog >= time - 0.15) return { prog, state: 'on track' };
  return { prog, state: prog < time - 0.35 || (time > 0.5 && prog <= 0) ? 'off track' : 'behind' };
}

/** Results against money and time per project: flags spending running ahead of results. */
export function resultRows(P: Project[], today: Date): { rows: ResultRow[]; inds: IndRow[] } {
  const inds: IndRow[] = [];
  const rows = P.map((p) => {
    const time = elapsed(p, today), m = money(p), spend = m.budget ? m.exposure / m.budget : 0;
    const I = (p.indicators ?? []).map((x) => {
      const s = indState(x, time);
      const stale = !x.asOf || (today.getTime() - Date.parse(x.asOf)) / DAY > 183;
      const r = { p, x, ...s, stale }; inds.push(r); return r;
    });
    const M = I.filter((r) => r.prog != null);
    const results = M.length ? M.reduce((s, r) => s + Math.min(1, Math.max(0, r.prog!)), 0) / M.length : null;
    const gap = results == null ? null : spend - results;
    const flag = !I.length ? (time > 0.2 ? 'no logframe on file' : null)
      : !M.length ? (time > 0.25 ? 'no indicator measured yet' : null)
      : gap! > 0.25 ? 'spending ahead of results' : null;
    return { p, n: I.length, measured: M.length, reached: I.filter((r) => r.state === 'reached').length, behind: I.filter((r) => r.state === 'behind' || r.state === 'off track').length, stale: I.filter((r) => r.prog != null && r.stale).length, results, spend, time, gap, flag };
  });
  return { rows: rows.sort((a, b) => (b.flag ? 1 : 0) - (a.flag ? 1 : 0) || (b.gap ?? -9) - (a.gap ?? -9)), inds };
}
