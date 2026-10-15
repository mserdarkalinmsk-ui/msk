import { readOfficeFile } from './officeImport';
import { useEffect, useState } from 'preact/hooks';
import { get, go, updateProject, upsertOfficeReport, upsertProject } from '../data/store';
import { applyFindings, mergeFindings } from '../domain/applydocs';
import { reportDate, reportFrom } from '../domain/autoimport';
import { readCheck } from '../domain/intake';
import { analyse, type DocFindings } from '../domain/documents';
import type { Project, ReportingPeriod } from '../domain/types';
import type { Workbook } from '../domain/workbook';
import { readDocument } from './docread';
import { date, full } from './format';
import { matchProject } from './PortfolioImport';
import { readCoe } from './ReportImport';

type Kind = 'office' | 'report' | 'budget' | 'plan' | 'contract' | 'logframe' | 'other' | 'error';
interface Row { file: File; kind: Kind; office?: import('../domain/office').OfficeReport; wb?: Workbook; F?: DocFindings; docKind?: string; date?: string; pid: string; why: string; note: string; force?: boolean }
const KIND: Record<Kind, { label: string; color: string }> = {
  office: { label: 'Office budget', color: '#0e7490' },
  report: { label: 'Financial report', color: '#3b82c4' }, budget: { label: 'Approved budget', color: '#30a46c' }, plan: { label: 'DoA / action plan', color: '#8e4ec6' },
  contract: { label: 'Contract', color: '#c27c0e' }, logframe: { label: 'Logframe / risks', color: '#0e9384' }, other: { label: 'Not recognised', color: '#8b8d98' }, error: { label: 'Unreadable', color: '#e5484d' },
};

/** Identifiers in a file name or document text: BH / JP / PMM / VC numbers, contract numbers. */
function guessProject(text: string, P: Project[]): { p?: Project; why: string } {
  const t = text.replace(/[_\-.]/g, ' ');
  const tries: [RegExp, (p: Project, v: string) => boolean, string][] = [
    [/\bBH\s?(\d{4})\b/i, (p, v) => p.bh === v, 'BH'],
    [/\bJP\s?(\d{4})\b/i, (p, v) => p.jp === v || p.code === `JP${v}` || p.pmm === v, 'JP'],
    [/\b(?:PMM|VC)\s?(\d{4})\b/i, (p, v) => p.pmm === v, 'PMM'],
    [/\b(7\d{8})\b/, (p, v) => p.contractNo === v, 'contract'],
  ];
  for (const [re, ok, w] of tries) {
    const m = t.match(re); if (!m) continue;
    const hits = P.filter((p) => ok(p, m[1]));
    if (hits.length === 1) return { p: hits[0], why: `${w} ${m[1]}` };
  }
  // A bare four-digit number that is exactly one project's BH or PMM.
  for (const m of t.matchAll(/\b(\d{4})\b/g)) {
    const hits = P.filter((p) => p.bh === m[1] || p.pmm === m[1]);
    if (hits.length === 1) return { p: hits[0], why: `number ${m[1]}` };
  }
  // No number: the project title written in the document (DoA cover pages rarely carry the BH number).
  const words = (s: string) => new Set(s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z]{4,}/g) ?? []);
  const W = words(t);
  const sc = P.map((p) => { const N = [...words(p.name)]; return { p, s: N.length >= 3 ? N.filter((w) => W.has(w)).length / N.length : 0 }; }).sort((a, b) => b.s - a.s);
  if (sc[0]?.s >= 0.75 && sc[0].s - (sc[1]?.s ?? 0) >= 0.2) return { p: sc[0].p, why: 'project title' };
  return { why: '' };
}

const kindOf = (F: DocFindings): Kind => (F.budget ? 'budget' : F.acts.length ? 'plan' : F.contract.number || F.contract.total || F.contract.start ? 'contract' : F.indicators.length || F.risks.length ? 'logframe' : 'other');

/** A folder of mixed files: each is recognised (report, budget, DoA, contract, logframe) and sent to its project. */
export function SmartImport({ files, close }: { files: File[]; close: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [done, setDone] = useState(0);
  const P = get().ledger.projects;
  useEffect(() => {
    let live = true;
    (async () => {
      const out: Row[] = [];
      for (const f of files.filter((f) => !f.name.startsWith('~$') && /\.(xlsx|xlsm|pdf|docx|txt)$/i.test(f.name))) {
        let r: Row | null = null;
        try {
        const off = await readOfficeFile(f).catch(() => null);
        if (off) r = { file: f, kind: 'office', office: off, date: off.date, pid: '', why: '', note: `${off.office} · situation ${date(off.date)} · ordinary budget ${full(off.lines.reduce((a, l) => a + l.ob.budget, 0) || off.situation?.budget || 0)}${off.hasPlan ? ' · with forecast' : ' · system export'}` };
        if (!r && /\.xls[xm]$/i.test(f.name)) {
          const wb = await readCoe(f).catch(() => null);
          const rd = wb ? reportDate(wb) : '';
          if (wb && rd && !isNaN(Date.parse(rd)) && (wb.totals.direct || wb.lines.length > 5 || wb.meta.extraction)) {
            const p = matchProject(wb, P), g = p ? { p, why: wb.meta.bh ? `BH ${wb.meta.bh}` : 'identifiers' } : guessProject(`${f.name} ${wb.meta.title ?? ''}`, P);
            r = { file: f, kind: 'report', wb, date: rd, pid: g.p?.id ?? '', why: g.why, note: `${wb.meta.periodFrom && !isNaN(Date.parse(wb.meta.periodFrom)) ? date(wb.meta.periodFrom) + ' → ' : ''}${date(rd)} · ${wb.meta.extraction ? `system extraction · ${wb.lines.length} lines · spent ${full(wb.lines.reduce((a, l) => a + (l.actual.cost ?? 0), 0))} · spent + committed ${full(wb.lines.reduce((a, l) => a + (l.sc ?? 0), 0))}` : `spent ${full(wb.totals.eligible?.actual ?? wb.totals.direct?.actual ?? 0)}`}` };
          }
        }
        if (!r) {
          try {
            const d = await readDocument(f), F = analyse(d), k = F.contract;
            const byFacts = P.filter((p) => (k.bh && p.bh === k.bh) || (k.jp && (p.jp === k.jp || p.pmm === k.jp)) || (k.number && p.contractNo === k.number));
            const g = byFacts.length === 1 ? { p: byFacts[0], why: k.bh ? `BH ${k.bh}` : k.jp ? `JP ${k.jp}` : `contract ${k.number}` } : guessProject(`${f.name} ${d.paragraphs.slice(0, 40).join(' ')}`, P);
            r = { file: f, kind: kindOf(F), F, docKind: d.kind, pid: g.p?.id ?? '', why: g.why, note: F.summary.join(' · ') };
          } catch (e) { r = { file: f, kind: 'error', pid: '', why: '', note: (e as Error).message }; }
        }
        } catch (e) { r = { file: f, kind: 'error', pid: '', why: '', note: (e as Error).message }; }
        out.push(r!); if (!live) return; setDone(out.length);
      }
      if (live) setRows(out);
    })();
    return () => { live = false; };
  }, []);
  const setPid = (i: number, pid: string) => setRows((R) => R!.map((r, k) => (k === i ? { ...r, pid, why: pid ? 'chosen' : '' } : r)));
  const chk = (r: Row) => { const p = r.wb && r.pid ? P.find((x) => x.id === r.pid) : undefined; return p ? readCheck(r.wb!, p) : null; };
  // A report whose lines would not add up to the file (or that belongs to another project) waits until forced.
  const usable = (r: Row) => r.pid && r.kind !== 'error' && r.kind !== 'other' && (r.force || !chk(r)?.blocking);
  const ok = rows?.filter(usable) ?? [], nOff = rows?.filter((r) => r.kind === 'office').length ?? 0;
  const apply = () => {
    // Office budgets first (oldest first, so a raw export can borrow line budgets from a forecast of the same import).
    for (const r of (rows ?? []).filter((x) => x.kind === 'office').sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) upsertOfficeReport(r.office!);
    for (const pid of new Set(ok.map((r) => r.pid))) {
      let p = get().ledger.projects.find((x) => x.id === pid)!;
      const D = ok.filter((r) => r.pid === pid && r.F);
      if (D.length) {
        const hasWb = !!p.reportingPeriods?.some((r) => r.snapshot?.workbook) || ok.some((r) => r.pid === pid && r.wb);
        p = applyFindings(p, mergeFindings(D.map((r) => r.F!)), { notes: true, approved: true, contract: true, dates: true, budget: !hasWb, plan: true, risks: true, indicators: true }, D.map((r) => ({ name: r.file.name, kind: r.docKind ?? 'doc', summary: r.F!.summary })));
        upsertProject(p);
      }
      const W = ok.filter((r) => r.pid === pid && r.wb).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
      if (W.length) {
        const R: ReportingPeriod[] = [...(p.reportingPeriods ?? [])];
        for (const r of W) { const { report } = reportFrom(r.wb!, r.file.name, { ...p, reportingPeriods: R }); const i = R.findIndex((x) => x.id === report.id); if (i >= 0) R[i] = report; else R.push(report); }
        R.sort((a, b) => a.date.localeCompare(b.date));
        updateProject(pid, { reportingPeriods: R });
      }
    }
    close();
    if (nOff && !ok.length) go('offices');
  };
  const lab = (p: Project) => `${p.bh ? `BH ${p.bh}` : p.code} · ${p.name.slice(0, 50)}`;
  const nFiles = files.length;
  return (
    <>
      <div class="drawer-h"><div><h2>Smart import · {nFiles} file{nFiles > 1 ? 's' : ''}</h2><p class="muted" style={{ margin: 0, fontSize: '12.5px' }}>Each file is recognised and sent to its project by BH, JP, PMM or contract number — check the project before importing</p></div><button class="btn icon ghost" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={close}>✕</button></div>
      <div class="drawer-b">
        {!rows ? <div role="status"><div class="muted" style={{ marginBottom: '6px' }}><span class="spin" /> Reading {done} of {nFiles}…</div><div class="meter"><span style={{ width: `${(done / nFiles) * 100}%`, background: 'var(--c1)' }} /></div></div> : <>
          <div class="si-sum">{(Object.keys(KIND) as Kind[]).map((k) => { const n = rows.filter((r) => r.kind === k).length; return n ? <span style={{ background: KIND[k].color }}>{n} {KIND[k].label}</span> : null; })}</div>
          <ul class="si-l">{rows.map((r, i) => (
            <li style={{ borderLeftColor: KIND[r.kind].color }} class={usable(r) ? '' : 'off'}>
              <div class="si-top"><span class="si-k" style={{ color: KIND[r.kind].color }}>{KIND[r.kind].label}</span><b title={r.file.name}>{r.file.name}</b></div>
              {r.note && <small class="muted">{r.note.slice(0, 160)}</small>}
              {(() => { const c = chk(r); return c && <div class="si-chk">{c.checks.map((x) => <div class={`badge ${x.level === 'ok' ? 'good' : x.level === 'error' ? 'critical' : 'warning'}`} style={{ whiteSpace: 'normal', textAlign: 'left', marginTop: '4px' }}>{x.level === 'ok' ? '✓' : '!'} {x.text}</div>)}
                {c.blocking && <label style={{ display: 'block', marginTop: '4px', fontSize: '12px' }}><input type="checkbox" checked={!!r.force} onChange={(e) => setRows((R) => R!.map((y, k) => (k === i ? { ...y, force: (e.target as HTMLInputElement).checked } : y)))} /> Import anyway</label>}</div>; })()}
              {r.kind === 'office' && <div class="si-p"><span class="badge good">goes to Offices · {r.office!.office}</span></div>}
              {r.kind !== 'error' && r.kind !== 'other' && r.kind !== 'office' && <div class="si-p"><select class="select" value={r.pid} onChange={(e) => setPid(i, (e.target as HTMLSelectElement).value)} aria-label="Project">
                <option value="">— choose project —</option>{P.map((p) => <option value={p.id}>{lab(p)}</option>)}</select>
                {r.pid ? <span class="badge good">{r.why === 'chosen' ? 'chosen' : `matched by ${r.why}`}</span> : <span class="badge warning">no match — choose</span>}</div>}
            </li>))}</ul>
          <p class="muted" style={{ fontSize: '11.5px' }}>Reports are added to the project's reports (same month is replaced). Budgets, contracts, DoA/action plans, logframes and justifications update the project as in “Add documents”. Nothing leaves this browser.</p>
        </>}
      </div>
      <div class="drawer-f"><button class="btn" onClick={close}>Cancel</button><button class="btn primary" disabled={!ok.length && !nOff} onClick={apply}>Import {ok.length + nOff} file{ok.length + nOff === 1 ? '' : 's'}{ok.length ? ` into ${new Set(ok.map((r) => r.pid)).size} project${new Set(ok.map((r) => r.pid)).size === 1 ? '' : 's'}` : ''}{nOff ? `${ok.length ? ' +' : ''} ${nOff} office budget${nOff > 1 ? 's' : ''}` : ''}</button></div>
    </>
  );
}
