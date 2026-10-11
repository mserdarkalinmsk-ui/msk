import { useEffect, useState } from 'preact/hooks';
import { updateProject } from '../data/store';
import { idConflicts, reportDate, reportFrom } from '../domain/autoimport';
import type { Project, ReportingPeriod } from '../domain/types';
import type { Workbook } from '../domain/workbook';
import { date, full } from './format';
import { readCoe } from './ReportImport';

interface Row { file: File; wb?: Workbook; date: string; status: 'ok' | 'replace' | 'duplicate' | 'other' | 'unreadable'; note: string; spent: number }

/** Many report workbooks for one project at once: read, check, order by report date, import together. */
export function BulkReports({ p, files, close }: { p: Project; files: File[]; close: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState(0);
  useEffect(() => {
    let live = true;
    (async () => {
      const out: Row[] = [];
      for (const f of files) {
        const wb = await readCoe(f).catch(() => null);
        if (!live) return;
        if (!wb) out.push({ file: f, date: '', status: 'unreadable', note: 'not a financial report workbook', spent: 0 });
        else {
          const c = idConflicts(wb, p);
          out.push({ file: f, wb, date: reportDate(wb), status: c.length ? 'other' : 'ok', note: c.length ? `belongs to another project (${c.join(', ')})` : '', spent: wb.totals.eligible?.actual ?? 0 });
        }
        setDone(out.length);
      }
      // one report per date: the last file given for a date wins; dates already on file are replaced
      const seen = new Map<string, Row>();
      for (const r of out.filter((x) => x.status === 'ok')) { const prev = seen.get(r.date); if (prev) { prev.status = 'duplicate'; prev.note = `same date as ${r.file.name}`; } seen.set(r.date, r); }
      for (const r of seen.values()) if ((p.reportingPeriods ?? []).some((x) => x.date === r.date)) { r.status = 'replace'; r.note = 'replaces the report with this date'; }
      if (live) setRows(out.sort((a, b) => (a.date || '9').localeCompare(b.date || '9')));
    })();
    return () => { live = false; };
  }, []);
  const good = rows.filter((r) => r.status === 'ok' || r.status === 'replace');
  const apply = () => {
    const R: ReportingPeriod[] = [...(p.reportingPeriods ?? [])];
    let q: Project = { ...p };
    for (const r of good) {
      const { report } = reportFrom(r.wb!, r.file.name, { ...q, reportingPeriods: R });
      const i = R.findIndex((x) => x.id === report.id); if (i >= 0) R[i] = report; else R.push(report);
      const m = r.wb!.meta; q = { ...q, bh: q.bh || m.bh, contractNo: q.contractNo || m.contract, jp: q.jp || m.jp };
    }
    R.sort((a, b) => a.date.localeCompare(b.date));
    const last = good.at(-1)?.wb?.totals.eligible?.budget;
    updateProject(p.id, { reportingPeriods: R, bh: q.bh, contractNo: q.contractNo, jp: q.jp, ...(!p.approvedBudget && last ? { budget: Math.round(last * 100) / 100 } : {}) });
    close();
  };
  const tone = { ok: 'good', replace: 'warning', duplicate: 'neutral', other: 'critical', unreadable: 'critical' } as const;
  return (
    <>
      <div class="drawer-h"><div><div class="num muted" style={{ fontSize: '12px' }}>{p.code}</div><h2>Import {files.length} financial reports</h2></div><button class="btn icon ghost" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={close}>✕</button></div>
      <div class="drawer-b">
        {rows.length < files.length ? (
          <div role="status"><div class="muted" style={{ marginBottom: '6px' }}><span class="spin" /> Reading {done} of {files.length}…</div><div class="meter"><span style={{ width: `${done / files.length * 100}%`, background: 'var(--c1)' }} /></div></div>
        ) : (
          <section class="card" style={{ overflow: 'hidden' }}>
            <div class="card-h" style={{ paddingBottom: '10px' }}><div><h2>Ordered by report date</h2><p>{good.length} to import · {rows.length - good.length} skipped</p></div></div>
            <div class="table-scroll" style={{ maxHeight: '60vh', overflow: 'auto' }}>
              <table class="mini">
                <thead><tr><th>Report date</th><th>File</th><th class="r">Spent (cumulative)</th><th>Status</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr style={{ opacity: r.status === 'ok' || r.status === 'replace' ? 1 : 0.55 }}>
                    <td class="num" style={{ whiteSpace: 'nowrap' }}>{r.date ? date(r.date) : '—'}</td>
                    <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.file.name}>{r.file.name}</td>
                    <td class="r num">{r.wb ? full(r.spent) : ''}</td>
                    <td><span class={`badge ${tone[r.status]}`}>{r.status === 'ok' ? 'new' : r.status}</span> <span class="muted" style={{ fontSize: '12px' }}>{r.note}</span></td>
                  </tr>))}</tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      <div class="drawer-f"><button class="btn" onClick={close}>Cancel</button><button class="btn primary" disabled={!good.length} onClick={apply}>Import {good.length} report{good.length === 1 ? '' : 's'}</button></div>
    </>
  );
}
