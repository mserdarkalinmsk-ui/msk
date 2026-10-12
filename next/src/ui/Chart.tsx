import { useEffect, useRef } from 'preact/hooks';
import * as echarts from 'echarts/core';
import { BarChart, CustomChart, LineChart, ScatterChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import { useStore } from '../data/store';

echarts.use([BarChart, LineChart, ScatterChart, CustomChart, GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, MarkAreaComponent, SVGRenderer]);

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
      backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, padding: [10, 12],
      textStyle: { color: t.ink, fontSize: 12.5, fontFamily: t.font },
      extraCssText: 'border-radius:10px;box-shadow:0 10px 30px rgb(0 0 0 / .14);',
    },
  };
}

interface Props { option: (t: Tokens) => EChartsCoreOption; height: number; onClick?: (p: any) => void; onAxisClick?: (x: number) => void; label: string }

export function Chart({ option, height, onClick, onAxisClick, label }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  const theme = useStore((s) => s.theme);
  const clickRef = useRef(onClick); clickRef.current = onClick;
  const axisRef = useRef(onAxisClick); axisRef.current = onAxisClick;

  useEffect(() => {
    const c = echarts.init(el.current!, undefined, { renderer: 'svg' });
    inst.current = c;
    c.on('click', (p) => clickRef.current?.(p));
    // Clicks anywhere over the plot (not only on a symbol) report the x value under the pointer.
    c.getZr().on('click', (ev: any) => {
      const pt = [ev.offsetX, ev.offsetY];
      if (!axisRef.current || !c.containPixel({ gridIndex: 0 }, pt)) return;
      const v = c.convertFromPixel({ gridIndex: 0 }, pt) as number[];
      if (v && isFinite(v[0])) axisRef.current(v[0]);
    });
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current!);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const re = () => c.setOption(option(tokens()), true);
    mq.addEventListener('change', re); addEventListener('pl-prefs', re);
    return () => { ro.disconnect(); mq.removeEventListener('change', re); removeEventListener('pl-prefs', re); c.dispose(); };
  }, []);
  useEffect(() => { inst.current?.setOption(option(tokens()), true); });
  void theme;
  // ECharts owns the inner element's inline style; the outer one keeps the size.
  return <div role="img" aria-label={label} style={{ height: `${height}px`, width: '100%', cursor: onAxisClick ? 'pointer' : undefined }}><div ref={el} style={{ height: '100%', width: '100%' }} /></div>;
}
