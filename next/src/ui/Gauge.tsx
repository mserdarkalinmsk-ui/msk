import { useEffect, useRef, useState } from 'preact/hooks';

/** Animated half-circle gauge with coloured bands and a needle. value is a ratio (1 = 100%). */
export function Gauge({ value, label, sub, bands = [[0.7, '#e5484d'], [0.9, '#f5a524'], [1, '#30a46c'], [1.5, '#5b8def']], max = 1.5, fmt = (v: number) => `${Math.round(v * 100)}%` }:
  { value: number; label: string; sub?: string; bands?: [number, string][]; max?: number; fmt?: (v: number) => string }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const target = Math.max(0, Math.min(max, value || 0));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); from.current = target; return; }
    const a = from.current, t0 = performance.now(); let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.04 * (1 - k); setV(a + (target - a) * e); if (k < 1) raf = requestAnimationFrame(step); else from.current = target; };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, max]);
  const R = 70, cx = 90, cy = 86, ang = (x: number) => Math.PI * (1 - Math.min(1, x / max));
  const pt = (x: number, r = R) => [cx + r * Math.cos(ang(x)), cy - r * Math.sin(ang(x))];
  const arc = (a: number, b: number) => { const [x1, y1] = pt(a), [x2, y2] = pt(b); return `M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}`; };
  let prev = 0;
  const col = bands.find(([u]) => value <= u)?.[1] ?? bands.at(-1)![1];
  const [nx, ny] = pt(v, R - 26);
  return (
    <div class="gauge" role="img" aria-label={`${label}: ${fmt(value)}`}>
      <svg viewBox="0 0 180 104">
        <path d={arc(0, max)} stroke="var(--line)" stroke-width="14" fill="none" />
        {bands.map(([u, c]) => { const p = arc(prev, Math.min(u, max)); prev = Math.min(u, max); return <path d={p} stroke={c} stroke-width="14" fill="none" opacity=".22" />; })}
        <path d={arc(0, Math.max(0.0001, v))} stroke={col} stroke-width="14" fill="none" stroke-linecap="round" />
        {[1].filter((t) => t <= max).map((t) => { const [a1, b1] = pt(t, R - 10), [a2, b2] = pt(t, R + 10); return <line x1={a1} y1={b1} x2={a2} y2={b2} stroke="var(--ink)" stroke-width="2" />; })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--ink)" stroke-width="3" stroke-linecap="round" />
        <circle cx={cx} cy={cy} r="6" fill="var(--ink)" />
      </svg>
      <b class="num" style={{ color: col }}>{fmt(v)}</b>
      <span>{label}</span>{sub && <small>{sub}</small>}
    </div>
  );
}
