import { useState } from 'preact/hooks';
import { filtered, get, go, updateProject, useStore } from '../data/store';
import { enrichExtraction } from '../domain/extraction';
import type { Project } from '../domain/types';
import type { WorkbookSummary } from '../domain/workbook';
import { wpName, carriedFrom, followUp, matchProject, mergeTable, readTableSheet, type TableSheet } from '../domain/workplan';
import { TODAY } from '../today';
import { date, full, pct, short } from '../ui/format';
import { verdict, wpSheet } from '../ui/WorkPlan';
import { readXlsx } from '../ui/xlsx';
import { download } from '../ui/xlsxwrite';
import { latestWorkbook } from './FinancialReport';

const EMPTY: WorkbookSummary = { meta: {}, lines: [], totals: {}, situation: [], pos: [], monthly: [], movements: [], sheets: [], checks: [] };
const today = TODAY.toISOString().slice(0, 10);

function row(p: Project) {
  const plans = [...(p.workPlans ?? [])].sort((a, b) => a.no - b.no);
  if (!plans.length) return null;
  const wp = plans.find((w) => w.from <= today && today <= w.to) ?? plans.at(-1)!;
  const rep = latestWorkbook(p), wb0 = rep?.snapshot?.workbook, wb = wb0 ? (wb0.meta.extraction ? enrichExtraction(wb0, p) : wb0) : EMPTY;
  const f = followUp(p, wb, wp, plans);
  const d = f.prev ? (f.prev.rec?.spent ?? f.prevSpent) : null, e = f.prev ? (f.prev.rec?.sc ?? f.prevSc) : null;
  const dPct = d != null && f.prev?.planned ? d / f.prev.planned : null, ePct = e != null && f.prev?.planned ? e / f.prev.planned : null;
  const V = verdict({ ...f, prevSpent: d, prevSc: e }, dPct);
  return { p, wp, f, dPct, ePct, V, hasReport: !!wb0, carried: carriedFrom(plans, wp).size, n: plans.length };
}

export function WorkPlans() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const R = P.map(row).filter((x): x is NonNullable<ReturnType<typeof row>> => !!x).sort((a, b) => ['serious', 'warning', 'good'].indexOf(a.V.level) - ['serious', 'warning', 'good'].indexOf(b.V.level));
  const none = P.filter((p) => !p.workPlans?.length);
  const [prev, setPrev] = useState<{ file: string; items: { t: TableSheet; p?: Project }[] } | null>(null);
  const closed = R.filter((r) => r.dPct != null), avg = closed.length ? closed.reduce((a, r) => a + r.dPct!, 0) / closed.length : null;
  const planned = R.filter((r) => r.wp.from <= today && today <= r.wp.to).reduce((a, r) => a + r.wp.planned, 0);
  const tone = (x: number | null) => (x == null ? '' : x >= 0.8 ? 'good' : x < 0.5 ? 'serious' : 'warning');
  const load = async (file: File) => {
    const x = await readXlsx(await file.arrayBuffer()), ps = get().ledger.projects;
    const items = x.sheets.map((n) => readTableSheet(n, x.read(n))).filter((t): t is TableSheet => !!t).map((t) => ({ t, p: matchProject(ps, t) }));
    setPrev({ file: file.name, items });
  };
  const apply = () => {
    if (!prev) return;
    const by = new Map<string, TableSheet[]>();
    for (const i of prev.items) if (i.p) by.set(i.p.id, [...(by.get(i.p.id) ?? []), i.t]);
    for (const [id, T] of by) {
      const p = get().ledger.projects.find((x) => x.id === id)!, last = [...T].sort((a, b) => b.no - a.no)[0];
      updateProject(id, { workPlans: mergeTable(p.workPlans ?? [], T), ...(p.wpDeduct == null && last.deduct != null ? { wpDeduct: last.deduct } : {}) });
    }
    setPrev(null);
  };
  const xlsx = () => download(`work-plans-${today}.xlsx`, [{ name: 'Work Plans', money: [4, 7, 8, 11], rows: [
    ['Project', 'BH', 'WP', 'Period', 'Planned', 'Prev. WP delivered (spent)', 'Prev. WP spent & committed', 'Activity budget', 'Spent & committed', 'Activity used', 'Time elapsed', 'Left after WP', 'Carried-over activities', 'Status', 'Why'],
    ...R.map((r) => [r.p.name, r.p.bh ?? '', r.wp.no, `${r.wp.from} / ${r.wp.to}`, r.wp.planned, r.dPct ?? '', r.ePct ?? '', r.f.activity, r.f.sc, r.V.used, r.V.timeUsed, r.f.remaining, r.carried, r.V.label, r.V.flags.join('; ')])] }]);
  return (
    <>
      <section class="hero" aria-label="Work Plans">
        <div class="kpi lead"><span class="label">Projects with a Work Plan</span><span class="value">{R.length}</span><span class="ctx">{none.length ? `${none.length} without one` : 'all projects covered'}</span></div>
        <div class="kpi"><span class="label">At risk · watch</span><span class="value"><span style={{ color: 'var(--critical)' }}>{R.filter((r) => r.V.level === 'serious').length}</span> · <span style={{ color: 'var(--warning)' }}>{R.filter((r) => r.V.level === 'warning').length}</span></span><span class="ctx">{R.filter((r) => r.V.level === 'good').length} on track</span></div>
        <div class="kpi"><span class="label">Average delivery of the previous WP</span><span class="value">{avg == null ? '—' : pct(avg)}</span><span class="ctx">spent ÷ planned, {closed.length} projects</span></div>
        <div class="kpi"><span class="label">Planned this quarter</span><span class="value">{short(planned)}</span><span class="ctx">Work Plans running on {date(today)}</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h"><div><h2>Work Plan follow-up — all projects</h2><p>Current Work Plan of each project, the delivery of the previous one and whether the plan keeps pace with the activity budget left · click a row to open the project</p></div>
          <div class="tools" style={{ display: 'flex', gap: '8px' }}>
            <label class="btn">⬆ Import follow-up table<input type="file" accept=".xlsx,.xlsm" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void load(f); (e.target as HTMLInputElement).value = ''; }} /></label>
            <button class="btn" onClick={xlsx}>⤓ Excel</button>
            <button class="btn primary" title="Every project's current follow-up in the FOMA table layout, one sheet per project" onClick={() => {
              if (!R.length) return;
              const used = new Set<string>();
              download(`WP-follow-up-all-projects-${today}.xlsx`, R.map((r) => { const sh = wpSheet(r.p, r.f); let n = `${r.p.bh ? `BH${r.p.bh.replace(/\D/g, '')}` : r.p.code} - ${wpName(r.wp)}`.slice(0, 31).replace(/[\\/?*:[\]]/g, '-'); while (used.has(n)) n = n.slice(0, 29) + Math.random().toString(36).slice(2, 4); used.add(n); return { ...sh, name: n }; }));
            }}>⬇ All follow-ups</button></div></div>
        {prev && <div class="wp-sec" style={{ paddingBottom: '12px' }}><h3>{prev.file}: {prev.items.length} WP sheets (2023–2026 layouts) · {prev.items.filter((i) => i.p).length} matched to a project</h3>
          <table class="wp-t"><thead><tr><th>Sheet</th><th>WP</th><th>Period</th><th class="num">Planned</th><th>Previous WP (C · D · E)</th><th>Project</th></tr></thead>
            <tbody>{prev.items.map((i) => <tr class={i.p ? '' : 'warning'}><td>{i.t.sheet}</td><td>{i.t.no ? `WP ${i.t.no}` : `WP ${i.t.label}`}</td><td>{date(i.t.from)} – {date(i.t.to)}</td><td class="num">{full(i.t.planned)}</td>
              <td class="muted">{i.t.prev ? `${i.t.prev.no ? `WP ${i.t.prev.no}` : i.t.prev.label}: ${full(i.t.prev.planned)} · ${i.t.prev.spent == null ? '—' : full(i.t.prev.spent)} · ${i.t.prev.sc == null ? '—' : full(i.t.prev.sc)}` : 'first WP'}</td>
              <td>{i.p ? `${i.p.bh ? `${i.p.bh} · ` : ''}${i.p.name}` : <span class="badge warning">no project found</span>}</td></tr>)}</tbody></table>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}><button class="btn primary" disabled={!prev.items.some((i) => i.p)} onClick={apply}>Add to the projects</button><button class="btn ghost" onClick={() => setPrev(null)}>Cancel</button>
            <span class="muted" style={{ fontSize: '12px', alignSelf: 'center' }}>Existing Work Plans with the same period are updated; D and E become the recorded delivery of the previous WP; the table's staff + office deduction is kept when the project has none.</span></div></div>}
        {R.length ? <div class="table-wrap"><table class="wp-t" style={{ width: '100%', margin: 0 }}>
          <thead><tr><th>Project</th><th>WP</th><th class="num">Planned</th><th>Previous WP delivered</th><th>Activity used vs time</th><th class="num">Left after WP</th><th class="num">Carried</th><th>Status</th></tr></thead>
          <tbody>{R.map((r) => <tr class="click" style={{ cursor: 'pointer', borderLeft: `4px solid var(--${r.V.level === 'serious' ? 'critical' : r.V.level})` }} onClick={() => go(`project/${r.p.id}`)}>
            <td><b>{r.p.bh ? `${r.p.bh} · ` : ''}</b>{r.p.name}{!r.hasReport && <div class="muted" style={{ fontSize: '11px' }}>no report loaded — figures from the follow-up table</div>}</td>
            <td>{wpName(r.wp)}<div class="muted" style={{ fontSize: '11px' }}>{r.wp.from ? `${date(r.wp.from)} – ${date(r.wp.to)}` : ''}</div></td>
            <td class="num">{full(r.wp.planned)}</td>
            <td><div class="wp-mini"><i class={tone(r.dPct)} style={{ width: `${Math.min(100, (r.dPct ?? 0) * 100)}%` }} /></div><span class={tone(r.dPct)}>{r.dPct == null ? '—' : pct(r.dPct)}</span><span class="muted"> spent · {r.ePct == null ? '—' : pct(r.ePct)} S&C</span></td>
            <td>{r.hasReport ? <><div class="wp-mini two"><i style={{ width: `${Math.min(100, r.V.used * 100)}%` }} /><b style={{ left: `${Math.min(100, r.V.timeUsed * 100)}%` }} /></div><span class="muted">{pct(r.V.used)} used · {pct(r.V.timeUsed)} time</span></> : <span class="muted">—</span>}</td>
            <td class={`num ${r.f.remaining < 0 ? 'serious' : ''}`}>{r.hasReport ? full(r.f.remaining) : '—'}</td>
            <td class="num">{r.carried || ''}</td>
            <td><span class={`badge ${r.V.level}`}>{r.V.label}</span>{r.V.flags.length ? <div class="muted" style={{ fontSize: '11px', maxWidth: '280px' }}>{r.V.flags.join(' · ')}</div> : null}</td></tr>)}</tbody></table></div>
          : <div class="empty-page" style={{ padding: '32px' }}><div><h2>No Work Plans yet</h2><p>Import the FOMA follow-up table to load every project's Work Plans at once, or add them in a project's Financial report → Work Plan.</p></div></div>}
      </section>
    </>
  );
}
