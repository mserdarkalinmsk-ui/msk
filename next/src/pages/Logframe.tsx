import { useState } from 'preact/hooks';
import { set, updateProject } from '../data/store';
import type { Indicator } from '../domain/documents';
import { num, progress, tidy } from '../domain/logframe';
export { num, progress, tidy };
import type { Project } from '../domain/types';
import { full } from '../ui/format';
import { DataTable, type Column } from '../ui/DataTable';
import { bulletNote, structureNote, tidyText } from '../domain/notes';

const code = (s: string) => s.match(/^\s*(\d+(?:\.\d+)+)/)?.[1] ?? '';
const out = (c: string) => c.split('.').slice(0, 2).join('.');

export function Indicators({ p }: { p: Project }) {
  const I = p.indicators ?? [];
  if (!I.length) return <div class="card empty-page"><div><h2>No indicators yet</h2><p>Add the Description of Action or the logframe; indicators, baselines, targets and assumptions are read from it.</p><button class="btn primary" onClick={() => set({ drawer: { kind: 'documents', projectId: p.id } })}>Add documents</button></div></div>;
  const groups = new Map<string, Indicator[]>();
  for (const x of I) { const c = code(x.indicator); const k = x.result || (c ? `Output ${out(c)}` : x.level || 'Indicators'); groups.set(k, [...(groups.get(k) ?? []), x]); }
  const withTarget = I.filter((x) => tidy(x.target)).length;
  const P = I.map(progress).filter((v): v is number => v != null);
  type Row = { x: Indicator; code: string; text: string; group: string; prog: number | null };
  const rows: Row[] = [...groups].flatMap(([g, xs]) => xs.map((x) => ({ x, code: code(x.indicator), text: x.indicator.replace(/^\s*\d+(?:\.\d+)+\s*/, ''), group: tidy(g) || g, prog: progress(x) })));
  const setCurrent = (x: Indicator, v: string) => updateProject(p.id, { indicators: I.map((y) => (y === x ? { ...y, current: v.trim(), asOf: new Date().toISOString().slice(0, 10) } : y)) });
  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <section class="hero" aria-label="Indicator summary">
        <div class="kpi lead"><span class="label">Indicators</span><span class="value">{I.length}</span><span class="ctx">in {groups.size} result{groups.size > 1 ? 's' : ''}</span></div>
        <div class="kpi"><span class="label">With a target</span><span class="value">{withTarget}</span><span class="ctx">{I.length - withTarget ? `${I.length - withTarget} to complete` : 'all set'}</span></div>
        <div class="kpi"><span class="label">Average progress</span><span class="value">{P.length ? `${Math.round(P.reduce((a, b) => a + Math.min(1, b), 0) / P.length * 100)}%` : '—'}</span><span class="ctx">{P.length ? `${P.length} indicators measured · ${P.filter((v) => v >= 1).length} reached` : 'type the current value per indicator'}</span></div>
        <div class="kpi"><span class="label">Source</span><span class="value" style={{ fontSize: '18px' }}>{p.documents?.at(-1)?.name.slice(0, 28) ?? '—'}</span><span class="ctx">latest document</span></div>
      </section>
      <section class="card" style={{ overflow: 'hidden' }}>
        <div class="card-h" style={{ paddingBottom: '12px' }}><div><h2>Logframe indicators</h2><p>Sort, filter or group · double-click “Now” to record the current value · drag column edges to resize</p></div></div>
        <DataTable rows={rows} rowKey={(r) => r.x.id} title={`${p.code}-indicators`} storageKey="pl-cols-ind" maxHeight={620} defaultGroup="output"
          groupBy={[{ label: 'output', key: (r) => r.group }, { label: 'level', key: (r) => r.x.level || '—' }]}
          columns={[
            { key: 'code', label: 'Code', width: 78, pin: true, value: (r) => r.code, render: (r) => r.code ? <span class="lf-code num">{r.code}</span> : null },
            { key: 'ind', label: 'Indicator', width: 380, value: (r) => r.text, render: (r) => <span title={r.text}>{r.text}</span> },
            { key: 'base', label: 'Baseline', width: 110, value: (r) => tidy(r.x.baseline) || null },
            { key: 'target', label: 'Target', width: 120, value: (r) => tidy(r.x.target) || null, render: (r) => <b>{tidy(r.x.target) || '—'}</b> },
            { key: 'now', label: 'Now', width: 110, value: (r) => r.x.current ?? null, edit: { type: 'text', commit: (r, v) => setCurrent(r.x, v) } },
            { key: 'prog', label: 'Progress', width: 150, value: (r) => r.prog, render: (r) => r.prog == null ? <span class="muted">—</span> : <div class="lf-prog"><span style={{ width: `${Math.min(100, Math.max(0, r.prog * 100))}%`, background: r.prog >= 1 ? 'var(--good)' : 'var(--c1)' }} /><b class="num">{Math.round(r.prog * 100)}%</b></div> },
            { key: 'src', label: 'Source of verification', width: 220, value: (r) => tidy(r.x.source) || null, render: (r) => <span title={tidy(r.x.source)}>{tidy(r.x.source)}</span> },
            { key: 'ass', label: 'Assumptions', width: 240, value: (r) => tidy(r.x.assumptions) || null, render: (r) => <span title={tidy(r.x.assumptions)} class="muted">{tidy(r.x.assumptions)}</span> },
          ] as Column<Row>[]} />
      </section>
    </div>
  );
}

export function Justification({ p }: { p: Project }) {
  const N = p.budgetNotes ?? {};
  const lines = p.approvedBudget?.lines ?? [];
  const codes = [...new Set([...lines.map((l) => l.code), ...Object.keys(N)])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const has = Object.keys(N).length;
  const [open, setOpen] = useState('');
  return (
    <section class="card">
      <div class="card-h"><div><h2>Budget justification</h2><p>{has ? `Clarification and justification for ${has} of ${codes.length} lines` : 'Add the budget annex with “Clarification of the budget items / Justification of the estimated costs” to fill this'}</p></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button class="btn ghost" onClick={() => setOpen(open === 'all' ? '' : 'all')}>{open === 'all' ? 'Collapse all' : 'Expand all'}</button>
          <button class="btn primary" onClick={() => set({ drawer: { kind: 'documents', projectId: p.id } })}>Add documents</button></div></div>
      <div class="jt" key={open}>
        {codes.map((c) => {
          const l = lines.find((x) => x.code === c), n = N[c];
          return (
            <details class={`jt-row ${n ? '' : 'empty'}`} open={open === 'all'}>
              <summary>
                <span class="num jt-code">{c}</span>
                <b class="jt-d">{l?.description ?? n?.description}</b>
                <span class="jt-p">{n ? tidyText(n.clarification || n.justification || '') : 'No justification on file'}</span>
                {l && <span class="num jt-a">{full(l.approved ?? 0)}</span>}
              </summary>
              <div class="jt-body">
                {l?.approvedUnits ? <div class="num jt-calc">{l.approvedUnits} × {full(l.unitRate ?? 0)} {l.unit ? l.unit.toLowerCase() : ''} = {full(l.approved ?? 0)}</div> : null}
                {n?.clarification && <NoteText label="Clarification" text={n.clarification} />}{n?.justification && <NoteText label="Justification" text={n.justification} />}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

/** Justification text: a calculation breakdown (outputs → activities → subtotal) becomes a table, prose stays prose. */
function NoteText({ label, text }: { label: string; text: string }) {
  const S = structureNote(text);
  if (!S) { const B = bulletNote(text); return B ? <div class="nt"><i>{label}</i>{B.intro && <p>{B.intro}</p>}<ul class="nt-b">{B.items.map((x) => <li>{x[0].toUpperCase() + x.slice(1)}</li>)}</ul></div> : <p><i>{label}</i>{tidyText(text)}</p>; }
  const total = S.groups.reduce((s, g) => s + (g.subtotal ?? g.sum), 0);
  return (
    <div class="nt">
      <i>{label}</i>
      {S.intro && <p>{S.intro}</p>}
      <table class="nt-t">
        <tbody>{S.groups.map((g) => <>
          {g.title && <tr class="nt-g"><td colSpan={2}>{g.title}</td><td class="r num">{(g.subtotal ?? g.sum).toLocaleString('en-GB')}{S.unit ? ` ${S.unit}` : ''}{g.subtotal != null && Math.abs(g.subtotal - g.sum) > 0.01 && g.sum > 0 && <span class="badge warning" title={`Rows add up to ${g.sum}`}>≠ {g.sum}</span>}</td></tr>}
          {g.rows.map((r) => <tr><td class="num nt-c">{r.code}</td><td>{r.text}</td><td class="r num muted">{r.qty != null ? r.qty.toLocaleString('en-GB') : ''}</td></tr>)}
        </>)}</tbody>
        <tfoot><tr><td colSpan={2}>Total</td><td class="r num">{total.toLocaleString('en-GB')}{S.unit ? ` ${S.unit}` : ''}</td></tr></tfoot>
      </table>
    </div>
  );
}
