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
      extraCssText: 'border-radius:10px;box-shadow:0 10px 30px rgb(0 0 0 / .14);',
    },
  };
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
    const o = optRef.current(tokens()); c.setOption(o, true); lastKey.current = keyOf(o);
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
    const re = () => { const o = optRef.current(tokens()); lastKey.current = keyOf(o); c.setOption(o, true); };
    mq.addEventListener('change', re); addEventListener('pl-prefs', re);
    off = () => { ro.disconnect(); mq.removeEventListener('change', re); removeEventListener('pl-prefs', re); c.dispose(); };
    };
    const stopWait = whenVisible(el.current!, () => { if (mod) draw(mod); else void loadCharts().then(draw); });
    return () => { dead = true; stopWait?.(); off(); };
  }, []);
  // A parent re-render redraws the chart only when its option really changed.
  useEffect(() => { if (!inst.current) return; const o = option(tokens()), k = keyOf(o); if (k !== lastKey.current) { lastKey.current = k; inst.current.dispatchAction({ type: 'hideTip' }); inst.current.setOption(o, true); } });
  void theme;
  // ECharts owns the inner element's inline style; the outer one keeps the size.
  // Leaving the chart hides its tooltip at once (otherwise a faded box can stay behind after switching views).
  return <div role="img" aria-label={label} onMouseLeave={() => inst.current?.dispatchAction({ type: 'hideTip' })} style={{ height: `${height}px`, width: '100%', cursor: onAxisClick ? 'pointer' : undefined }}><div ref={el} style={{ height: '100%', width: '100%' }} /></div>;
}
