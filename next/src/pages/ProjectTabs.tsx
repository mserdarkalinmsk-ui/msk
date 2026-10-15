
import { useEffect, useRef, useState } from 'preact/hooks';
import { deleteDocument, deleteRisk, set, updateProject, upsertRisk } from '../data/store';
import { parseDate, planStats, riskScore } from '../domain/calc';
import { type Project, type ReportingPeriod, type Risk } from '../domain/types';
import { TODAY } from '../today';

import { DataTable, type Column } from '../ui/DataTable';
import { date, full, month } from '../ui/format';

const STATUSES = ['', 'In progress', 'Done'] as const;

export function Plan({ p }: { p: Project }) {
  const s = planStats(p, TODAY);
  const [zoom, setZoom] = useState<number>(() => Number(localStorage.getItem('pl-gantt-zoom')) || 26);
  const [show, setShow] = useState<'all' | 'late' | 'open' | 'done'>('all');
  const [nameW, setNameW] = useState(320);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => { // start scrolled to a few months before today
    const el = wrap.current; if (el && s) el.scrollLeft = Math.max(0, (s.month - 4) * zoom);
  }, [zoom]);
  if (!s) return <div class="card empty-page"><div><h2>No activity plan on file</h2><p>Add the Description of Action; the action plan is read from it.</p><button class="btn primary" onClick={() => set({ drawer: { kind: 'documents', projectId: p.id } })}>Add documents</button></div></div>;
  const M = p.doa!.months;
  const start = parseDate(p.doa!.start);
  const mdate = (mi: number) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + mi - 1, 1));
  const label = (mi: number) => month(mdate(mi).getTime());
  const setZ = (z: number) => { setZoom(z); try { localStorage.setItem('pl-gantt-zoom', String(z)); } catch { /* ignore */ } };
  const acts = s.acts.filter((a) => show === 'all' || (show === 'late' ? a.late : show === 'done' ? a.done : !a.done));
  const groups = [...new Set(acts.map((a) => a.group || '—'))];
  const setStatus = (code: string) => updateProject(p.id, { doa: { ...p.doa!, acts: p.doa!.acts.map((x) => x.code === code ? { ...x, status: STATUSES[(STATUSES.indexOf((x.status ?? '') as never) + 1) % STATUSES.length] } : x) } });
  // year bands for the two-row header
  const years: { y: number; from: number; n: number }[] = [];
  for (let i = 1; i <= M; i++) { const y = mdate(i).getUTCFullYear(); const last = years.at(-1); if (last && last.y === y) last.n++; else years.push({ y, from: i, n: 1 }); }
  const cols = `${nameW}px 112px repeat(${M}, ${zoom}px)`;
  const mlabel = (i: number) => { const t = label(i); return zoom >= 34 ? t.slice(0, 3) : zoom >= 20 ? t.slice(0, 1) : ''; };
  return (
    <section class="card" style={{ overflow: 'hidden' }}>
      <div class="card-h"><div><h2>Activity plan</h2><p>{s.done} of {s.total} done · {s.late} overdue · project month {Math.min(s.month, M)} of {M} · click a status to change it · scroll sideways or Shift + wheel</p></div>
        <div class="tools" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div class="seg" role="group" aria-label="Show">{(['all', 'open', 'late', 'done'] as const).map((k) => <button aria-pressed={show === k} onClick={() => setShow(k)}>{k === 'all' ? `All ${s.total}` : k === 'open' ? 'Open' : k === 'late' ? `Overdue ${s.late}` : `Done ${s.done}`}</button>)}</div>
          <div class="seg" role="group" aria-label="Zoom">{[[12, 'Years'], [26, 'Quarters'], [44, 'Months']].map(([z, l]) => <button aria-pressed={zoom === z} onClick={() => setZ(z as number)}>{l}</button>)}</div>
          <button class="btn ghost" title="Wider activity names" onClick={() => setNameW(nameW >= 480 ? 260 : nameW + 110)}>↔ Names</button>
        </div></div>
      <div class="tools legend" style={{ padding: '6px 20px 0' }}><span><i style={{ background: 'var(--c1)', opacity: .35 }} />Preparation</span><span><i style={{ background: 'var(--c1)' }} />Implementation</span><span><i style={{ background: 'var(--c2)' }} />Extension</span><span><i class="line" style={{ background: 'var(--critical)', width: '2px', height: '10px' }} />Today</span></div>
      <div class="gantt-wrap" ref={wrap}>
        <div class="gantt" style={{ gridTemplateColumns: cols, width: 'max-content' }}>
          <div class="gh gsticky g0" style={{ gridRow: 'span 2' }}>Activity</div><div class="gh gsticky g1" style={{ gridRow: 'span 2', left: `${nameW}px` }}>Status</div>
          {years.map((y) => <div class="gh gy" style={{ gridColumn: `span ${y.n}` }}>{y.n * zoom > 40 ? y.y : ''}</div>)}
          {Array.from({ length: M }, (_, i) => <div class={`gh gm ${i + 1 === s.month ? 'today' : ''}`} title={label(i + 1)}>{mlabel(i + 1)}</div>)}
          {groups.map((g) => (
            <>
              <div class="gg gsticky g0" style={{ gridColumn: 'span 2', width: `${nameW + 112}px` }}>{g}</div><div class="gg" style={{ gridColumn: `span ${M}` }} />
              {acts.filter((a) => (a.group || '—') === g).map((a) => (
                <>
                  <div class="ga gsticky g0" title={`${a.code} ${a.name}`}><span class="num muted">{a.code}</span> {a.name}</div>
                  <div class="gs gsticky g1" style={{ left: `${nameW}px` }}><button class={`badge ${a.done ? 'good' : a.late ? 'serious' : a.status === 'In progress' ? 'warning' : 'neutral'}`} onClick={() => setStatus(a.code)} title="Click to change">{a.done ? 'Done' : a.late ? 'Overdue' : a.status || 'Not started'}</button></div>
                  {Array.from({ length: M }, (_, i) => {
                    const mi = i + 1, P = a.P?.includes(mi), E = a.E?.includes(mi), X = a.X?.includes(mi);
                    const k = X ? 'x' : E ? 'e' : P ? 'p' : '';
                    const prev = (m: number) => (a.X?.includes(m) ? 'x' : a.E?.includes(m) ? 'e' : a.P?.includes(m) ? 'p' : '');
                    const cls = k ? `${k}${prev(mi - 1) !== k ? ' s' : ''}${prev(mi + 1) !== k ? ' f' : ''}` : '';
                    return <div class={`gc ${cls} ${mi === s.month ? 'now' : ''} ${mdate(mi).getUTCMonth() === 0 ? 'ny' : ''}`} title={`${a.code} · ${label(mi)}${k === 'p' ? ' · preparation' : k === 'e' ? ' · implementation' : k === 'x' ? ' · extension' : ''}`} />;
                  })}
                </>
              ))}
            </>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Risks({ p }: { p: Project }) {
  const R = [...(p.riskRegister ?? [])].sort((a, b) => riskScore(b) - riskScore(a));
  const open = R.filter((r) => (r.status ?? 'Open') === 'Open');
  const tone = (s: number) => (s >= 16 ? 'critical' : s >= 12 ? 'serious' : s >= 6 ? 'warning' : 'good');
  const cols: Column<Risk>[] = [
    { key: 'score', label: 'Score', width: 70, align: 'r', value: (r) => riskScore(r) },
    { key: 'title', label: 'Risk', width: 320, pin: true, value: (r) => r.title, render: (r) => <span title={r.title}>{r.title}</span> },
    { key: 'rating', label: 'Rating', width: 96, value: (r) => riskScore(r), render: (r) => { const s = riskScore(r); return <span class={`badge ${tone(s)}`}>{s >= 16 ? 'very high' : s >= 12 ? 'high' : s >= 6 ? 'medium' : 'low'}</span>; } },
    { key: 'category', label: 'Category', width: 120, value: (r) => r.category ?? '' },
    { key: 'l', label: 'Likelihood', width: 100, align: 'r', value: (r) => Number(r.likelihood || 0), edit: { type: 'select', options: ['1', '2', '3', '4', '5'], commit: (r, v) => upsertRisk(p.id, { ...r, likelihood: v }) } },
    { key: 'i', label: 'Impact', width: 90, align: 'r', value: (r) => Number(r.impact || 0), edit: { type: 'select', options: ['1', '2', '3', '4', '5'], commit: (r, v) => upsertRisk(p.id, { ...r, impact: v }) } },
    { key: 'status', label: 'Status', width: 100, value: (r) => r.status ?? 'Open', edit: { type: 'select', options: ['Open', 'Resolved'], commit: (r, v) => upsertRisk(p.id, { ...r, status: v }) } },
    { key: 'mitigation', label: 'Mitigation', width: 300, value: (r) => (r.mitigation ?? '').replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').trim() },
  ];
  return (
    <div class="grid g-12">
      <section class="card span-4">
        <div class="card-h"><div><h2>Risk matrix</h2><p>{open.length} open risks by likelihood × impact</p></div></div>
        <div class="card-b">
          <div class="matrix" role="table" aria-label="Risk matrix">
            {[5, 4, 3, 2, 1].map((l) => (
              <>
                <div class="mx-ax">{l}</div>
                {[1, 2, 3, 4, 5].map((i) => {
                  const here = open.filter((r) => Number(r.likelihood) === l && Number(r.impact) === i);
                  return <div class={`mx ${tone(l * i)}`} title={here.map((r) => r.title).join('\n') || `${l} × ${i}`}>{here.length || ''}</div>;
                })}
              </>
            ))}
            <div />{[1, 2, 3, 4, 5].map((i) => <div class="mx-ax">{i}</div>)}
          </div>
          <div class="muted" style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}><span>↑ likelihood</span><span>impact →</span></div>
        </div>
      </section>
      <section class="card span-8" style={{ overflow: 'hidden' }}>
        <div class="card-h" style={{ paddingBottom: '12px' }}><div><h2>Risk register</h2><p>Double-click likelihood, impact or status to change it</p></div>
          <div class="tools" style={{ display: 'flex', gap: '6px' }}><button class="btn" onClick={() => set({ drawer: { kind: 'documents', projectId: p.id } })}>Read from DoA</button><button class="btn primary" onClick={() => set({ drawer: { kind: 'risk', projectId: p.id } })}>+ Add risk</button></div></div>
        <DataTable rows={R} columns={cols} rowKey={(r) => r.id} title={`${p.code}-risks`} storageKey="pl-cols-risks" maxHeight={420}
          onOpen={(r) => set({ drawer: { kind: 'risk', projectId: p.id, id: r.id } })}
          actions={(sel, clear) => sel.length > 0 && <button class="btn danger" onClick={() => { sel.forEach((r) => deleteRisk(p.id, r.id)); clear(); }}>Delete {sel.length}</button>} />
      </section>
      {(p.assumptions?.length ?? 0) > 0 && (
        <section class="card span-12">
          <div class="card-h"><div><h2>Assumptions</h2><p>From the DoA risk analysis · these must hold for the action to succeed</p></div></div>
          <ol class="assume">{p.assumptions!.map((a) => <li>{a}</li>)}</ol>
        </section>
      )}
    </div>
  );
}
export type { ReportingPeriod };

export function ResultsDocs({ p }: { p: Project }) {
  const D = p.documents ?? [];
  const c = (p.contract ?? {}) as Record<string, unknown>;
  const facts: [string, string][] = ([['Contract', c.number], ['Title', c.title], ['Total', typeof c.total === 'number' ? full(c.total) : ''], ['EU maximum', typeof c.euMax === 'number' ? full(c.euMax) : ''], ['Duration', c.months ? `${c.months} months` : ''], ['Reporting', c.repMonths ? `every ${c.repMonths} months, due ${c.progDays ?? 60} days after` : ''], ['Pre-financing', c.prefin ? `${c.prefin}%` : '']] as [string, unknown][]).filter(([, v]) => v).map(([k, v]) => [k, String(v)]);
  return (
    <div class="grid g-12">
      <section class="card span-8">
        <div class="card-h"><div><h2>Project documents</h2><p>DoA, contract, budget annexes and logframe — what was read from each</p></div>
          <div class="tools"><button class="btn primary" onClick={() => set({ drawer: { kind: 'documents', projectId: p.id } })}>Add documents</button></div></div>
        <ul class="att" style={{ marginTop: '8px' }}>{D.map((d) => <li style={{ cursor: 'default' }}><span class="badge neutral">{d.kind}</span><div><div class="t">{d.name}</div><div class="d">{d.summary.join(' · ') || '—'} · {date(d.importedAt.slice(0, 10))}</div></div>
            <button class="btn ghost sm" title="Remove from the list (what was read stays on the project)" onClick={() => { if (confirm(`Remove “${d.name}”?`)) deleteDocument(p.id, d.name); }}>Delete</button></li>)}
          {!D.length && <li style={{ cursor: 'default' }}><span /><div class="d">None yet</div><span /></li>}</ul>
      </section>
      <section class="card span-4">
        <div class="card-h"><div><h2>Contract</h2><p>{facts.length ? 'Read from documents' : 'No contract read yet'}</p></div></div>
        <div class="card-b">{facts.length > 0 && <dl class="dl" style={{ gridTemplateColumns: '110px 1fr' }}>{facts.map(([k, v]) => <><dt>{k}</dt><dd>{v}</dd></>)}</dl>}</div>
      </section>
    </div>
  );
}

/** All reports of a project over time — as a chart, a table, or spending per budget heading. */
