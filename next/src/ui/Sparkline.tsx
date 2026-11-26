/** Tiny inline trend: a 2px line, area wash, and an end dot. */
export function Sparkline({ values, color = 'var(--c1)', height = 34, target: refV }: { values: number[]; color?: string; height?: number; target?: number[] }) {
  const W = 200, H = height, pad = 3;
  const all = [...values, ...(refV ?? [])];
  if (values.length < 2) return <svg width="100%" height={H} />;
  const max = Math.max(...all, 1), min = Math.min(0, ...all);
  const x = (i: number, len: number) => pad + (i * (W - 2 * pad)) / (len - 1);
  const y = (v: number) => H - pad - ((v - min) * (H - 2 * pad)) / (max - min || 1);
  const path = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i, a.length).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const d = path(values);
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {refV && <path d={path(refV)} fill="none" stroke="var(--plan)" stroke-width="1.5" stroke-dasharray="3 3" />}
      <path d={`${d}L${x(last, values.length)},${H}L${pad},${H}Z`} fill={color} opacity="0.1" />
      <path d={d} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx={x(last, values.length)} cy={y(values[last])} r="3" fill={color} stroke="var(--surface)" stroke-width="1.5" />
    </svg>
  );
}
