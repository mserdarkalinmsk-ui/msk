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
/** Charts on the page: resized to the paper before printing and back after, so none is cut at the page edge. */
const live = new Set<ECharts>();
if (typeof window !== 'undefined') { const fit = () => { for (const c of live) c.resize(); }; addEventListener('beforeprint', fit); addEventListener('afterprint', fit); matchMedia('print').addEventListener?.('change', fit); }
/** Draws every chart still waiting (before an export or print started from code). */
export const drawAllCharts = drawAll;

/** Resolved design tokens, read at render time so charts follow the theme. */
const mixHex = (a: string, b: string, w: number) => {
  const p = (h: string) => (/^#[0-9a-f]{6}$/i.test(h) ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : null);
  const x = p(a), y = p(b); if (!x || !y) return a;
  return '#' + x.map((c, i) => Math.round(c * w + y[i] * (1 - w)).toString(16).padStart(2, '0')).join('');
};
export function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = (k: string) => cs.getPropertyValue(k).trim();
  const c1 = v('--c1'), surface = v('--surface');
  return {
    /** the money series, the same in every chart: spent, committed (a light step of spent), what is left */
    spent: c1, committed: mixHex(c1, surface, 0.42), left: v('--plan'),
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
      textStyle: { color: t.ink, fontSize: 13, fontFamily: t.font },
      extraCssText: 'border-radius:12px;box-shadow:0 12px 32px rgb(15 23 42 / .16),0 2px 6px rgb(15 23 42 / .08);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);line-height:1.55;',
    },
  };
}

/* ---------- one chart language: every chart passes through here ----------
   Marks: bars at most 24px thick with a 4px rounded data end and a 2px surface gap between stacked parts; lines 2px;
   areas a light wash. Axes: no axis line or ticks on value axes, a hairline grid, small muted labels. Legend: small
   rounded keys in text colour. Tooltips: one card, with a crosshair on line charts. Nothing here changes a value;
   a chart that sets something itself keeps it. */
const HEX = /^#[0-9a-f]{6}$/i;
const shade = (hex: string, a: string) => (HEX.test(hex) ? hex + a : hex);
const vWash = (c: string) => ({ type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: shade(c, '33') }, { offset: 1, color: shade(c, '05') }] });
const arr = (v: any) => (Array.isArray(v) ? v : v ? [v] : []);
function axis(a: any, t: Tokens | undefined) {
  if (!a || typeof a !== 'object' || !t) return a;
  const value = a.type === 'value' || a.type === 'log' || a.type == null;
  return {
    ...a,
    axisLine: { show: !value, ...a.axisLine, lineStyle: { color: t.line, ...a.axisLine?.lineStyle } },
    axisTick: { show: false, ...a.axisTick },
    // value labels in the text face; a fixed top (the budget) does not print a second, colliding top label
    axisLabel: { color: t.ink3, fontSize: 11, ...(typeof a.max === 'number' ? { showMaxLabel: false } : {}), ...a.axisLabel, ...(value ? { fontFamily: t.font } : { fontFamily: a.axisLabel?.fontFamily ?? t.font }) },
    splitLine: { ...a.splitLine, lineStyle: { color: t.line, width: 1, ...a.splitLine?.lineStyle, type: 'solid' } },
    nameTextStyle: { color: t.ink3, fontSize: 11, ...a.nameTextStyle },
  };
}
export function polish(o: any, t?: Tokens): any {
  if (!o || typeof o !== 'object') return o;
  const S = Array.isArray(o.series) ? o.series : o.series ? [o.series] : [];
  const yCat = arr(o.yAxis).some((a: any) => a?.type === 'category');
  const hasLine = S.some((x: any) => x?.type === 'line');
  for (const x of S) {
    if (!x || x.__plain) continue;
    const c = typeof x.itemStyle?.color === 'string' ? x.itemStyle.color : typeof x.color === 'string' ? x.color : undefined;
    if (x.type === 'bar') {
      x.itemStyle = { ...x.itemStyle };
      if (x.barMaxWidth == null && x.barWidth == null) x.barMaxWidth = 24;
      if (x.itemStyle.borderRadius == null) x.itemStyle.borderRadius = x.stack ? 0 : yCat ? [0, 4, 4, 0] : [4, 4, 0, 0];
      // touching parts of a stack are told apart by a 2px gap in the surface colour, never by a drawn border
      if (x.stack && t && x.itemStyle.borderWidth == null) Object.assign(x.itemStyle, { borderColor: t.surface, borderWidth: 1 });
      x.emphasis = { focus: 'series', ...x.emphasis };
    } else if (x.type === 'line') {
      x.lineStyle = { width: 2, cap: 'round', join: 'round', ...x.lineStyle };
      const lc = typeof x.lineStyle.color === 'string' ? x.lineStyle.color : c;
      if (x.areaStyle && lc && HEX.test(lc) && (x.areaStyle.color == null || typeof x.areaStyle.color === 'string')) x.areaStyle = { ...x.areaStyle, color: vWash(lc), opacity: 1 };
      if (x.symbolSize == null && x.showSymbol !== false && x.symbol !== 'none') x.symbolSize = 8;
      if (t) x.itemStyle = { borderColor: t.surface, borderWidth: 2, ...x.itemStyle };
      x.emphasis = { focus: 'series', ...x.emphasis, lineStyle: { width: 2.5, ...x.emphasis?.lineStyle } };
    }
  }
  const out: any = { animationDuration: 600, animationEasing: 'cubicOut', animationDurationUpdate: 400, animationEasingUpdate: 'cubicInOut', ...o };
  if (t) {
    if (o.xAxis) out.xAxis = Array.isArray(o.xAxis) ? o.xAxis.map((a: any) => axis(a, t)) : axis(o.xAxis, t);
    if (o.yAxis) out.yAxis = Array.isArray(o.yAxis) ? o.yAxis.map((a: any) => axis(a, t)) : axis(o.yAxis, t);
    if (o.legend) out.legend = Array.isArray(o.legend) ? o.legend : { icon: 'roundRect', itemWidth: 10, itemHeight: 10, itemGap: 16, ...o.legend, textStyle: { color: t.ink2, fontSize: 12, fontFamily: t.font, ...o.legend.textStyle } };
    if (o.tooltip && (o.tooltip.trigger === 'axis') && hasLine) out.tooltip = { ...o.tooltip, axisPointer: { type: 'line', lineStyle: { color: t.ink3, width: 1, type: [3, 3] }, ...o.tooltip.axisPointer } };
  }
  return out;
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
    inst.current = c; live.add(c);
    const o = optRef.current(tokens()); lastKey.current = keyOf(o); c.setOption(polish(o, tokens()), true);
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
    const re = () => { const o = optRef.current(tokens()); lastKey.current = keyOf(o); c.setOption(polish(o, tokens()), true); };
    mq.addEventListener('change', re); addEventListener('pl-prefs', re);
    off = () => { live.delete(c); ro.disconnect(); mq.removeEventListener('change', re); removeEventListener('pl-prefs', re); c.dispose(); };
    };
    const stopWait = whenVisible(el.current!, () => { if (mod) draw(mod); else void loadCharts().then(draw); });
    return () => { dead = true; stopWait?.(); off(); };
  }, []);
  // A parent re-render redraws the chart only when its option really changed.
  useEffect(() => { if (!inst.current) return; const o = option(tokens()), k = keyOf(o); if (k !== lastKey.current) { lastKey.current = k; inst.current.dispatchAction({ type: 'hideTip' }); inst.current.setOption(polish(o, tokens()), true); } });
  void theme;
  // ECharts owns the inner element's inline style; the outer one keeps the size.
  // Leaving the chart hides its tooltip at once (otherwise a faded box can stay behind after switching views).
  return <div class="chart-box" role="img" aria-label={label} onMouseLeave={() => inst.current?.dispatchAction({ type: 'hideTip' })} style={{ height: `${height}px`, width: '100%', cursor: onAxisClick ? 'pointer' : undefined }}><div ref={el} style={{ height: '100%', width: '100%' }} /></div>;
}
