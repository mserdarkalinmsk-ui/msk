/**
 * A ratio against its target as a compact bar: the label and the value on one line, the bar with a mark at the
 * target (100%), and a line of context. The colour follows the band the value falls in. value is a ratio (1 = 100%).
 * (Replaces the half-circle dials: the same reading in a third of the space, and comparable side by side.)
 */
export function Gauge({ value, label, sub, bands = [[0.7, 'var(--critical)'], [0.9, 'var(--warn)'], [1, 'var(--good)'], [1.5, 'var(--c1)']], max = 1.5, fmt = (v: number) => `${Math.round(v * 100)}%`, target = 1 }:
  { value: number; label: string; sub?: string; bands?: [number, string][]; max?: number; fmt?: (v: number) => string; /** where the mark stands; outside the scale it is not drawn */ target?: number }) {
  const v = Math.max(0, Math.min(max, value || 0));
  const col = bands.find(([u]) => (value || 0) <= u)?.[1] ?? bands.at(-1)![1];
  let prev = 0;
  return (
    <div class="gauge" role="img" aria-label={`${label}: ${fmt(value || 0)}`}>
      <div class="gauge-h"><span>{label}</span><b class="num" style={{ color: col }}>{fmt(value || 0)}</b></div>
      <div class="gauge-bar">
        {bands.map(([u, c]) => { const a = prev, b = Math.min(u, max); prev = b; return b > a ? <i class="gauge-band" style={{ left: `${(a / max) * 100}%`, width: `${((b - a) / max) * 100}%`, background: c }} /> : null; })}
        <i class="gauge-fill" style={{ width: `${(v / max) * 100}%`, background: col }} />
        {target > 0 && target < max && <em style={{ left: `${(target / max) * 100}%` }} title="Target" />}
      </div>
      {sub && <small>{sub}</small>}
    </div>
  );
}
