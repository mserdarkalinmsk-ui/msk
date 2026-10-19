import { useState } from 'preact/hooks';
import { accuracyRows, cashSeries, committedSeries, headingBars, mixSeries, neededSeries } from '../domain/portfolioCharts';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from '../ui/Chart';
import { date, full, month } from '../ui/format';
import { axisX, axisY } from './Overview';

type View = 'needed' | 'heading' | 'committed' | 'mix' | 'cash' | 'accuracy';
const VIEWS: Record<View, { tab: string; hint: string }> = {
  needed: { tab: 'Needed / month', hint: 'Spent each month (light: forecast) against what would have to be spent each month to use the budget by the end' },
  heading: { tab: 'By heading', hint: 'Spent and committed per heading against the budget; the marker is the amount expected at the end — red when a heading would need more than the 25% flexibility' },
  committed: { tab: 'Spent & committed', hint: 'Cumulative spent and the commitments (open orders) on top, at each report' },
  mix: { tab: 'Staff vs activities', hint: 'Cumulative spend by kind — staff (1.1.1 / 1.2.1), charging back (4.2 / 4.4) and activities — with the staff share' },
  cash: { tab: 'Cash', hint: 'Money received from the donor against cumulative spending; the next payment request is due when spending reaches 70% of what was received' },
  accuracy: { tab: 'Forecast accuracy', hint: 'For each reporting quarter: the planned expenditure in the reports against what was then spent until the next report' },
};
const tip = (t: Tokens) => ({ ...(base(t).tooltip as object), trigger: 'axis' as const });
const time = (t: Tokens) => ({ type: 'time', ...axisX(t), axisLabel: { ...axisX(t).axisLabel, formatter: (v: number) => month(v) } });
const money = (t: Tokens) => ({ type: 'value', ...axisY(t) });
const row = (c: string, name: string, v: number | null | undefined, f = full) => v == null ? '' : `<div style="display:flex;justify-content:space-between;gap:16px"><span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${c};margin-right:6px"></i>${name}</span><b>${f(v)}</b></div>`;
const head = (t: number | string) => `<div style="font-weight:650;margin-bottom:6px">${typeof t === 'number' ? month(t) : t}</div>`;
const legend = (t: Tokens) => ({ top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 11.5 } });

function neededOption(t: Tokens, P: Project[]) {
  const R = neededSeries(P, TODAY);
  return { ...base(t), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, legend: legend(t),
    tooltip: { ...tip(t), formatter: (ps: any[]) => { const x = R[ps[0].dataIndex]; return x ? head(x.t) + row(x.past ? t.c[0] : t.c[1], x.past ? 'Spent' : 'Forecast', x.spend) + row(t.serious, 'Needed per month', x.needed) : ''; } },
    xAxis: { type: 'category', data: R.map((x) => month(x.t)), ...axisX(t) }, yAxis: money(t),
    series: [
      { name: 'Spent per month', type: 'bar', barWidth: '62%', data: R.map((x) => ({ value: x.spend, itemStyle: { color: x.past ? t.c[0] : t.c[1], opacity: x.past ? 1 : 0.35, borderRadius: [3, 3, 0, 0] } })) },
      { name: 'Needed per month', type: 'line', data: R.map((x) => x.needed), symbol: 'none', connectNulls: false, lineStyle: { color: t.serious, width: 2 }, itemStyle: { color: t.serious } },
    ] };
}

function headingOption(t: Tokens, P: Project[]) {
  const H = headingBars(P, TODAY).reverse(), bad = (s: string) => s === 'addendum' || s === 'notify-now';
  return { ...base(t), grid: { left: 8, right: 24, top: 30, bottom: 8, containLabel: true }, legend: legend(t),
    tooltip: { ...tip(t), axisPointer: { type: 'shadow' }, formatter: (ps: any[]) => { const h = H[ps[0].dataIndex];
      return head(`${h.code} ${h.label}`) + row(t.c[0], 'Spent', h.spent) + row(t.c[2], 'Committed', h.committed) + row(t.ink3, 'Budget now', h.budget) + row(t.ink3, 'Agreement', h.baseline) + row(bad(h.stage) ? t.serious : t.ink, 'Expected at the end', h.projected)
        + (h.flagged.length ? `<div style="color:${t.serious};margin-top:4px">Beyond the flexibility: ${h.flagged.join(', ')}</div>` : ''); } },
    xAxis: money(t), yAxis: { type: 'category', data: H.map((h) => `${h.code} ${h.label}`), ...axisX(t), axisLabel: { color: t.ink2, fontSize: 11.5 } },
    series: [
      { name: 'Spent', type: 'bar', stack: 'h', barWidth: 16, data: H.map((h) => h.spent), itemStyle: { color: t.c[0] } },
      { name: 'Committed', type: 'bar', stack: 'h', data: H.map((h) => h.committed), itemStyle: { color: t.c[2], opacity: 0.75 } },
      { name: 'Budget left', type: 'bar', stack: 'h', data: H.map((h) => Math.max(0, h.budget - h.spent - h.committed)), itemStyle: { color: t.line, borderRadius: [0, 4, 4, 0] } },
      { name: 'Expected at the end', type: 'scatter', symbol: 'rect', symbolSize: [3, 22], data: H.map((h) => ({ value: h.projected, itemStyle: { color: bad(h.stage) ? t.serious : t.ink } })), z: 5 },
    ] };
}

function committedOption(t: Tokens, P: Project[]) {
  const R = committedSeries(P, TODAY);
  return { ...base(t), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, legend: legend(t),
    tooltip: { ...tip(t), formatter: (ps: any[]) => { const x = R[ps[0].dataIndex]; return x ? head(x.t) + row(t.c[0], 'Spent', x.spent) + row(t.c[2], 'Committed', x.committed) + row(t.ink3, 'Spent + committed', x.spent + x.committed) : ''; } },
    xAxis: time(t), yAxis: money(t),
    series: [
      { name: 'Spent', type: 'line', stack: 's', step: 'end', symbol: 'none', data: R.map((x) => [x.t, x.spent]), lineStyle: { color: t.c[0], width: 2 }, itemStyle: { color: t.c[0] }, areaStyle: { color: t.c[0], opacity: 0.35 } },
      { name: 'Committed', type: 'line', stack: 's', step: 'end', symbol: 'none', data: R.map((x) => [x.t, x.committed]), lineStyle: { color: t.c[2], width: 1.5 }, itemStyle: { color: t.c[2] }, areaStyle: { color: t.c[2], opacity: 0.3 } },
    ] };
}

function mixOption(t: Tokens, P: Project[]) {
  const R = mixSeries(P, TODAY), pc = (v: number) => `${(v * 100).toFixed(1)}%`;
  const area = (name: string, k: 'staff' | 'cb' | 'act', c: string) => ({ name, type: 'line', stack: 'm', step: 'end', symbol: 'none', data: R.map((x) => [x.t, x[k]]), lineStyle: { color: c, width: 1.5 }, itemStyle: { color: c }, areaStyle: { color: c, opacity: 0.4 } });
  return { ...base(t), grid: { left: 8, right: 8, top: 30, bottom: 8, containLabel: true }, legend: legend(t),
    tooltip: { ...tip(t), formatter: (ps: any[]) => { const x = R[ps[0].dataIndex]; return x ? head(x.t) + row(t.c[3], 'Staff', x.staff) + row(t.c[4], 'Charging back', x.cb) + row(t.c[0], 'Activities', x.act) + row(t.serious, 'Staff share', x.ratio, pc) : ''; } },
    xAxis: time(t), yAxis: [money(t), { type: 'value', min: 0, max: 1, ...axisY(t), splitLine: { show: false }, axisLabel: { ...axisY(t).axisLabel, formatter: (v: number) => `${Math.round(v * 100)}%` } }],
    series: [area('Staff', 'staff', t.c[3]), area('Charging back', 'cb', t.c[4]), area('Activities', 'act', t.c[0]),
      { name: 'Staff share', type: 'line', yAxisIndex: 1, step: 'end', symbol: 'none', data: R.map((x) => [x.t, x.ratio]), lineStyle: { color: t.serious, width: 2, type: [6, 4] }, itemStyle: { color: t.serious } }] };
}

function cashOption(t: Tokens, P: Project[]) {
  const C = cashSeries(P, TODAY);
  return { ...base(t), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, legend: legend(t),
    tooltip: { ...tip(t), formatter: (ps: any[]) => { const x = C.rows[ps[0].dataIndex]; return x ? head(x.t) + row(t.good, 'Received', x.received) + row(x.past ? t.c[0] : t.c[1], x.past ? 'Spent' : 'Spent (forecast)', x.spent) + row(t.ink3, `${Math.round(C.threshold * 100)}% of received`, x.received * C.threshold) : ''; } },
    xAxis: time(t), yAxis: money(t),
    series: [
      { name: 'Received', type: 'line', step: 'end', symbol: 'none', data: C.rows.map((x) => [x.t, x.received]), lineStyle: { color: t.good, width: 2 }, itemStyle: { color: t.good }, areaStyle: { color: t.good, opacity: 0.12 } },
      { name: `${Math.round(C.threshold * 100)}% of received`, type: 'line', step: 'end', symbol: 'none', data: C.rows.map((x) => [x.t, x.received * C.threshold]), lineStyle: { color: t.ink3, width: 1, type: 'dotted' }, itemStyle: { color: t.ink3 } },
      { name: 'Spent', type: 'line', symbol: 'none', data: C.rows.filter((x) => x.past).map((x) => [x.t, x.spent]), lineStyle: { color: t.c[0], width: 2.5 }, itemStyle: { color: t.c[0] } },
      { name: 'Spent (forecast)', type: 'line', symbol: 'none', data: C.rows.filter((x, i, a) => !x.past || a[i + 1]?.past === false).map((x) => [x.t, x.spent]), lineStyle: { color: t.c[1], width: 2, type: [6, 4] }, itemStyle: { color: t.c[1] },
        ...(C.dueAt ? { markLine: { silent: true, symbol: 'none', label: { formatter: `Next request due · ${month(C.dueAt)}`, color: t.serious, fontSize: 11, fontWeight: 600 }, lineStyle: { color: t.serious, type: 'dashed' }, data: [{ xAxis: C.dueAt }] } } : {}) },
    ] };
}

function accuracyOption(t: Tokens, P: Project[]) {
  const A = accuracyRows(P), q = (x: number) => { const d = new Date(x); return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`; };
  return { ...base(t), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true }, legend: legend(t),
    tooltip: { ...tip(t), axisPointer: { type: 'shadow' }, formatter: (ps: any[]) => { const x = A[ps[0].dataIndex]; return x ? head(q(x.t)) + row(t.ink3, 'Planned', x.planned) + row(t.c[0], 'Spent', x.spent) + `<div style="margin-top:4px">Used <b>${x.planned ? Math.round(x.spent / x.planned * 100) : 0}%</b> of the plan · ${x.projects.join(', ')}</div>` : ''; } },
    xAxis: { type: 'category', data: A.map((x) => q(x.t)), ...axisX(t) }, yAxis: money(t),
    series: [
      { name: 'Planned', type: 'bar', barGap: '10%', data: A.map((x) => x.planned), itemStyle: { color: t.line, borderColor: t.ink3, borderWidth: 1, borderRadius: [3, 3, 0, 0] } },
      { name: 'Spent', type: 'bar', data: A.map((x) => ({ value: x.spent, itemStyle: { color: x.spent < x.planned * 0.7 ? t.warn : t.c[0], borderRadius: [3, 3, 0, 0] } })) },
    ] };
}

/** One sentence under the chart: what it says now. */
function verdict(v: View, P: Project[]): { text: string; tone: 'good' | 'warn' | 'bad' } | null {
  if (v === 'needed') {
    const R = neededSeries(P, TODAY), past = R.filter((x) => x.past).slice(-6), now = R.filter((x) => x.needed != null).at(-1)?.needed ?? 0;
    const avg = past.length ? past.reduce((a, x) => a + (x.spend ?? 0), 0) / past.length : 0;
    if (!now) return null;
    return { text: `Last 6 months: ${full(avg)} per month · needed from now: ${full(now)} per month (${Math.round(avg / now * 100)}%).`, tone: avg >= now * 0.9 ? 'good' : avg >= now * 0.6 ? 'warn' : 'bad' };
  }
  if (v === 'heading') {
    const H = headingBars(P, TODAY).filter((h) => h.stage === 'addendum' || h.stage === 'notify-now');
    return H.length ? { text: `Beyond the flexibility at the end: ${H.map((h) => `${h.code} ${h.label} (${h.flagged.join(', ')})`).join(' · ')}.`, tone: 'bad' } : { text: 'Every heading stays within the 25% flexibility at the current pace.', tone: 'good' };
  }
  if (v === 'committed') {
    const x = committedSeries(P, TODAY).at(-1); if (!x) return null;
    return { text: `Committed and not yet spent: ${full(x.committed)} (${x.spent + x.committed ? Math.round(x.committed / (x.spent + x.committed) * 100) : 0}% of spent + committed).`, tone: 'good' };
  }
  if (v === 'mix') {
    const x = mixSeries(P, TODAY).at(-1); if (!x?.ratio) return null;
    return { text: `Staff share of spending to date: ${(x.ratio * 100).toFixed(1)}%.`, tone: x.ratio > 0.6 ? 'warn' : 'good' };
  }
  if (v === 'cash') {
    const C = cashSeries(P, TODAY);
    if (!C.projects) return { text: 'No payments or pre-financing recorded yet — add them in Reports → Cash plan.', tone: 'warn' };
    return { text: `${C.projects} project${C.projects > 1 ? 's' : ''} with cash data${C.expected ? ` (${C.expected} on the contract's first payment)` : ''} · ${C.usedNow != null ? `${Math.round(C.usedNow * 100)}% of the money received is spent` : 'nothing received yet'}${C.dueAt ? ` · next request due ${C.dueAt <= TODAY.getTime() ? 'now' : date(new Date(C.dueAt).toISOString().slice(0, 10))}` : ''}.`, tone: C.dueAt && C.dueAt <= TODAY.getTime() ? 'bad' : 'good' };
  }
  const A = accuracyRows(P);
  if (!A.length) return { text: 'No report with planned expenditure followed by a later report yet.', tone: 'warn' };
  const pl = A.reduce((a, x) => a + x.planned, 0), sp = A.reduce((a, x) => a + x.spent, 0);
  return { text: `Over ${A.length} quarter${A.length > 1 ? 's' : ''}: ${Math.round(sp / pl * 100)}% of the planned expenditure was spent.`, tone: sp >= pl * 0.85 ? 'good' : sp >= pl * 0.6 ? 'warn' : 'bad' };
}

const OPT: Record<View, (t: Tokens, P: Project[]) => Record<string, unknown>> = { needed: neededOption, heading: headingOption, committed: committedOption, mix: mixOption, cash: cashOption, accuracy: accuracyOption };

/** Budget health: six views of where the money stands and where it is going. */
export function BudgetHealth({ P }: { P: Project[] }) {
  const [v, setV] = useState<View>(() => { try { return (localStorage.getItem('pl-bh') as View) || 'needed'; } catch { return 'needed'; } });
  const pick = (x: View) => { setV(x); try { localStorage.setItem('pl-bh', x); } catch { /* storage blocked */ } };
  const V = verdict(v, P);
  return (
    <section class="card span-12 bh">
      <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div><h2>Budget health</h2><p>{VIEWS[v].hint}</p></div>
        <div class="tools"><div class="seg">{(Object.keys(VIEWS) as View[]).map((x) => <button aria-pressed={v === x} onClick={() => pick(x)}>{VIEWS[x].tab}</button>)}</div></div>
      </div>
      <div class="card-b" style={{ paddingTop: '8px' }}>
        <Chart height={v === 'heading' ? 280 : 300} label={`Budget health — ${VIEWS[v].tab}`} option={(t) => OPT[v](t, P)} />
        {V && <p class={`bh-v ${V.tone}`}>{V.text}</p>}
      </div>
    </section>
  );
}
