import { useState } from 'preact/hooks';
import { filtered, go, set, updateLine, useStore } from '../data/store';
import { byCategory, latestReport, parseDate, lineRows, reportsByDate, reportTotals, spendPoints, type LineRow } from '../domain/calc';
import { base, Chart, type Tokens } from '../ui/Chart';
import { DataTable, type Column } from '../ui/DataTable';
import { full, month, pct, short } from '../ui/format';
import { parseAmount } from '../ui/csv';
import { axisMoney, axisX, axisY, Filters } from './Overview';
import { Statement } from '../ui/Statement';
import type { WbLine, WbTotals } from '../domain/workbook';
import type { Project } from '../domain/types';
import { elapsed as elapsedOf, lines as linesOf } from '../domain/calc';
import { TODAY } from '../today';

/** Sums the latest report lines of several projects by line code into one statement. */
export function portfolioStatement(P: Project[]) {
  const by = new Map<string, WbLine>();
  for (const p of P) for (const l of linesOf(p)) {
    const w = by.get(l.code) ?? { code: l.code, description: l.description ?? '', unit: l.unit ?? '', level: l.code.split('.').length, leaf: true,
      budget: { units: 0, rate: null, cost: 0 }, actual: { units: 0, rate: null, cost: 0 }, sc: 0, planned: { units: null, rate: null, cost: 0 }, rounded: { units: null, rate: null, cost: 0 } };
    w.budget.cost! += l.approved ?? 0; w.budget.units! += l.approvedUnits ?? 0; w.actual.cost! += l.actual ?? 0; w.actual.units! += l.reportedUnits ?? 0;
    w.sc! += l.spentCommitted ?? (l.actual ?? 0) + (l.committed ?? 0); w.planned!.cost! += l.forecast ?? 0; w.rounded!.cost! += l.roundedBudget ?? l.proposedBudget ?? 0;
    by.set(l.code, w);
  }
  const L = [...by.values()].map((w) => ({ ...w, budget: { ...w.budget, rate: w.budget.units ? w.budget.cost! / w.budget.units : null, units: w.budget.units || null }, actual: { ...w.actual, rate: w.actual.units ? w.actual.cost! / w.actual.units : null, units: w.actual.units || null },
    planned: w.planned!.cost ? w.planned : undefined, rounded: w.rounded!.cost ? w.rounded : undefined }));
  for (const l of L) l.leaf = !L.some((o) => o !== l && o.code.startsWith(l.code + '.'));
  const adminL = L.find((l) => l.code === '10'), D = L.filter((l) => l.leaf && l.code !== '10');
  const t = (A: WbLine[]): WbTotals => ({ budget: A.reduce((s, l) => s + (l.budget.cost ?? 0), 0), actual: A.reduce((s, l) => s + (l.actual.cost ?? 0), 0), sc: A.reduce((s, l) => s + (l.sc ?? 0), 0),
    planned: A.reduce((s, l) => s + (l.planned?.cost ?? 0), 0) || undefined, rounded: A.reduce((s, l) => s + (l.rounded?.cost ?? 0), 0) || undefined });
  const direct = t(D), admin = adminL ? t([adminL]) : undefined;
  const eligible = admin ? { budget: direct.budget + admin.budget, actual: direct.actual + admin.actual, sc: direct.sc + admin.sc, planned: direct.planned != null ? direct.planned + (admin.planned ?? 0) : undefined, rounded: direct.rounded != null ? direct.rounded + (admin.rounded ?? 0) : undefined } : undefined;
  return { lines: L.filter((l) => l.code !== '10'), totals: { direct, admin, eligible } };
}

export const usedTone = (u: number) => (u > 1.1 ? 'critical' : u > 1 ? 'serious' : u > 0.9 ? 'warning' : 'good');

export function Budget() {
  const state = useStore((s) => s);
  const P = filtered(state);
  const [cat, setCat] = useState('');
  const all = lineRows(P);
  const R = cat ? all.filter((r) => r.description === cat) : all;
  const C = byCategory(all);
  const approved = all.reduce((s, r) => s + r.approved, 0), exposure = all.reduce((s, r) => s + r.exposure, 0);
  const over = all.filter((r) => r.approved && r.exposure > r.approved);
  const cname = (id: string) => state.ledger.countries.find((c) => c.id === id)?.name ?? id;

  if (!P.length) return <><Filters /><div class="card empty-page"><div><h2>No projects match</h2></div></div></>;
  return (
    <>
      <Filters />
      <section class="hero" aria-label="Budget figures">
        <div class="kpi lead">
          <span class="label">Spent + committed against approved lines</span>
          <span class="value">{pct(approved ? exposure / approved : 0)}</span>
          <span class="ctx"><b>{short(exposure)}</b> of {short(approved)} approved across {all.length} lines</span>
          <div class="meter"><span style={{ width: `${Math.min(100, (exposure / (approved || 1)) * 100)}%`, background: 'var(--c1)' }} /></div>
        </div>
        <div class="kpi"><span class="label">Unused approved budget</span><span class="value">{short(approved - exposure)}</span><span class="ctx">available to spend or commit</span></div>
        <div class="kpi"><span class="label">Lines over approved {over.length > 0 && <span class="badge serious">{over.length}</span>}</span>
          <span class="value" style={{ color: over.length ? 'var(--serious)' : undefined }}>{over.length}</span>
          <span class="ctx">{over.length ? <>exceeding by <b>{short(over.reduce((s, r) => s + r.exposure - r.approved, 0))}</b></> : 'all lines within approved'}</span></div>
        <div class="kpi"><span class="label">Reports on file</span><span class="value">{P.reduce((s, p) => s + (p.reportingPeriods?.length ?? 0), 0)}</span>
          <span class="ctx">latest {month(P.map((p) => latestReport(p)?.date ?? p.start).sort().at(-1)!)}</span></div>
      </section>

      <div class="grid g-12">
        <section class="card span-7">
          <div class="card-h"><div><h2>Approved vs used by cost category</h2><p>Click a category to focus the line table</p></div>
            {cat && <div class="tools"><button class="chip" aria-pressed="true" onClick={() => setCat('')}>{cat} <span class="x">✕</span></button></div>}</div>
          <div class="card-b">
            <div class="legend" style={{ marginBottom: '4px' }}>
              <span><i style={{ background: 'var(--c1)' }} />Spent</span><span><i style={{ background: 'var(--c3)' }} />Committed</span>
              <span><i style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)' }} />Approved</span>
            </div>
            <Chart height={Math.max(200, C.length * 46 + 40)} label="Approved versus used by category" onClick={(e) => e.name && setCat(e.name === cat ? '' : e.name)} option={(t) => categoryOption(t, C)} />
          </div>
        </section>
        <section class="card span-5">
          <div class="card-h"><div><h2>Report history</h2><p>Cumulative reported spend per project, one point per report</p></div></div>
          <div class="card-b"><Chart height={Math.max(260, C.length * 46 + 40)} label="Cumulative spend per project by report" onClick={(e) => e.seriesId && go(`project/${e.seriesId}`)} option={(t) => historyOption(t, P)} /></div>
        </section>
        <section class="card span-12" style={{ overflow: 'hidden' }}>
          <div class="card-h" style={{ paddingBottom: '12px' }}><div><h2>Portfolio financial statement</h2><p>All filtered projects summed by budget line, in the layout of the official report</p></div></div>
          {(() => { const S = portfolioStatement(P); const B = P.reduce((s, p) => s + p.budget, 0); const el = B ? P.reduce((s, p) => s + p.budget * elapsedOf(p, TODAY), 0) / B : 0;
            return <Statement lines={S.lines} totals={S.totals} elapsed={el} title="portfolio-statement" />; })()}
        </section>
        <section class="card span-12" style={{ overflow: 'hidden' }}>
          <div class="card-h" style={{ paddingBottom: '12px' }}><div><h2>Budget lines{cat && ` · ${cat}`}</h2><p>Latest report per project · double-click an amount to correct it</p></div></div>
          <LineTable rows={R} cname={cname} />
        </section>
      </div>
    </>
  );
}

function LineTable({ rows, cname }: { rows: LineRow[]; cname: (id: string) => string }) {
  const edit = (field: 'approved' | 'actual' | 'committed') => ({
    type: 'text' as const,
    commit: (r: LineRow, v: string) => {
      const x = parseAmount(v); const rep = latestReport(r.project);
      if (x == null || x < 0 || !rep) return;
      updateLine(r.project.id, rep.id, r.code, { [field]: x });
    },
  });
  const cols: Column<LineRow>[] = [
    { key: 'project', label: 'Project', width: 96, pin: true, value: (r) => r.project.code, render: (r) => <span class="num" style={{ fontWeight: 600 }}>{r.project.code}</span> },
    { key: 'code', label: 'Line', width: 64, value: (r) => r.code, render: (r) => <span class="num muted">{r.code}</span> },
    { key: 'desc', label: 'Description', width: 220, value: (r) => r.description },
    { key: 'country', label: 'Country', width: 100, value: (r) => cname(r.project.country) },
    { key: 'approved', label: 'Approved', width: 120, align: 'r', sum: true, format: full, value: (r) => r.approved, edit: edit('approved') },
    { key: 'actual', label: 'Spent', width: 120, align: 'r', sum: true, format: full, value: (r) => r.actual, edit: edit('actual') },
    { key: 'committed', label: 'Committed', width: 116, align: 'r', sum: true, format: full, value: (r) => r.committed, edit: edit('committed') },
    { key: 'used', label: 'Used', width: 170, value: (r) => r.used, render: (r) => (
      <div class="bar-cell"><div class="minibar"><span style={{ width: `${Math.min(100, r.used * 100)}%`, background: `var(--${usedTone(r.used) === 'good' ? 'c1' : usedTone(r.used) === 'warning' ? 'warn' : usedTone(r.used)})` }} /></div><span class="num" style={{ fontSize: '12px' }}>{pct(r.used)}</span></div>
    ) },
    { key: 'balance', label: 'Balance', width: 120, align: 'r', sum: true, format: full, value: (r) => r.balance, render: (r) => <span style={{ color: r.balance < 0 ? 'var(--critical)' : undefined }}>{full(r.balance)}</span> },
  ];
  return (
    <DataTable rows={rows} columns={cols} rowKey={(r) => r.key} title="budget-lines" storageKey="pl-cols-lines" maxHeight={480}
      groupBy={[{ label: 'project', key: (r) => `${r.project.code} · ${r.project.name}` }, { label: 'category', key: (r) => r.description }, { label: 'country', key: (r) => cname(r.project.country) }]}
      onOpen={(r) => set({ drawer: { kind: 'project', id: r.project.id } })} />
  );
}

function categoryOption(t: Tokens, C: ReturnType<typeof byCategory>) {
  return {
    ...base(t),
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps: any[]) => { const c = C[ps[0].dataIndex]; return `<b>${c.key}</b> · ${c.lines} lines<br/>Approved <b>${full(c.approved)}</b><br/>Spent ${full(c.actual)} · committed ${full(c.committed)}<br/>Used <b>${pct(c.approved ? c.exposure / c.approved : 0)}</b>`; } },
    xAxis: { type: 'value', ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: axisMoney } },
    yAxis: { type: 'category', inverse: true, data: C.map((c) => c.key), ...axisX(t), axisLabel: { color: t.ink2, fontSize: 12 } },
    series: [
      { name: 'Approved', type: 'bar', barWidth: 22, barGap: '-100%', data: C.map((c) => c.approved), itemStyle: { color: t.surface2, borderColor: t.ink3, borderWidth: 0.5, borderRadius: 4 }, z: 1,
        label: { show: true, position: 'right', color: t.ink2, fontFamily: t.mono, fontSize: 11, formatter: (x: any) => pct(C[x.dataIndex].approved ? C[x.dataIndex].exposure / C[x.dataIndex].approved : 0) } },
      { name: 'Spent', type: 'bar', stack: 'u', barWidth: 10, data: C.map((c) => c.actual), itemStyle: { color: t.c[0], borderRadius: [3, 0, 0, 3] }, z: 2 },
      { name: 'Committed', type: 'bar', stack: 'u', barWidth: 10, data: C.map((c) => c.committed), itemStyle: { color: t.c[2], borderRadius: [0, 3, 3, 0] }, z: 2 },
    ],
  };
}

function historyOption(t: Tokens, P: ReturnType<typeof filtered>) {
  const colorOf = (i: number) => t.c[i % 8];
  return {
    ...base(t),
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 11.5 } },
    tooltip: { ...(base(t).tooltip as object), trigger: 'item', formatter: (x: any) => {
      const p = P.find((q) => q.id === x.seriesId)!; const r = reportsByDate(p).find((q) => parseDate(q.date).getTime() === x.value[0]);
      return `<b>${p.code}</b> · ${r?.name ?? ''}<br/>${month(x.value[0])}: <b>${full(x.value[1])}</b>${r ? `<br/><span style="color:${t.ink3}">approved ${short(reportTotals(r).approved)}</span>` : ''}`;
    } },
    xAxis: { type: 'time', ...axisX(t), axisLabel: { ...axisX(t).axisLabel, formatter: (v: number) => month(v) } },
    yAxis: { type: 'value', ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: axisMoney } },
    series: P.map((p, i) => ({
      id: p.id, name: p.code, type: 'line', data: spendPoints(p).map((x) => [x.t, x.v]), symbolSize: 7,
      lineStyle: { width: 2, color: colorOf(i) }, itemStyle: { color: colorOf(i), borderColor: t.surface, borderWidth: 1.5 }, emphasis: { focus: 'series' },
    })),
  };
}
