/**
 * Month by month ahead, per budget heading: spent + committed today plus the heading's monthly spending so far,
 * month after month until the end date — and the month each heading passes its budget (a notification) and its
 * flexibility (an addendum). Two what-ifs: activities slip by some months (spending pauses, then resumes at the same
 * pace, end date unchanged) and spending runs faster or slower than so far.
 */
export interface HeadIn { code: string; label: string; budget: number; exposure: number; rate: number }
export type CellState = 'ok' | 'notify' | 'addendum';
export interface Cell { sc: number; share: number; state: CellState }
export interface HeadAhead { code: string; label: string; budget: number; now: number; rate: number; cells: Cell[]; end: Cell; notify: string | null; addendum: string | null }
export interface Ahead { months: string[]; heads: HeadAhead[]; total: { budget: number; now: number; cells: number[]; end: number } }
export interface AheadOpts { /** months the activities slip: no spending in them */ slip?: number; /** pace multiplier, 1 = as so far */ pace?: number; /** heading flexibility, 0.25 or 0.15 */ flex?: number }

const MS = 30.4375 * 86_400_000;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** The calendar months from the one after `from` to the one holding `end`, as YYYY-MM with the time at their end. */
export function monthEnds(from: number, end: number): { key: string; t: number }[] {
  const out: { key: string; t: number }[] = [];
  const d = new Date(from); let y = d.getUTCFullYear(), m = d.getUTCMonth();
  for (let i = 0; i < 240; i++) {
    const t = Math.min(Date.UTC(y, m + 1, 1) - 1, end);
    if (t > from) out.push({ key: `${new Date(t).getUTCFullYear()}-${String(new Date(t).getUTCMonth() + 1).padStart(2, '0')}`, t });
    if (t >= end) break;
    m++; if (m > 11) { m = 0; y++; }
  }
  return out;
}

export function monthsAhead(H: HeadIn[], from: number, end: number, o: AheadOpts = {}): Ahead {
  const slip = Math.max(0, o.slip ?? 0), pace = Math.max(0, o.pace ?? 1), flex = o.flex ?? 0.25;
  const M = end > from ? monthEnds(from, end) : [];
  const state = (sc: number, b: number): CellState => (b > 0 && sc > b * (1 + flex) + 0.5 ? 'addendum' : b > 0 && sc > b + 0.5 ? 'notify' : 'ok');
  const cell = (sc: number, b: number): Cell => ({ sc: r2(sc), share: b ? sc / b : 0, state: state(sc, b) });
  const at = (h: HeadIn, t: number) => h.exposure + h.rate * pace * Math.max(0, (t - from) / MS - slip);
  const heads = H.filter((h) => h.budget > 0 || h.exposure > 0).map((h): HeadAhead => {
    const cells = M.map((m) => cell(at(h, m.t), h.budget));
    const first = (s: CellState) => (state(h.exposure, h.budget) === s || (s === 'notify' && state(h.exposure, h.budget) === 'addendum') ? 'now' : M.find((_, i) => cells[i].state === s || (s === 'notify' && cells[i].state === 'addendum'))?.key ?? null);
    return { code: h.code, label: h.label, budget: r2(h.budget), now: r2(h.exposure), rate: r2(h.rate * pace), cells, end: cell(at(h, end), h.budget), notify: first('notify'), addendum: first('addendum') };
  });
  const sum = (f: (h: HeadAhead) => number) => r2(heads.reduce((a, h) => a + f(h), 0));
  return { months: M.map((m) => m.key), heads, total: { budget: sum((h) => h.budget), now: sum((h) => h.now), cells: M.map((_, i) => sum((h) => h.cells[i].sc)), end: sum((h) => h.end.sc) } };
}
