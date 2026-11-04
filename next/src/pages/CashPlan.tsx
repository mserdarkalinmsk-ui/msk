import { useState } from 'preact/hooks';
import { filtered, go, upsertProject, useStore } from '../data/store';
import { cashRow, type CashRow } from '../domain/cash';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const REQ: Record<CashRow['request'], { t: string; c: string }> = {
  now: { t: 'Request now', c: 'var(--critical)' }, soon: { t: 'Within 3 months', c: 'var(--warn)' }, later: { t: 'Later', c: 'var(--good)' }, none: { t: '—', c: 'var(--ink-3)' },
};
function readTh() { try { return Number(localStorage.getItem('pl-cash-th')) || 70; } catch { return 70; } }

/** Cash plan: donor payments received against spending, when the cash runs out and when to request the next payment. */
export function CashPlan() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => !p.datesTbc);
  const [th, setThS] = useState(readTh);
  const setTh = (v: number) => { setThS(v); try { localStorage.setItem('pl-cash-th', String(v)); } catch { /* ignore */ } };
  const [open, setOpen] = useState('');
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const today = TODAY.toISOString().slice(0, 10), in90 = new Date(TODAY.getTime() + 90 * 864e5).toISOString().slice(0, 10);
  const R = P.map((p) => cashRow(p, TODAY, th / 100)).sort((a, b) => ['now', 'soon', 'later', 'none'].indexOf(a.request) - ['now', 'soon', 'later', 'none'].indexOf(b.request) || (a.runout ?? '9').localeCompare(b.runout ?? '9'));
  const T = { rec: R.reduce((a, r) => a + r.received, 0), cash: R.reduce((a, r) => a + Math.max(0, r.cash), 0), now: R.filter((r) => r.request === 'now'), short: R.filter((r) => r.runout && r.runout <= in90 && r.p.end > today), noPay: R.filter((r) => !r.received).length, exp: R.filter((r) => r.expected).length };
  const xlsx = () => download(`cash-plan-${today}.xlsx`, [{ name: 'Cash plan', money: [2, 3, 4, 5, 7], rows: [
    ['Project', 'Country', 'Contribution', 'Received', 'Spent', 'Cash left', 'Used of received', 'Monthly pace', 'Cash runs out', 'Next payment request', 'Request from', 'Received = expected pre-financing'],
    ...R.map((r) => [lab(r.p), cname(r.p.country), r.contribution, r.received, r.spent, r.cash, r.received ? r.used : '', r.burn, r.runout ?? '', REQ[r.request].t, r.requestOn ?? '', r.expected ? 'yes' : ''])] }]);
  return (
    <>
      <section class="hero" aria-label="Cash plan">
        <div class="kpi lead"><span class="label">Cash on hand</span><span class="value">{short(T.cash)}</span><span class="ctx">received {short(T.rec)} from donors · {R.length} projects{T.exp ? ` · ${T.exp} use the contract pre-financing (no payment entered)` : ''}</span></div>
        <div class="kpi"><span class="label">Payment to request now</span><span class="value" style={{ color: T.now.length ? 'var(--critical)' : undefined }}>{T.now.length}</span><span class="ctx">{T.now.length ? T.now.map((r) => lab(r.p)).join(', ') : `no project has used ${th}% of what it received`}</span></div>
        <div class="kpi"><span class="label">Cash runs out within 3 months</span><span class="value" style={{ color: T.short.length ? 'var(--warn)' : undefined }}>{T.short.length}</span><span class="ctx">{T.short.length ? T.short.map((r) => lab(r.p)).join(', ') : 'at the current pace'}</span></div>
        <div class="kpi"><span class="label">No payment information</span><span class="value">{T.noPay}</span><span class="ctx">enter payments or the contract pre-financing</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Cash by project</h2><p>Spent against money received · pace = spending of the last six months of reports · click a project to enter the payments received</p></div>
          <label class="muted" style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>Next request when used ≥<input type="number" min="10" max="100" step="5" value={th} style={{ width: '60px' }} onChange={(e) => setTh(Number((e.target as HTMLInputElement).value) || 70)} />%</label>
          <button class="btn" onClick={xlsx}>⤓ Excel</button></div>
        <div class="card-b table-scroll"><table class="mini cp-t"><thead><tr><th>Project</th><th class="r">Contribution</th><th class="r">Received</th><th class="r">Spent</th><th class="r">Cash left</th><th style={{ width: '16%' }}>Used of received</th><th class="r">Pace / month</th><th>Cash runs out</th><th>Next payment</th></tr></thead>
          <tbody>{R.map((r) => <>
            <tr class="click" onClick={() => setOpen(open === r.p.id ? '' : r.p.id)}>
              <td><b>{lab(r.p)}</b><small class="muted"> {cname(r.p.country)}</small></td>
              <td class="r num">{full(r.contribution)}</td>
              <td class="r num">{r.received ? full(r.received) : <span class="muted">—</span>}{r.expected && <small class="muted" title="Contract pre-financing — no payment entered yet"> exp.</small>}</td>
              <td class="r num">{full(r.spent)}</td>
              <td class="r num" style={{ color: r.received && r.cash < 0 ? 'var(--critical)' : undefined }}><b>{r.received ? full(r.cash) : '—'}</b></td>
              <td>{r.received ? <span class="cp-bar" title={`${Math.round(r.used * 100)}% of the money received is spent`}><i style={{ width: `${Math.min(100, r.used * 100)}%`, background: r.used >= th / 100 ? 'var(--critical)' : r.used >= th / 100 - 0.15 ? 'var(--c4)' : 'var(--accent)' }} /><b style={{ left: `${th}%` }} /><span>{Math.round(r.used * 100)}%</span></span> : <span class="muted">no payment</span>}</td>
              <td class="r num">{full(r.burn)}</td>
              <td class="num" style={{ color: r.runout && r.runout <= in90 ? 'var(--warn)' : undefined }}>{r.runout ? date(r.runout) : '—'}</td>
              <td><span class="badge" style={{ color: REQ[r.request].c, borderColor: REQ[r.request].c }}>{REQ[r.request].t}</span>{r.request !== 'now' && r.request !== 'none' && r.requestOn && <small class="muted"> from {date(r.requestOn)}</small>}</td></tr>
            {open === r.p.id && <tr class="sp-sub"><td colSpan={9}><Payments p={r.p} /></td></tr>}</>)}</tbody></table>
          {!R.length && <p class="muted">No projects in the selection.</p>}</div>
      </section>
    </>
  );
}

/** Payments received for one project (pre-financing and instalments). */
function Payments({ p }: { p: Project }) {
  const L = [...(p.payments ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const [d, setD] = useState(TODAY.toISOString().slice(0, 10)), [a, setA] = useState(''), [note, setNote] = useState('');
  const save = (list: NonNullable<Project['payments']>) => upsertProject({ ...p, payments: list });
  return <div class="cp-pay">
    <div class="cp-pay-h"><b>Payments received — {p.code}</b><button class="btn ghost" onClick={() => go(`project/${p.id}`)}>Open project →</button></div>
    {L.length ? <table class="mini"><thead><tr><th>Date</th><th class="r">Amount</th><th>Note</th><th /></tr></thead>
      <tbody>{L.map((x) => <tr><td class="num">{date(x.date)}</td><td class="r num">{full(x.amount)}</td><td>{x.note ?? ''}</td><td><button class="btn ghost" onClick={() => save(L.filter((y) => y !== x))}>Remove</button></td></tr>)}</tbody>
      <tfoot><tr><td><b>Total</b></td><td class="r num"><b>{full(L.reduce((s, x) => s + x.amount, 0))}</b></td><td colSpan={2} /></tr></tfoot></table>
      : <p class="muted" style={{ margin: '4px 0' }}>No payment entered — the contract pre-financing is used if it is on file.</p>}
    <div class="sp-all"><label>date <input type="date" value={d} onChange={(e) => setD((e.target as HTMLInputElement).value)} /></label>
      <label>amount € <input type="number" min="0" step="1000" style={{ width: '120px' }} value={a} onInput={(e) => setA((e.target as HTMLInputElement).value)} /></label>
      <label>note <input style={{ width: '200px' }} value={note} placeholder="pre-financing, 2nd instalment…" onInput={(e) => setNote((e.target as HTMLInputElement).value)} /></label>
      <button class="btn primary" disabled={!(Number(a) > 0) || !d} onClick={() => { save([...L, { date: d, amount: Number(a), ...(note.trim() ? { note: note.trim() } : {}) }]); setA(''); setNote(''); }}>Add payment</button></div>
  </div>;
}
