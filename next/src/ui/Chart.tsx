import { useEffect, useRef } from 'preact/hooks';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { useStore } from '../data/store';

/** The chart library is loaded once, after the first screen is drawn; charts appear as soon as it is ready. */
let lib: Promise<typeof import('./echartsSetup')> | null = null;
type Lib = typeof import('./echartsSetup');
let mod: Lib | null = null;
export const loadCharts = () => (lib ??= import('./echartsSetup').then((m) => (mod = m)));

/** Charts below the fold are drawn when they come near the screen; printing draws them all first. */
const waiting = new Map<Element, () => void>();
const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { io!.unobserve(e.target); waiting.get(e.target)?.(); waiting.delete(e.target); } }, { rootMargin: '300px' }) : null;
const drawAll = () => { for (const [el, go] of waiting) { io?.unobserve(el); go(); } waiting.clear(); };
if (typeof window !== 'undefined') addEventListener('beforeprint', drawAll);
const whenVisible = (el: Element, go: () => void) => { if (!io || (typeof matchMedia === 'function' && matchMedia('print').matches)) return go(); waiting.set(el, go); io.observe(el); return () => { io.unobserve(el); waiting.delete(el); }; };
/** Draws every chart still waiting (before an export or print started from code). */
export const drawAllCharts = drawAll;

/** Resolved design tokens, read at render time so charts follow the theme. */
export function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (k: string) => cs.getPropertyValue(k).trim();
  return {
    ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), line: v('--line'), surface: v('--surface'), surface2: v('--surface-2'),
    plan: v('--plan'), mono: v('--mono'), font: v('--font'),
    good: v('--good'), warn: v('--warn'), serious: v('--serious'), critical: v('--critical'),
    c: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--c${i}`)),
  };
}
export type Tokens = ReturnType<typeof tokens>;

/** Shared look: recessive axes, mono numbers, card-style tooltip. */
export function base(t: Tokens): EChartsCoreOption {
  return {
    animationDuration: 350,
    textStyle: { fontFamily: t.font, color: t.ink2 },
    tooltip: {
      backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, padding: [10, 12], transitionDuration: 0.15, hideDelay: 0,
      textStyle: { color: t.ink, fontSize: 12.5, fontFamily: t.font },
      extraCssText: 'border-radius:12px;box-shadow:0 12px 32px rgb(15 23 42 / .16),0 2px 6px rgb(15 23 42 / .08);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);line-height:1.55;',
    },
  };
}

/* ---------- the finish every chart shares: depth without distorting the values ---------- */
const HEX = /^#[0-9a-f]{6}$/i;
const shade = (hex: string, a: string) => (HEX.test(hex) ? hex + a : hex);
const vGrad = (c: string, top = 'ff', bottom = 'b8') => ({ type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: shade(c, top) }, { offset: 1, color: shade(c, bottom) }] });
const hGrad = (c: string) => ({ type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: shade(c, 'c4') }, { offset: 1, color: shade(c, 'ff') }] });
/**
 * Gradient fills and soft shadows on bars, rounded free-standing bars, smooth lines with a glow, fading areas,
 * eased animations. Only plain colours are dressed: a colour a chart sets per point (a status, a band) is left as it is.
 */
export function polish(o: any): any {
  if (!o || typeof o !== 'object') return o;
  const S = Array.isArray(o.series) ? o.series : o.series ? [o.series] : [];
  const yCat = [o.yAxis].flat().some((a: any) => a?.type === 'category');
  for (const x of S) {
    if (!x || x.__plain) continue;
    const c = typeof x.itemStyle?.color === 'string' ? x.itemStyle.color : typeof x.color === 'string' ? x.color : undefined;
    if (x.type === 'bar') {
      x.itemStyle = { ...x.itemStyle };
      if (c && HEX.test(c)) x.itemStyle.color = yCat ? hGrad(c) : vGrad(c);
      if (!x.stack && x.itemStyle.borderRadius == null) x.itemStyle.borderRadius = yCat ? [0, 5, 5, 0] : [5, 5, 0, 0];
      if (x.itemStyle.shadowBlur == null) Object.assign(x.itemStyle, { shadowBlur: 6, shadowColor: 'rgba(15,23,42,.10)', shadowOffsetY: 2 });
      x.emphasis = { focus: 'series', ...x.emphasis, itemStyle: { shadowBlur: 14, shadowColor: 'rgba(15,23,42,.22)', ...x.emphasis?.itemStyle } };
    } else if (x.type === 'line') {
      x.lineStyle = { width: 2.5, cap: 'round', ...x.lineStyle };
      const lc = typeof x.lineStyle.color === 'string' ? x.lineStyle.color : c;
      if (lc && HEX.test(lc) && x.lineStyle.shadowBlur == null && x.lineStyle.type !== 'dashed') Object.assign(x.lineStyle, { shadowBlur: 8, shadowColor: shade(lc, '55'), shadowOffsetY: 3 });
      if (x.areaStyle && lc && HEX.test(lc) && (x.areaStyle.color == null || typeof x.areaStyle.color === 'string')) x.areaStyle = { ...x.areaStyle, color: vGrad(lc, '40', '00'), opacity: 1 };
      x.emphasis = { focus: 'series', ...x.emphasis, lineStyle: { width: 3.5, ...x.emphasis?.lineStyle } };
    }
  }
  return { animationDuration: 750, animationEasing: 'cubicOut', animationDurationUpdate: 450, animationEasingUpdate: 'cubicInOut', ...o };
}

const keyOf = (o: unknown) => { try { return JSON.stringify(o, (_, v) => (typeof v === 'function' ? String(v) : v)); } catch { return String(Math.random()); } };

interface Props { option: (t: Tokens) => EChartsCoreOption; height: number; onClick?: (p: any) => void; onAxisClick?: (x: number) => void; label: string }

export function Chart({ option, height, onClick, onAxisClick, label }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<ECharts | null>(null);
  const lastKey = useRef('');
  const optRef = useRef(option); optRef.current = option;
  const theme = useStore((s) => s.theme);
  const clickRef = useRef(onClick); clickRef.current = onClick;
  const axisRef = useRef(onAxisClick); axisRef.current = onAxisClick;

  useEffect(() => {
    let off = () => {}, dead = false;
    // Drawn synchronously once the library is in (so a chart revealed by printing is on the page before the snapshot).
    const draw = ({ echarts }: Lib) => {
    if (dead || !el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: 'svg' });
    inst.current = c;
    const o = optRef.current(tokens()); lastKey.current = keyOf(o); c.setOption(polish(o), true);
    c.on('click', (p) => clickRef.current?.(p));
    // Clicks anywhere over the plot (not only on a symbol) report the x value under the pointer.
    c.getZr().on('click', (ev: any) => {
      const pt = [ev.offsetX, ev.offsetY];
      if (!axisRef.current || !c.containPixel({ gridIndex: 0 }, pt)) return;
      const v = c.convertFromPixel({ gridIndex: 0 }, pt) as number[];
      if (v && isFinite(v[0])) axisRef.current(v[0]);
    });
    // Resized only when the box really changes (the observer also reports the size it starts with).
    let w = el.current.clientWidth, h = el.current.clientHeight;
    const ro = new ResizeObserver(() => { const x = el.current; if (!x || (x.clientWidth === w && x.clientHeight === h)) return; w = x.clientWidth; h = x.clientHeight; c.resize(); });
    ro.observe(el.current!);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const re = () => { const o = optRef.current(tokens()); lastKey.current = keyOf(o); c.setOption(polish(o), true); };
    mq.addEventListener('change', re); addEventListener('pl-prefs', re);
    off = () => { ro.disconnect(); mq.removeEventListener('change', re); removeEventListener('pl-prefs', re); c.dispose(); };
    };
    const stopWait = whenVisible(el.current!, () => { if (mod) draw(mod); else void loadCharts().then(draw); });
    return () => { dead = true; stopWait?.(); off(); };
  }, []);
  // A parent re-render redraws the chart only when its option really changed.
  useEffect(() => { if (!inst.current) return; const o = option(tokens()), k = keyOf(o); if (k !== lastKey.current) { lastKey.current = k; inst.current.dispatchAction({ type: 'hideTip' }); inst.current.setOption(polish(o), true); } });
  void theme;
  // ECharts owns the inner element's inline style; the outer one keeps the size.
  // Leaving the chart hides its tooltip at once (otherwise a faded box can stay behind after switching views).
  return <div role="img" aria-label={label} onMouseLeave={() => inst.current?.dispatchAction({ type: 'hideTip' })} style={{ height: `${height}px`, width: '100%', cursor: onAxisClick ? 'pointer' : undefined }}><div ref={el} style={{ height: '100%', width: '100%' }} /></div>;
}
