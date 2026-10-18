import { useState } from 'preact/hooks';
import { filtered, upsertProject, useStore } from '../data/store';
import { adviseChanges, VERDICT, type Verdict } from '../domain/budgetchange';
import { lines } from '../domain/calc';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full } from '../ui/format';
import { downloadDocx } from '../ui/docxwrite';

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const pc = (v: number) => (Number.isFinite(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 1000) / 10)}%` : 'new');
const DOC: Record<Verdict, string> = { free: 'Information note', notify: 'Notification of budget transfer', approval: 'Request for prior approval — use of the contingency reserve', addendum: 'Request for an addendum — budget modification' };

/** Budget changes: what planned transfers need under the EU–CoE agreement, the room left per heading and the letter. */
export function BudgetChanges() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => p.approvedBudget?.lines?.length);
  const [pid, setPid] = useState('');
  const p = P.find((x) => x.id === pid) ?? P[0];
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [amt, setAmt] = useState(''), [why, setWhy] = useState('');
  const [letter, setLetter] = useState<HTMLElement | null>(null);
  if (!p) return <section class="card"><div class="card-h"><div><h2>Budget changes</h2><p>Load a project's approved budget (budget workbook or DoA) first — transfers are checked against the amounts originally entered.</p></div></div></section>;
  const all = p.budgetChanges ?? [], planned = all.filter((c) => c.status === 'planned'), done = all.filter((c) => c.status !== 'planned');
  const A = adviseChanges(p, planned);
  const L = lines(p).filter((l) => l.code !== '10' && !/^\d+$/.test(l.code) || l.code === '8');
  const save = (list: NonNullable<Project['budgetChanges']>) => upsertProject({ ...p, budgetChanges: list });
  const add = () => { const a = Number(amt); if (!from || !to || from === to || !(a > 0)) return; save([...all, { id: `bc${Date.now()}`, date: TODAY.toISOString().slice(0, 10), from, to, amount: a, ...(why.trim() ? { reason: why.trim() } : {}), status: 'planned' }]); setAmt(''); setWhy(''); };
  const desc = (c: string) => L.find((l) => l.code === c)?.description ?? p.approvedBudget?.names?.[c] ?? '';
  const V = VERDICT[A.verdict], c = (p.contract ?? {}) as { number?: string; title?: string };
  const total = planned.reduce((a, x) => a + x.amount, 0);
  const word = () => { if (letter) downloadDocx(`${p.code}-${A.verdict}-${TODAY.toISOString().slice(0, 10)}.docx`, letter, DOC[A.verdict]); };
  return (
    <>
      <section class="card">
        <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Budget changes</h2><p>EU–CoE Contribution Agreement: within one heading free · between headings notified while each heading stays within {Math.round(A.flex * 100)}% of the amount originally entered (cumulative) · beyond, new headings, admin costs or the total need an addendum · contingency needs prior approval</p></div>
          <select class="sp-sel" style={{ marginLeft: 'auto' }} value={p.id} onChange={(e) => setPid((e.target as HTMLSelectElement).value)}>{P.map((x) => <option value={x.id}>{lab(x)} · {x.name.slice(0, 50)}</option>)}</select></div>
        <div class="card-b table-scroll"><table class="mini bt-h"><thead><tr><th>Heading</th><th class="r">Agreement</th><th class="r">Now</th><th class="r">After planned transfers</th><th style={{ width: '24%' }}>Change against the agreement (limit ±{Math.round(A.flex * 100)}%)</th><th class="r">Can still receive</th><th class="r">Can still give</th></tr></thead>
          <tbody>{A.heads.map((h) => { const x = Number.isFinite(h.change) ? Math.max(-1.6, Math.min(1.6, h.change / A.flex)) : 1.6;
            return <tr class={h.over ? 'over' : ''}><td><b>{h.code}</b> {h.label}</td><td class="r num">{full(h.baseline)}</td><td class="r num">{full(h.current)}</td><td class="r num"><b>{full(h.after)}</b></td>
              <td><span class="bt-scale"><i class="lim l" /><i class="lim r" /><b style={{ left: x >= 0 ? '50%' : `${50 + x * 31.25}%`, width: `${Math.abs(x) * 31.25}%`, background: h.over ? 'var(--critical)' : Math.abs(x) > 0.7 ? 'var(--c4)' : 'var(--accent)' }} /><em>{pc(h.change)}</em></span></td>
              <td class="r num">{full(h.room.up)}</td><td class="r num">{full(h.room.down)}</td></tr>; })}</tbody></table></div>
      </section>

      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h"><div><h2>Planned transfers — {lab(p)}</h2><p>Add the transfers you intend to make; the advice updates at once</p></div></div>
        <div class="card-b" style={{ display: 'grid', gap: '10px' }}>
          <div class="sp-all">
            <label>from <select class="sp-sel" value={from} onChange={(e) => setFrom((e.target as HTMLSelectElement).value)}><option value="">line…</option>{L.map((l) => <option value={l.code}>{l.code} {(l.description ?? '').slice(0, 40)}</option>)}</select></label>
            <label>to <select class="sp-sel" value={to} onChange={(e) => setTo((e.target as HTMLSelectElement).value)}><option value="">line…</option>{L.map((l) => <option value={l.code}>{l.code} {(l.description ?? '').slice(0, 40)}</option>)}</select></label>
            <label>€ <input type="number" min="0" step="500" style={{ width: '110px' }} value={amt} onInput={(e) => setAmt((e.target as HTMLInputElement).value)} /></label>
            <label>reason <input style={{ width: '260px' }} value={why} placeholder="why the money is needed there" onInput={(e) => setWhy((e.target as HTMLInputElement).value)} /></label>
            <button class="btn primary" disabled={!from || !to || from === to || !(Number(amt) > 0)} onClick={add}>Add transfer</button></div>
          {planned.length > 0 && <table class="mini"><thead><tr><th>From</th><th>To</th><th class="r">Amount</th><th>Reason</th><th>Needs</th><th /></tr></thead>
            <tbody>{A.per.map((x, i) => <tr><td><b class="num">{x.t.from}</b> <span class="muted">{desc(x.t.from).slice(0, 34)}</span></td><td><b class="num">{x.t.to}</b> <span class="muted">{desc(x.t.to).slice(0, 34)}</span></td><td class="r num">{full(x.t.amount)}</td><td>{planned[i].reason ?? ''}</td>
              <td><span class={`badge ${VERDICT[x.verdict].tone}`} title={x.why}>{VERDICT[x.verdict].label}</span><div class="muted" style={{ fontSize: '11.5px' }}>{x.why}</div></td>
              <td><button class="btn ghost danger" onClick={() => save(all.filter((y) => y.id !== planned[i].id))}>Remove</button></td></tr>)}</tbody></table>}
          {planned.length > 0 && <div class={`bt-verdict ${V.tone}`}><b>{V.label}</b><span>{V.what}</span>{A.reasons.filter((r) => r !== V.what).map((r) => <small>{r}</small>)}
            <div class="bt-act"><button class="btn primary" onClick={word}>⤓ {DOC[A.verdict]} (Word)</button>
              <button class="btn" onClick={() => save(all.map((y) => (y.status === 'planned' ? { ...y, status: A.verdict === 'addendum' ? 'addendum' : 'notified' } : y)))}>Mark as {A.verdict === 'addendum' ? 'requested' : 'notified'}</button></div></div>}
          {!planned.length && <p class="muted" style={{ margin: 0 }}>No transfer planned. {A.heads.some((h) => Math.abs(h.baseline ? (h.current - h.baseline) / h.baseline : 0) > A.flex) ? 'Note: some headings are already beyond the limit — see the table above.' : ''}</p>}
        </div>
      </section>

      {planned.length > 0 && <details class="card sp-fold" style={{ marginTop: '16px' }}><summary><b>Letter preview</b> <span class="muted">{DOC[A.verdict]} — edit freely in Word after downloading</span></summary>
        <div class="card-b"><div class="bt-letter" ref={setLetter}>
          <p>To: Contracting Authority — Delegation of the European Union<br />From: Council of Europe{s.ledger.brand?.name ? ` — ${s.ledger.brand.name}` : ''}<br />Date: {date(TODAY.toISOString().slice(0, 10))}</p>
          <h1>{DOC[A.verdict]}</h1>
          <p><b>Contribution Agreement:</b> {c.number ?? '[number]'} — {c.title ?? p.name}<br /><b>Budget head:</b> {p.bh ?? '—'} · <b>Period:</b> {date(p.start)} – {date(p.end)}</p>
          <p>{A.verdict === 'addendum' ? `In accordance with the General Conditions of the Contribution Agreement, the Council of Europe requests an addendum to modify the budget of the Action as set out below. The modification exceeds the flexibility of ${Math.round(A.flex * 100)}% between headings and/or concerns elements that require an amendment.`
            : A.verdict === 'approval' ? 'The Council of Europe requests the prior written approval of the Contracting Authority for the use of the contingency reserve as set out below.'
            : `In accordance with the General Conditions of the Contribution Agreement, the Council of Europe informs the Contracting Authority of the following budget transfers. Each heading remains within ${Math.round(A.flex * 100)}% of the amount originally entered; the basic purpose of the Action is not affected.`}</p>
          <h2>Transfers</h2>
          <table><thead><tr><th>From line</th><th>To line</th><th>Amount (EUR)</th><th>Justification</th></tr></thead>
            <tbody>{planned.map((x) => <tr><td>{x.from} {desc(x.from)}</td><td>{x.to} {desc(x.to)}</td><td>{full(x.amount)}</td><td>{x.reason ?? ''}</td></tr>)}</tbody>
            <tfoot><tr><td colSpan={2}>Total transferred</td><td>{full(total)}</td><td /></tr></tfoot></table>
          <h2>Budget by heading</h2>
          <table><thead><tr><th>Heading</th><th>Agreement (EUR)</th><th>Revised (EUR)</th><th>Change</th></tr></thead>
            <tbody>{A.heads.map((h) => <tr><td>{h.code} {h.label}</td><td>{full(h.baseline)}</td><td>{full(h.after)}</td><td>{pc(h.change)}</td></tr>)}</tbody></table>
          <p>The total budget of the Action and the maximum contribution of the European Union remain unchanged{A.verdict === 'addendum' ? ' unless stated otherwise above' : ''}. Administrative costs remain at 7% of the direct eligible costs.</p>
          <p>Yours sincerely,<br /><br />[Name, function]</p>
        </div></div></details>}

      {done.length > 0 && <details class="card sp-fold" style={{ marginTop: '16px' }}><summary><b>Earlier changes</b> <span class="muted">{done.length} transfers · {full(done.reduce((a, x) => a + x.amount, 0))}</span></summary>
        <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Date</th><th>From</th><th>To</th><th class="r">Amount</th><th>Reason</th><th>Handled as</th><th /></tr></thead>
          <tbody>{done.map((x) => <tr><td class="num">{date(x.date)}</td><td class="num">{x.from}</td><td class="num">{x.to}</td><td class="r num">{full(x.amount)}</td><td>{x.reason ?? ''}</td><td>{x.status === 'addendum' ? 'Addendum requested' : 'Notified'}</td><td><button class="btn ghost danger" onClick={() => save(all.filter((y) => y.id !== x.id))}>Remove</button></td></tr>)}</tbody></table>
          <p class="muted" style={{ fontSize: '12px' }}>Once a report with the new budget column is loaded, the changes appear in "Now" above and count towards the limit.</p></div></details>}
    </>
  );
}
