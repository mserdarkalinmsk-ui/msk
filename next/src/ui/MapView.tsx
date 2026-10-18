import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import MAPF from '../data/mapf.json';
import type { Country } from '../domain/types';
import { pct, short, signedPct } from './format';

/** Country outlines (1200×620 viewBox) carried over from the earlier ledger. m = member state, b = bbox [x,y,w,h]. */
interface Shape { n: string; m: number; b: [number, number, number, number]; d: string; i?: string }
const SHAPES = (MAPF as Shape[]).map((f) => ({ ...f, i: /^[A-Z]{3}$/.test(f.i ?? '') ? f.i : ({ France: 'FRA', Norway: 'NOR', Kosovo: 'XKX' } as Record<string, string>)[f.n] ?? '' }));
const ALIAS: Record<string, string> = { 'türkiye': 'turkey', turkiye: 'turkey', 'north macedonia': 'macedonia', 'bosnia and herzegovina': 'bosnia and herz.', 'czech republic': 'czechia', 'republic of moldova': 'moldova' };
const norm = (s: string) => { const t = s.trim().toLowerCase(); return ALIAS[t] ?? t; };
export const shapeFor = (c: Pick<Country, 'name' | 'iso3'>) => SHAPES.find((f) => (c.iso3 && f.i === c.iso3.toUpperCase()) || norm(f.n) === norm(c.name));

export interface MapDatum { id: string; name: string; budget: number; spent: number; gap: number; projects: number; staff: number; alerts: number; critical: number }
export type MapMode = 'budget' | 'used' | 'pace' | 'staff' | 'attention';
export const MODES: { id: MapMode; label: string; hint: string }[] = [
  { id: 'budget', label: 'Budget', hint: 'Colour shows approved budget' },
  { id: 'used', label: 'Used', hint: 'Colour shows share of budget spent' },
  { id: 'pace', label: 'Pace', hint: 'Colour shows spending pace against time (blue ahead, orange behind)' },
  { id: 'staff', label: 'Staff', hint: 'Colour shows people under contract' },
  { id: 'attention', label: 'Attention', hint: 'Colour shows the most severe open alert' },
];

const FULL = { x: 0, y: 0, w: 1200, h: 620 };
type VB = typeof FULL;
// Sequential blue ramp (light → dark) and a diverging orange ↔ blue pair from the chart palette.
const SEQ = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'];
const mix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const ramp = (t: number) => { const x = Math.max(0, Math.min(1, t)) * (SEQ.length - 1), i = Math.min(SEQ.length - 2, Math.floor(x)); return mix(SEQ[i], SEQ[i + 1], x - i); };
const diverge = (g: number) => (g >= 0 ? mix('#e9e8e4', '#256abf', Math.min(1, g / 0.25)) : mix('#e9e8e4', '#d95926', Math.min(1, -g / 0.4)));

/** Fits boxes into a view whose height/width ratio is `ar` (container aspect). */
function fit(boxes: [number, number, number, number][], pad = 1.6, ar = FULL.h / FULL.w): VB {
  if (!boxes.length) return clamp({ ...FULL, h: FULL.w * ar }, ar);
  const x0 = Math.min(...boxes.map((b) => b[0])), y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[0] + b[2])), y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
  let w = Math.max(260, (x1 - x0) * pad), h = w * ar;
  if ((y1 - y0) * pad > h) { h = (y1 - y0) * pad; w = h / ar; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return clamp({ x: cx - w / 2, y: cy - h / 2, w, h }, ar);
}
/** Keeps the view inside the drawn area (no empty sea beyond the outlines) at the container aspect. */
const clamp = (v: VB, ar: number): VB => {
  const maxW = Math.min(FULL.w, FULL.h / ar);
  const w = Math.min(maxW, Math.max(120, v.w)), h = w * ar;
  return { w, h, x: Math.max(0, Math.min(FULL.w - w, v.x)), y: Math.max(0, Math.min(FULL.h - h, v.y)) };
};

interface Props {
  countries: Country[]; data: MapDatum[]; mode: MapMode; height?: number;
  selected?: string; onSelect?: (id: string | null) => void; compact?: boolean;
}

export function MapView({ countries, data, mode, height = 420, selected, onSelect, compact }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: height });
  useEffect(() => {
    const el = svg.current!; const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 800, h: el.clientHeight || height }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const ar = size.h / size.w;
  const byShape = useMemo(() => {
    const m = new Map<string, MapDatum>();
    for (const c of countries) { const s = shapeFor(c); const d = data.find((x) => x.id === c.id); if (s && d) m.set(s.n, d); }
    return m;
  }, [countries, data]);
  const home = useMemo(() => fit([...byShape.keys()].filter((n) => byShape.get(n)!.projects).map((n) => SHAPES.find((s) => s.n === n)!.b), compact ? 2.6 : 2.3, ar), [byShape, compact, ar]);
  const [vb, setVb] = useState<VB>(home);
  const [hover, setHover] = useState<{ n: string; x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; vb: VB; moved: boolean } | null>(null);
  useEffect(() => setVb(home), [home.x, home.y, home.w, home.h]);

  const active = data.filter((d) => d.projects > 0);
  const max = { budget: Math.max(1, ...active.map((d) => d.budget)), staff: Math.max(1, ...active.map((d) => d.staff)) };
  const rise = (d: MapDatum) => (compact ? 4 : 7) + (compact ? 8 : 16) * Math.sqrt(d.budget / max.budget);
  const fill = (d: MapDatum | undefined, member: boolean) => {
    if (!d || !d.projects) return member ? 'var(--map-member)' : 'var(--map-other)';
    if (mode === 'budget') return ramp(0.2 + 0.8 * Math.sqrt(d.budget / max.budget));
    if (mode === 'used') return ramp(d.budget ? d.spent / d.budget : 0);
    if (mode === 'pace') return diverge(d.gap);
    if (mode === 'staff') return d.staff ? ramp(0.15 + 0.85 * (d.staff / max.staff)) : 'var(--map-member)';
    return d.critical ? 'var(--critical)' : d.alerts ? 'var(--serious)' : '#1f8a4c';
  };

  const zoom = (k: number, cx?: number, cy?: number) => setVb((v) => {
    const w = v.w * k, h = v.h * k, px = cx ?? v.x + v.w / 2, py = cy ?? v.y + v.h / 2;
    return clamp({ w, h, x: px - (px - v.x) * k, y: py - (py - v.y) * k }, ar);
  });
  const toMap = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: vb.x + ((e.clientX - r.left) / r.width) * vb.w, y: vb.y + ((e.clientY - r.top) / r.height) * vb.h, r };
  };
  useEffect(() => {
    const el = svg.current!;
    const wheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey && compact) return; e.preventDefault(); const p = toMap(e); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  const focus = (n: string) => { const s = SHAPES.find((x) => x.n === n); if (s) setVb(fit([s.b], 3.2, ar)); };
  useEffect(() => {
    if (!selected) return;
    const c = countries.find((x) => x.id === selected); const s = c && shapeFor(c);
    if (s && !compact) focus(s.n);
  }, [selected]);

  const hd = hover ? byShape.get(hover.n) : undefined;
  const hs = hover ? SHAPES.find((s) => s.n === hover.n) : undefined;
  const minB = Math.min(...active.map((d) => d.budget), max.budget);
  const legend = mode === 'budget' ? (active.length > 1 && max.budget - minB > 1 ? [short(minB), short(max.budget)] : null)
    : mode === 'used' ? ['0%', '100%'] : mode === 'staff' ? ['0', String(max.staff)] : mode === 'pace' ? ['behind', 'ahead'] : null;
  const scale = vb.w / size.w; // map units per screen pixel

  return (
    <div class="mapbox" style={{ height: `${height}px` }}>
      <svg ref={svg} class="mapsvg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid slice" role="group" aria-label={`Map coloured by ${mode}`}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, vb, moved: false }; }}
        onPointerMove={(e) => {
          const g = drag.current;
          if (g && (e.buttons & 1)) {
            const r = svg.current!.getBoundingClientRect(), dx = ((e.clientX - g.x) / r.width) * g.vb.w, dy = ((e.clientY - g.y) / r.height) * g.vb.h;
            if (Math.abs(dx) + Math.abs(dy) > 2) { g.moved = true; setVb(clamp({ ...g.vb, x: g.vb.x - dx, y: g.vb.y - dy }, ar)); setHover(null); }
          }
        }}
        onPointerUp={() => setTimeout(() => (drag.current = null))}
        onPointerLeave={() => { drag.current = null; setHover(null); }}>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--map-line)" stroke-width="1" /></pattern>
          <filter id="lift" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy={2 * scale} stdDeviation={3 * scale} flood-opacity=".25" /></filter>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={6 * scale} /></filter>
          <linearGradient id="sheen" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22" /><stop offset=".55" stop-color="#fff" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".12" /></linearGradient>
          <radialGradient id="sea" cx="55%" cy="45%" r="75%"><stop offset="0" stop-color="var(--map-sea)" /><stop offset="1" stop-color="var(--map-sea-deep)" /></radialGradient>
          <filter id="coast" x="-5%" y="-5%" width="110%" height="110%"><feMorphology operator="dilate" radius={2.2 * scale} in="SourceAlpha" result="d" /><feGaussianBlur in="d" stdDeviation={2.5 * scale} result="b" /><feFlood flood-color="var(--map-coast)" /><feComposite in2="b" operator="in" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect x={-600} y={-400} width={2400} height={1400} fill="url(#sea)" />
        <g class="grat" stroke="var(--map-grat)" stroke-width={0.6 * scale} fill="none" pointer-events="none">
          {Array.from({ length: 25 }, (_, i) => <line x1={i * 50} y1={0} x2={i * 50} y2={620} />)}
          {Array.from({ length: 13 }, (_, i) => <line x1={0} y1={i * 50} x2={1200} y2={i * 50} />)}
        </g>
        {/* 3D: land slab — every outline repeated a few units lower in a darker tone gives the map thickness */}
        <g pointer-events="none" transform={`translate(0 ${3.5 * scale})`} fill="var(--map-slab)" stroke="none">{SHAPES.map((x) => <path d={x.d} />)}</g>
        <g filter="url(#coast)">{SHAPES.map((s) => {
          const d = byShape.get(s.n), on = !!d?.projects, sel = !!(selected && d && d.id === selected);
          return (
            <path d={s.d} class={`ctry ${on ? 'under' : ''}`} fill={on ? 'var(--map-member)' : fill(d, !!s.m)} stroke="var(--map-border)" stroke-width={(sel ? 2.5 : on ? 1.2 : 0.8) * scale}
              filter={sel || hover?.n === s.n && on ? 'url(#lift)' : undefined}
              onPointerMove={(e) => { if (drag.current?.moved) return; const r = svg.current!.getBoundingClientRect(); setHover({ n: s.n, x: e.clientX - r.left, y: e.clientY - r.top }); }}
              onClick={() => { if (drag.current?.moved) return; on ? onSelect?.(sel ? null : d!.id) : onSelect?.(null); }}>
              <title>{s.n}</title>
            </path>
          );
        })}</g>
        {SHAPES.filter((s) => s.m === 0 && !byShape.get(s.n)?.projects).map((s) => <path d={s.d} fill="url(#hatch)" pointer-events="none" opacity=".28" />)}
        {/* 3D: countries with projects rise as blocks; height follows budget, sides are a darker shade of the top */}
        {[...byShape].filter(([, d]) => d.projects).map(([n, d]) => ({ s: SHAPES.find((x) => x.n === n)!, d })).sort((a, b) => (a.s.b[1] + a.s.b[3]) - (b.s.b[1] + b.s.b[3])).map(({ s: sh, d }) => {
          const H = rise(d) * scale, top = fill(d, true), side = mix(top.startsWith('#') ? top : '#3987e5', '#0b1f3a', 0.45), sel = selected === d.id;
          const steps = Math.max(2, Math.round(H / (1.2 * scale)));
          return (
            <g class={`ext ${sel ? 'sel' : ''}`}>
              <path d={sh.d} fill="#0b1f3a" opacity=".18" transform={`translate(${H * 0.35} ${H * 0.25})`} filter="url(#soft)" pointer-events="none" />
              {Array.from({ length: steps }, (_, i) => <path d={sh.d} fill={side} transform={`translate(0 ${-(i * H) / steps})`} pointer-events="none" />)}
              <path d={sh.d} class={`ctry on ${sel ? 'sel' : ''}`} fill={top} transform={`translate(0 ${-H})`} stroke={sel ? 'var(--ink)' : 'rgb(255 255 255 / .7)'} stroke-width={(sel ? 2.2 : 1) * scale}
                onPointerMove={(e) => { if (drag.current?.moved) return; const r = svg.current!.getBoundingClientRect(); setHover({ n: sh.n, x: e.clientX - r.left, y: e.clientY - r.top }); }}
                onClick={() => { if (drag.current?.moved) return; onSelect?.(sel ? null : d.id); }}><title>{sh.n}</title></path>
              <path d={sh.d} fill="url(#sheen)" transform={`translate(0 ${-H})`} pointer-events="none" />
            </g>
          );
        })}
        {!compact && SHAPES.filter((x) => !byShape.get(x.n)?.projects && (x.n.length * 7.2 + 10) * scale < x.b[2] && x.b[3] / scale > 30 && x.b[0] + x.b[2] > vb.x && x.b[0] < vb.x + vb.w && x.b[1] + x.b[3] > vb.y && x.b[1] < vb.y + vb.h).map((x) => (
          <text class="mname" x={x.b[0] + x.b[2] / 2} y={x.b[1] + x.b[3] / 2} text-anchor="middle" font-size={10.5 * scale} fill={x.m ? 'var(--ink-3)' : 'var(--ink-3)'} opacity={x.m ? 0.9 : 0.55} pointer-events="none" stroke-width={2.5 * scale} letter-spacing={0.6 * scale}>{(x.n === 'Turkey' ? 'Türkiye' : x.n).toUpperCase()}</text>))}
        {[...byShape].filter(([, d]) => d.projects).sort((x, y) => y[1].budget - x[1].budget).map(([n, d]) => {
          const s = SHAPES.find((x) => x.n === n)!, cx = s.b[0] + s.b[2] / 2, cy = s.b[1] + s.b[3] / 2 - rise(d) * scale;
          const r = (13 + 15 * Math.sqrt(d.budget / max.budget)) * scale, used = Math.min(1, d.budget ? d.spent / d.budget : 0);
          const C = 2 * Math.PI * (r - 2.5 * scale), sel = selected === d.id;
          return (
            <g class={`msym ${sel ? 'sel' : ''}`} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect?.(sel ? null : d.id); }}>
              <circle cx={cx} cy={cy} r={r + 3 * scale} fill="var(--ink)" opacity=".12" />
              <circle cx={cx} cy={cy} r={r} fill="var(--surface)" stroke="var(--ink)" stroke-opacity=".15" stroke-width={1 * scale} />
              <circle cx={cx} cy={cy} r={r - 2.5 * scale} fill="none" stroke="var(--map-ring)" stroke-width={4 * scale} />
              <circle cx={cx} cy={cy} r={r - 2.5 * scale} fill="none" stroke={d.critical ? '#c8312f' : 'var(--accent)'} stroke-width={4 * scale} stroke-linecap="round"
                stroke-dasharray={`${C * used} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} />
              <text x={cx} y={cy} dy={4.5 * scale} text-anchor="middle" font-size={13 * scale} font-weight="750" fill="var(--ink)">{d.projects}</text>
              {!compact && (() => { const t2 = `${short(d.budget)} · ${Math.round(used * 100)}% spent`, w = Math.max(d.name.length * 7.6, t2.length * 6.2) * scale + 14 * scale, lx0 = cx + r + 5 * scale, lx = lx0 + w > vb.x + vb.w - 8 * scale ? cx - r - 5 * scale - w : lx0;
                return <g class="mlabel" pointer-events="none">
                  <rect x={lx} y={cy - 16 * scale} width={w} height={32 * scale} rx={6 * scale} fill="var(--surface)" opacity=".94" stroke="var(--line)" stroke-width={0.8 * scale} />
                  <text x={lx + 7 * scale} y={cy - 2 * scale} font-size={12.5 * scale} font-weight="700" fill="var(--ink)">{d.name}</text>
                  <text x={lx + 7 * scale} y={cy + 11 * scale} font-size={10.5 * scale} fill="var(--ink-2)">{t2}</text>
                </g>; })()}
              {d.critical > 0 && <circle cx={cx + r * 0.72} cy={cy - r * 0.72} r={4.5 * scale} fill="#c8312f" stroke="var(--surface)" stroke-width={1.2 * scale} />}
            </g>
          );
        })}
      </svg>
      <div class="map-zoom">
        <button aria-label="Zoom in" onClick={() => zoom(1 / 1.35)}>+</button>
        <button aria-label="Zoom out" onClick={() => zoom(1.35)}>−</button>
        <button aria-label="Fit portfolio" title="Fit portfolio" onClick={() => setVb(home)}>⤢</button>
        <button aria-label="Whole map" title="Whole map" onClick={() => setVb(clamp({ ...FULL }, ar))} style={{ fontSize: '11px', fontWeight: 700 }}>ALL</button>
      </div>
      {hover && hs && (
        <div class="map-tip" style={{ left: `${Math.min(hover.x + 14, (svg.current?.clientWidth ?? 600) - 250)}px`, top: `${Math.max(8, hover.y - 10)}px` }}>
          <b>{hd ? hd.name : hs.n === 'Turkey' ? 'Türkiye' : hs.n}</b>
          {hd?.projects ? (
            <div class="map-tip-g">
              <span>Budget</span><b class="num">{short(hd.budget)}</b>
              <span>Spent</span><b class="num">{pct(hd.budget ? hd.spent / hd.budget : 0)}</b>
              <span>Pace</span><b class="num">{signedPct(hd.gap)}</b>
              <span>Projects</span><b class="num">{hd.projects}</b>
              <span>Staff</span><b class="num">{hd.staff}</b>
              {hd.alerts > 0 && <><span>Alerts</span><b class="num" style={{ color: hd.critical ? '#ef6461' : '#ec9a5b' }}>{hd.alerts}</b></>}
            </div>
          ) : <div class="muted-inv">{hs.m ? 'Member state, no projects in this selection' : 'Not a member state'}</div>}
        </div>
      )}
      <div class="map-legend">
        {legend && <><span>{legend[0]}</span><i style={{ background: mode === 'pace' ? 'linear-gradient(90deg,#d95926,#e9e8e4,#256abf)' : `linear-gradient(90deg,${SEQ.join(',')})` }} /><span>{legend[1]}</span></>}
        {mode === 'attention' && <><i class="dot" style={{ background: '#1f8a4c' }} />clear <i class="dot" style={{ background: 'var(--serious)' }} />serious <i class="dot" style={{ background: 'var(--critical)' }} />critical</>}
        <span class="sep" /><i class="ring" />size = budget · ring = spent <span class="sep" /><i class="sw" style={{ background: 'var(--map-member)' }} />member <i class="sw hatch" />non-member
      </div>
    </div>
  );
}
