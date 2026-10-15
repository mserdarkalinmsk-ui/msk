import { useState } from 'preact/hooks';
import { setStaffOverride, useStore } from '../data/store';
import { daysUntil, roster } from '../domain/staff';
import { TODAY } from '../today';
import { parseDay } from './csv';
import { date, full } from './format';

export function ContractPanel({ projectId, k, close }: { projectId: string; k: string; close: () => void }) {
  const p = useStore((s) => s.ledger.projects.find((x) => x.id === projectId));
  const a = p ? roster(p, TODAY).find((x) => x.key === k) : undefined;
  const [f, setF] = useState({ start: a?.start ?? '', end: a?.end ?? '', fte: a?.fte != null ? String(Math.round(a.fte * 100)) : '', leaveDate: a?.override?.leaveDate ?? '', note: a?.override?.note ?? '' });
  const [err, setErr] = useState('');
  if (!p || !a) return <div class="drawer-b">Person not found.</div>;
  const save = () => {
    const s = f.start ? parseDay(f.start) : '', e = f.end ? parseDay(f.end) : '', l = f.leaveDate ? parseDay(f.leaveDate) : '';
    const fte = f.fte === '' ? null : Number(f.fte) / 100;
    if (s === null || e === null || l === null) return setErr('Use valid dates');
    if (s && e && e < s) return setErr('End must be after start');
    if (fte != null && !(fte > 0 && fte <= 1)) return setErr('FTE must be between 1 and 100 %');
    setStaffOverride(p.id, a.key, { start: s || undefined, end: e || undefined, fte, leaveDate: l || undefined, note: f.note.trim(), verified: true });
    close();
  };
  const inp = (key: keyof typeof f, label: string, type: 'date' | 'number' = 'date') => (
    <div class="field"><label for={`ct-${key}`}>{label}</label><input id={`ct-${key}`} {...({ type } as Record<string, string>)} value={f[key]} onInput={(e) => setF({ ...f, [key]: (e.target as HTMLInputElement).value })} /></div>
  );
  return (
    <>
      <div class="drawer-h"><div><div class="num muted" style={{ fontSize: '12px' }}>{p.code} · {a.code}</div><h2>{a.display}</h2></div><button class="btn icon ghost" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={close}>✕</button></div>
      <div class="drawer-b">
        <dl class="dl">
          <dt>Position</dt><dd>{a.position}</dd>
          <dt>Base</dt><dd>{a.base === 'HQ' ? 'SxB / HQ' : a.base} <span class="muted" style={{ fontSize: '12px' }}>· {a.baseSource}</span></dd>
          <dt>Status</dt><dd>{a.status}{a.status === 'Active' && a.end ? ` · ${daysUntil(a.end, TODAY)} days left` : ''}</dd>
        </dl>
        <section class="card">
          <div class="card-h"><div><h2>Source rows</h2><p>As read from imported reports — payroll dates are not contract end dates</p></div></div>
          <ul class="att" style={{ marginTop: '10px' }}>
            {a.contracts.map((c) => (
              <li style={{ cursor: 'default', gridTemplateColumns: 'auto 1fr auto' }}>
                <span class={`badge ${c.review ? 'warning' : 'neutral'}`}>{c.recordKind === 'Payroll observation' ? 'payroll' : 'PO'}</span>
                <div style={{ minWidth: 0 }}><div class="t" style={{ fontSize: '13px' }}>{c.start && c.end ? `${date(c.start)} → ${date(c.end)}` : 'No dates in source'}{c.fte != null ? ` · ${Math.round(c.fte * 100)}%` : ''}</div>
                  <div class="d" style={{ whiteSpace: 'normal' }}>{c.description || c.po}</div><div class="d">{c.sourceSheet} row {c.sourceRow} · PO {c.po}</div></div>
                <span class="num" style={{ fontSize: '12px' }}>{c.actual != null ? full(c.actual) : ''}</span>
              </li>
            ))}
          </ul>
        </section>
        <section class="card card-b" style={{ display: 'grid', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>Confirm contract details {a.override?.verified && <span class="badge good">confirmed</span>}</h3>
          <div class="form-2">{inp('start', 'Contract start')}{inp('end', 'Contract end')}</div>
          <div class="form-2">{inp('fte', 'FTE %', 'number')}{inp('leaveDate', 'Leave date (if leaving early)')}</div>
          <div class="field"><label for="ct-note">Note</label><input id="ct-note" value={f.note} onInput={(e) => setF({ ...f, note: (e.target as HTMLInputElement).value })} placeholder="e.g. renewal requested from HR on…" /></div>
          {err && <ul class="errlist"><li>{err}</li></ul>}
        </section>
      </div>
      <div class="drawer-f">
        {a.override && <button class="btn ghost" onClick={() => { setStaffOverride(p.id, a.key, null); close(); }}>Clear manual details</button>}
        <span style={{ flex: 1 }} />
        <button class="btn" onClick={close}>Cancel</button><button class="btn primary" onClick={save}>Confirm & save</button>
      </div>
    </>
  );
}
