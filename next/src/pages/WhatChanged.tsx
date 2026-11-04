import { useEffect, useState } from 'preact/hooks';
import { filtered, go, restorePoints, useStore } from '../data/store';
import { changesSince } from '../domain/changes';
import type { Ledger, Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full, short } from '../ui/format';

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${full(Math.abs(v))}`;
type Point = { key: string; at: string; ledger: Ledger };

/** What changed since an earlier day: spending, reports, documents, purchase orders and new suppliers per project. */
export function WhatChanged() {
  const s = useStore((x) => x);
  const [pts, setPts] = useState<Point[] | null>(null);
  const [key, setKey] = useState('');
  useEffect(() => { void restorePoints().then((L) => {
    const P = L.filter((x) => x.key.includes(':snap:'));
    setPts(P);
    // Default: about a month back (the newest point at least 25 days old), else the oldest kept.
    const lim = new Date(TODAY.getTime() - 25 * 864e5).toISOString().slice(0, 10);
    setKey((P.find((x) => x.at.slice(0, 10) <= lim) ?? P.at(-1))?.key ?? '');
  }); }, []);
  if (!pts) return <section class="card card-b"><span class="spin" /> Reading restore points…</section>;
  const pt = pts.find((x) => x.key === key);
  if (!pt) return <section class="card"><div class="card-h"><div><h2>What changed</h2><p>A restore point is kept automatically each day you work with the app (30 days). Come back after the next update to see what changed.</p></div></div></section>;
  const ids = new Set(filtered(s).map((p) => p.id));
  const C = changesSince({ ...pt.ledger, projects: pt.ledger.projects.filter((p) => ids.has(p.id) || !s.ledger.projects.some((x) => x.id === p.id)) }, { ...s.ledger, projects: s.ledger.projects.filter((p) => ids.has(p.id)) }, pt.at);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  return (
    <>
      <section class="hero" aria-label="What changed">
        <div class="kpi lead"><span class="label">Spent since {date(pt.at.slice(0, 10))}</span><span class="value">{short(C.spent)}</span><span class="ctx">spent + committed {C.sc >= 0 ? '+' : '−'}{short(Math.abs(C.sc))} · {C.projects.length} projects changed</span></div>
        <div class="kpi"><span class="label">New purchase orders</span><span class="value">{C.newPOs}</span><span class="ctx">{C.projects.reduce((a, c) => a + c.closedPOs.length, 0)} closed</span></div>
        <div class="kpi"><span class="label">New suppliers</span><span class="value">{C.newSuppliers.length}</span><span class="ctx">{C.newSuppliers.slice(0, 3).join(', ') || 'none'}{C.newSuppliers.length > 3 ? '…' : ''}</span></div>
        <div class="kpi"><span class="label">Reports and documents</span><span class="value">{C.projects.reduce((a, c) => a + c.reports.length, 0)}</span><span class="ctx">reports · {C.projects.reduce((a, c) => a + c.documents.length, 0)} documents loaded</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Changes by project</h2><p>Compared with the data as it was at the start of the chosen day (restore points are kept 30 days)</p></div>
          <label class="muted" style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>Since<select class="sp-sel" value={key} onChange={(e) => setKey((e.target as HTMLSelectElement).value)}>{pts.map((x) => <option value={x.key}>{date(x.at.slice(0, 10))}</option>)}</select></label></div>
        <div class="card-b wc-list">
          {C.projects.map((c) => <article class="wc" onClick={() => go(`project/${c.p.id}`)}>
            <header><b>{lab(c.p)}</b><small class="muted"> {cname(c.p.country)} · {c.p.name.slice(0, 70)}</small>{c.added && <span class="badge good" style={{ marginLeft: '8px' }}>new project</span>}
              <span class="wc-n" style={{ color: c.spent > 0 ? 'var(--accent)' : undefined }}>{Math.abs(c.spent) > 1 ? `${signed(c.spent)} spent` : ''}</span></header>
            <ul>
              {Math.abs(c.sc - c.spent) > 1 && <li>Commitments {signed(c.sc - c.spent)}</li>}
              {c.reports.length > 0 && <li>Reports loaded: {c.reports.join(', ')}</li>}
              {c.documents.length > 0 && <li>Documents: {c.documents.slice(0, 4).join(', ')}{c.documents.length > 4 ? ` +${c.documents.length - 4}` : ''}</li>}
              {c.newPOs.length > 0 && <li>{c.newPOs.length} new PO{c.newPOs.length > 1 ? 's' : ''} · {full(c.newPOs.reduce((a, x) => a + (x.sc || x.amount), 0))}{c.newPOs.slice(0, 3).map((x) => <small class="muted"> · {x.supplier || x.description}</small>)}</li>}
              {c.closedPOs.length > 0 && <li>{c.closedPOs.length} PO{c.closedPOs.length > 1 ? 's' : ''} closed</li>}
              {c.newSuppliers.length > 0 && <li><b>New supplier{c.newSuppliers.length > 1 ? 's' : ''}:</b> {c.newSuppliers.join(', ')}</li>}
              {c.budget && <li>Budget {full(c.budget[0])} → {full(c.budget[1])}</li>}
              {c.dates && <li>Dates {c.dates}</li>}
            </ul></article>)}
          {C.removed.length > 0 && <p class="muted">Removed since then: {C.removed.map(lab).join(', ')}</p>}
          {!C.projects.length && !C.removed.length && <p class="muted">Nothing changed since {date(pt.at.slice(0, 10))}.</p>}
        </div>
      </section>
    </>
  );
}
