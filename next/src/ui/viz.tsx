/**
 * The small visual vocabulary shared by the story, the analysis and the tables: one colour per band (behind, at risk,
 * on plan, ahead), bullet bars (value against a target on one track), sparklines and diverging bars.
 */
export type Band = 'red' | 'amber' | 'green' | 'blue';
/** Spending against plan → band, as in the CoE monitoring sheet: below 70% red, 70–90% amber, 90–100% green, 100%+ blue. */
export const bandOf = (perf: number): Band => (perf >= 1 ? 'blue' : perf >= 0.9 ? 'green' : perf >= 0.7 ? 'amber' : 'red');
export const BAND_COLOR: Record<Band, string> = { blue: 'var(--c1)', green: 'var(--good)', amber: 'var(--c4)', red: 'var(--critical)' };
export const BAND_WORD: Record<Band, string> = { blue: 'Ahead', green: 'On plan', amber: 'Behind', red: 'Well behind' };
export const BANDS: Band[] = ['red', 'amber', 'green', 'blue'];

/**
 * Bullet bar: the value on a track that runs to `max`, the target as a black tick, optional light range behind (e.g.
 * committed on top of spent). Reads left to right without a legend: bar short of the tick = behind.
 */
export function Bullet({ value, target, max, extra = 0, color, label, h = 10 }: { value: number; target?: number; max: number; extra?: number; color?: string; label?: string; h?: number }) {
  const X = (v: number) => `${Math.max(0, Math.min(100, max > 0 ? (v / max) * 100 : 0))}%`;
  return (
    <span class="vz-bullet" style={{ height: `${h}px` }} role="img" aria-label={label}>
      {extra > 0 && <i class="vz-extra" style={{ width: X(value + extra), background: color }} />}
      <i class="vz-val" style={{ width: X(value), background: color }} />
      {target != null && <b class="vz-tick" style={{ left: X(target) }} />}
    </span>
  );
}

/** Sparkline of a few points; the last point dotted. Values are drawn on their own min–max (or the range given). */
export function Spark({ values, w = 90, h = 22, color = 'var(--c1)', min, max, label, ref1 }: { values: number[]; w?: number; h?: number; color?: string; min?: number; max?: number; label?: string; ref1?: number }) {
  if (values.length < 2) return <span class="vz-spark muted">—</span>;
  const lo = Math.min(min ?? Infinity, ...values, ref1 ?? Infinity), hi = Math.max(max ?? -Infinity, ...values, ref1 ?? -Infinity), span = hi - lo || 1;
  const x = (i: number) => 2 + (i * (w - 4)) / (values.length - 1), y = (v: number) => h - 3 - ((v - lo) / span) * (h - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <svg class="vz-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      {ref1 != null && <line x1="0" x2={w} y1={y(ref1)} y2={y(ref1)} stroke="var(--line-strong)" stroke-dasharray="2 2" />}
      <path d={d} fill="none" stroke={color} stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r="2.4" fill={color} />
    </svg>
  );
}

/** Diverging bar around a centre line: below zero to the left in red, above to the right in blue; `scale` = largest |value|. */
export function Diverge({ value, scale, label }: { value: number; scale: number; label?: string }) {
  const w = scale > 0 ? Math.min(50, (Math.abs(value) / scale) * 50) : 0;
  return (
    <span class="vz-div" role="img" aria-label={label}>
      <i class={value < 0 ? 'neg' : 'pos'} style={value < 0 ? { right: '50%', width: `${w}%` } : { left: '50%', width: `${w}%` }} />
      <b />
    </span>
  );
}
