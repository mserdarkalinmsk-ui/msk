import { useEffect, useState } from 'preact/hooks';

let pendingDocs: File[] = [];
export const setPendingDocs = (f: File[]) => { pendingDocs = f; };
import { upsertProject, useStore } from '../data/store';
import { analyse, type DocFindings } from '../domain/documents';
import { applyFindings, mergeFindings, type DocChoices } from '../domain/applydocs';
import { readDocument } from './docread';
import { date, full } from './format';

export function DocumentsPanel({ projectId, close }: { projectId: string; close: () => void }) {
  const p = useStore((s) => s.ledger.projects.find((x) => x.id === projectId));
  const [docs, setDocs] = useState<{ name: string; kind: string; F: DocFindings }[]>([]);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState<string[]>([]); const [over, setOver] = useState(false);
  const hasWorkbook = !!p?.reportingPeriods?.some((r) => r.snapshot?.workbook);
  const [c, setC] = useState<DocChoices>({ contract: true, dates: true, budget: !hasWorkbook, plan: true, risks: true, indicators: true });
  useEffect(() => { if (pendingDocs.length) { const f = pendingDocs; pendingDocs = []; add(f); } }, []);
  if (!p) return null;
  async function add(files: File[]) {
    const errs: string[] = []; const out = [...docs];
    for (const [i, f] of files.entries()) {
      setBusy(`Reading ${i + 1}/${files.length}: ${f.name}`);
      try { const d = await readDocument(f); out.push({ name: f.name, kind: d.kind, F: analyse(d) }); } catch (e) { errs.push(`${f.name}: ${(e as Error).message}`); }
    }
    setBusy(''); setErr(errs); setDocs(out);
  }
  const F = mergeFindings(docs.map((d) => d.F)), k = F.contract;
  const row = (key: keyof DocChoices, label: string, body: unknown, show: boolean) => show && (
    <label class="doc-find"><input type="checkbox" checked={c[key]} onChange={() => setC({ ...c, [key]: !c[key] })} /><div><b>{label}</b><div class="d">{body as never}</div></div></label>
  );
  const any = Object.keys(k).length || F.acts.length || F.risks.length || F.indicators.length;
  return (
    <>
      <div class="drawer-h"><div><div class="num muted" style={{ fontSize: '12px' }}>{p.code}</div><h2>Add project documents</h2></div><button class="btn icon ghost" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={close}>✕</button></div>
      <div class="drawer-b">
        <label class={`drop ${over ? 'on' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add([...(e.dataTransfer?.files ?? [])]); }}>
          <input type="file" multiple hidden accept=".pdf,.docx,.xlsx,.txt" onChange={(e) => add([...((e.target as HTMLInputElement).files ?? [])])} />
          <strong style={{ color: 'var(--ink)' }}>Drop the contract, Description of Action, action plan, logframe…</strong><br />PDF, Word (.docx) or Excel — read in this browser, nothing is uploaded
        </label>
        {busy && <div class="muted" role="status"><span class="spin" /> {busy}</div>}
        {err.length > 0 && <ul class="errlist">{err.map((e) => <li>{e}</li>)}</ul>}
        {docs.length > 0 && <ul class="att" style={{ margin: 0 }}>{docs.map((d) => <li style={{ cursor: 'default' }}><span class="badge neutral">{d.kind}</span><div><div class="t">{d.name}</div><div class="d">{d.F.summary.join(' · ') || 'nothing recognised'}</div></div><span /></li>)}</ul>}
        {docs.length > 0 && (any ? (
          <section class="card card-b" style={{ display: 'grid', gap: '4px' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '14px' }}>Apply to {p.code}</h3>
            {row('contract', 'Contract details', [k.number && `No ${k.number}`, k.total && `total ${full(k.total)}`, k.euMax && `EU max ${full(k.euMax)}`, k.euShare && `${k.euShare}% EU`, k.repMonths && `report every ${k.repMonths} months`, k.progDays && `due ${k.progDays} days after`, k.prefinancing && `pre-financing ${k.prefinancing}%`].filter(Boolean).join(' · '), Object.keys(k).length > 0)}
            {row('dates', 'Implementation period', `${k.start ? date(k.start) : p.start} → ${k.end ? date(k.end) : p.end}${k.months ? ` (${k.months} months)` : ''} — currently ${date(p.start)} → ${date(p.end)}`, !!(k.start || k.end))}
            {row('budget', 'Project budget from contract total', `${full(p.budget)} → ${full(k.total ?? 0)}${hasWorkbook ? ' — a financial report workbook already sets the budget' : ''}`, !!k.total && Math.abs((k.total ?? 0) - p.budget) > 1)}
            {row('plan', 'Action plan', `${F.acts.length} activities, ${F.planMonths} months — replaces the current plan${p.doa ? ` (${p.doa.acts.length} activities)` : ''}; statuses are kept`, F.acts.length > 0)}
            {row('risks', 'Risks', `${F.risks.length} risks merged by title: ${F.risks.slice(0, 3).map((r) => r.title).join(', ')}${F.risks.length > 3 ? '…' : ''}`, F.risks.length > 0)}
            {row('indicators', 'Results indicators', `${F.indicators.length} indicators: ${F.indicators.slice(0, 2).map((i) => i.indicator).join('; ')}${F.indicators.length > 2 ? '…' : ''}`, F.indicators.length > 0)}
          </section>
        ) : <p class="muted">No contract facts, action plan, risks or indicators were recognised in these files.</p>)}
      </div>
      <div class="drawer-f"><button class="btn" onClick={close}>Cancel</button>
        <button class="btn primary" disabled={!any} onClick={() => { upsertProject(applyFindings(p, F, c, docs.map((d) => ({ name: d.name, kind: d.kind, summary: d.F.summary })))); close(); }}>Apply to project</button></div>
    </>
  );
}
