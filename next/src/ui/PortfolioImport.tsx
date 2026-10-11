import { useEffect, useState } from 'preact/hooks';
import { get, updateProject } from '../data/store';
import { idConflicts, reportDate, reportFrom } from '../domain/autoimport';
import type { Project, ReportingPeriod } from '../domain/types';
import type { Workbook } from '../domain/workbook';
import { date, full } from './format';
import { readCoe } from './ReportImport';

interface Row { file: File; wb?: Workbook; date: string; p?: Project; note: string }

/** Workbooks are matched on BH / contract / JP; only a positive match counts (no guessing on missing identifiers). */
function matchProject(wb: Workbook, P: Project[]) {
  const m = wb.meta;
  const hits = P.filter((p) => ((m.bh && p.bh === m.bh) || (m.contract && p.contractNo === m.contract) || (m.jp && p.jp === m.jp)) && !idConflicts(wb, p).length);
  return hits.length === 1 ? hits[0] : undefined;
}

/** The month's report workbooks for the whole portfolio at once: each file goes to its own project by BH. */
export function PortfolioImport({ files, close }: { files: File[]; close: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [done, setDone] = useState(0);
  useEffect(() => {
    let live = true;
    (async () => {
      const P = get().ledger.projects, out: Row[] = [];
      for (const f of files) {
        const wb = await readCoe(f).catch(() => null);
        if (!live) return;
        if (!wb) out.push({ file: f, date: '', note: 'not a financial report workbook' });
        else { const p = matchProject(wb, P); out.push({ file: f, wb, date: reportDate(wb), p, note: p ? '' : `no project with BH ${wb.meta.bh ?? '—'}${wb.meta.jp ? ` / JP ${wb.meta.jp}` : ''}` }); }
        setDone(out.length);
      }
      if (live) setRows(out.sort((a, b) => (a.p?.code ?? 'zz').localeCompare(b.p?.code ?? 'zz') || a.date.localeCompare(b.date)));
    })();
    return () => { live = false; };
  }, []);
  const ok = rows?.filter((r) => r.p && r.wb) ?? [];
  const apply = () => {
    const by = new Map<string, Row[]>(); for (const r of ok) by.set(r.p!.id, [...(by.get(r.p!.id) ?? []), r]);
    for (const [id, R0] of by) {
      const p = get().ledger.projects.find((x) => x.id === id)!;
      const R: ReportingPeriod[] = [...(p.reportingPeriods ?? [])];
      for (const r of R0.sort((a, b) => a.date.localeCompare(b.date))) {
        const { report } = reportFrom(r.wb!, r.file.name, { ...p, reportingPeriods: R });
        const i = R.findIndex((x) => x.id === report.id); if (i >= 0) R[i] = report; else R.push(report);
      }
      R.sort((a, b) => a.date.localeCompare(b.date));
      updateProject(id, { reportingPeriods: R });
    }
    close();
  };
  return (
    <>
      <div class="drawer-h"><div><h2>Monthly update · {files.length} files</h2><p class="muted" style={{ margin: 0, fontSize: '12.5px' }}>Each workbook goes to its project by budget head (BH), contract or JP number</p></div><button class="btn icon ghost" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={close}>✕</button></div>
      <div class="drawer-b">
        {!rows ? <div role="status"><div class="muted" style={{ marginBottom: '6px' }}><span class="spin" /> Reading {done} of {files.length}…</div><div class="meter"><span style={{ width: `${done / files.length * 100}%`, background: 'var(--c1)' }} /></div></div> : <>
          <table class="mini" style={{ width: '100%' }}><thead><tr><th>File</th><th>Project</th><th>Report date</th><th class="r">Spent</th><th /></tr></thead>
            <tbody>{rows.map((r) => <tr><td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.file.name}>{r.file.name}</td>
              <td>{r.p ? <b>{r.p.bh ? `BH ${r.p.bh}` : r.p.code}</b> : '—'}</td><td class="num">{r.date ? date(r.date) : ''}</td><td class="r num">{r.wb ? full(r.wb.totals.eligible?.actual ?? 0) : ''}</td>
              <td>{r.p ? <span class="badge good">ok</span> : <span class="badge critical" title={r.note}>skip</span>}</td></tr>)}</tbody></table>
          {rows.some((r) => !r.p) && <p class="muted" style={{ fontSize: '12px' }}>Skipped files: {rows.filter((r) => !r.p).map((r) => `${r.file.name} (${r.note})`).join('; ')}</p>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}><button class="btn" onClick={close}>Cancel</button><button class="btn primary" disabled={!ok.length} onClick={apply}>Import {ok.length} into {new Set(ok.map((r) => r.p!.id)).size} projects</button></div>
        </>}
      </div>
    </>
  );
}
