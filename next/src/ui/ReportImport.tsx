import { useEffect, useState } from 'preact/hooks';
import { upsertReport, upsertRisk, useStore } from '../data/store';
import { checkReport, compareReports, reportsByDate, reportTotals } from '../domain/calc';
import type { BudgetLine, Project, ReportingPeriod, Risk } from '../domain/types';
import { parseAmount, parseCSV, parseDay } from './csv';
import { date, full, short } from './format';
import { readXlsx, type Workbook } from './xlsx';
import { extractStaff } from '../domain/staff';
import { BulkReports } from './BulkReports';
import { parseWorkbook, summarize, toBudgetLines, type Workbook as CoeWorkbook } from '../domain/workbook';
import { updateProject } from '../data/store';
import { EXTRACTION, extractionLines } from '../domain/extraction';

/** A file chosen elsewhere (e.g. the global import) that the report drawer should open with. */
let pending: File | null = null;
export const setPendingReport = (f: File) => { pending = f; };

export async function readCoe(f: File): Promise<CoeWorkbook | null> {
  if (!/\.xlsx$/i.test(f.name)) return null;
  const x = await readXlsx(await f.arrayBuffer());
  const wb = parseWorkbook(x.sheets.map((n) => ({ name: n, R: x.read(n) })));
  return wb.lines.length ? wb : null;
}

/** Reads a CSV or Excel file into rows; returns sheet names for workbooks. */
export async function readTable(file: File): Promise<{ rows: string[][]; wb?: Workbook }> {
  if (/\.xlsx$/i.test(file.name)) { const wb = await readXlsx(await file.arrayBuffer()); return { rows: wb.read(), wb }; }
  if (/\.xls$/i.test(file.name)) throw new Error('Old .xls files are not supported. Save as .xlsx or CSV.');
  return { rows: parseCSV(await file.text()) };
}

const LF = [
  { key: 'code', label: 'Line code', req: true, alias: ['code', 'line', 'line code', 'budget line', 'no', 'no.', '#', 'kod'] },
  { key: 'description', label: 'Description', req: false, alias: ['description', 'item', 'heading', 'category', 'açıklama', 'name'] },
  { key: 'approved', label: 'Approved', req: true, alias: ['approved', 'approved budget', 'budget', 'onaylı', 'total budget'] },
  { key: 'actual', label: 'Spent (actual)', req: true, alias: ['actual', 'spent', 'expenditure', 'actuals', 'harcanan'] },
  { key: 'committed', label: 'Committed', req: false, alias: ['committed', 'commitments', 'taahhüt'] },
] as const;
type LK = (typeof LF)[number]['key'];

/** Finds the first row (within 15) that looks like a header: ≥2 known column names. */
export function detectHeader(rows: string[][]) {
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const h = rows[i].map((x) => x.trim().toLowerCase());
    const map: Partial<Record<LK, number>> = {};
    for (const f of LF) { const j = h.findIndex((x) => (f.alias as readonly string[]).includes(x)); if (j >= 0) map[f.key] = j; }
    if (Object.keys(map).length >= 2) return { at: i, map };
  }
  return { at: 0, map: {} as Partial<Record<LK, number>> };
}

const TYPES = ['Latest Approved Budget', 'Interim Financial Report', 'Quarterly Financial Report', 'Yearly / Annual Report', 'Final Report'];

export function ReportImport({ projectId, close }: { projectId: string; close: () => void }) {
  const p = useStore((s) => s.ledger.projects.find((x) => x.id === projectId)) as Project;
  const [file, setFile] = useState<{ name: string; rows: string[][]; wb?: Workbook } | null>(null);
  const [sheet, setSheet] = useState('');
  const [head, setHead] = useState(0);
  const [map, setMap] = useState<Partial<Record<LK, number>>>({});
  const [meta, setMeta] = useState({ name: '', type: TYPES[1], date: new Date().toISOString().slice(0, 10) });
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);
  const [coe, setCoe] = useState<CoeWorkbook | null>(null);
  const [manual, setManual] = useState(false);
  const [saveIds, setSaveIds] = useState(true);
  const [bulk, setBulk] = useState<File[] | null>(null);
  useEffect(() => { if (pending) { const f = pending; pending = null; open(f); } }, []);
  const pick = (F: File[]) => { F = F.filter((f) => /\.(xlsx|csv)$/i.test(f.name) && !f.name.startsWith('~$')); if (F.length > 1) setBulk(F); else if (F[0]) open(F[0]); };

  async function open(f: File) {
    setErr(''); setCoe(null); setManual(false);
    try {
      const wb = await readCoe(f).catch(() => null);
      if (wb) {
        setCoe(wb);
        const to = wb.meta.periodTo || wb.meta.asAt || wb.meta.situationDate;
        setMeta({ name: to ? `Interim report to ${date(to)}` : f.name.replace(/\.[^.]+$/, ''), type: 'Interim Financial Report', date: to || new Date().toISOString().slice(0, 10) });
      }
      const t = await readTable(f);
      const d = detectHeader(t.rows);
      setFile({ name: f.name, ...t }); setSheet(t.wb?.sheets[0] ?? ''); setHead(d.at); setMap(d.map);
      setMeta((m) => ({ ...m, name: m.name || f.name.replace(/\.[^.]+$/, '') }));
    } catch (e) { setErr((e as Error).message || 'Could not read this file'); }
  }
  function pickSheet(name: string) {
    if (!file?.wb) return;
    const rows = file.wb.read(name), d = detectHeader(rows);
    setFile({ ...file, rows }); setSheet(name); setHead(d.at); setMap(d.map);
  }

  const useCoe = !!coe && !manual;
  const body = file && !useCoe ? file.rows.slice(head + 1) : [];
  const rowErr: string[] = [];
  const ext = useCoe && !!coe!.meta.extraction;
  const lines: BudgetLine[] = useCoe ? (ext ? extractionLines(coe!, p) : toBudgetLines(coe!)) : [];
  body.forEach((r, i) => {
    const g = (k: LK) => (map[k] != null ? (r[map[k]!] ?? '').trim() : '');
    const code = g('code');
    if (!code || /^(total|sum|toplam)/i.test(code) || /^(total|sum|toplam)/i.test(g('description'))) return; // skip blank & total rows
    const num = (k: LK) => { const v = g(k); if (!v) return 0; const x = parseAmount(v); if (x == null) rowErr.push(`Row ${head + i + 2}: “${v}” in ${k} is not a number`); return x ?? 0; };
    const actual = num('actual'), committed = map.committed != null ? num('committed') : 0;
    lines.push({ code: code.replace(/\.$/, ''), description: g('description'), approved: num('approved'), actual, committed, spentCommitted: actual + committed });
  });
  const reportDate = parseDay(meta.date);
  // Staff contracts are read from every sheet of the workbook (Purchase Orders + GL).
  const staff = useCoe ? { records: coe!.staff, groups: coe!.staffGroups } : file?.wb ? extractStaff(file.wb.sheets.map((n) => ({ name: n, R: file.wb!.read(n) }))) : null;
  const report: ReportingPeriod = { id: 'r' + Date.now().toString(36), name: meta.name.trim() || 'Report', type: meta.type, date: reportDate ?? meta.date, fileName: file?.name, registeredAt: new Date().toISOString(),
    snapshot: { format: ext ? EXTRACTION : useCoe ? 'CoE workbook' : 'Imported', lines, ...(staff?.records.length ? { staffRecords: staff.records, staffGroups: staff.groups } : {}), ...(useCoe ? { workbook: summarize(coe!, file?.name) } : {}) } };
  const idWarn: string[] = [], idErr: string[] = [];
  if (useCoe) {
    if (p.bh && coe!.meta.bh && p.bh !== coe!.meta.bh) idErr.push(`This file is for budget head ${coe!.meta.bh}, but ${p.code} has budget head ${p.bh}`);
    if (p.contractNo && coe!.meta.contract && p.contractNo !== coe!.meta.contract) idErr.push(`Contract ${coe!.meta.contract} in the file differs from ${p.contractNo} on the project`);
    if (p.jp && coe!.meta.jp && p.jp !== coe!.meta.jp) idErr.push(`This file is for JP ${coe!.meta.jp}, but ${p.code} is JP ${p.jp}`);
    const eb = coe!.totals.eligible?.budget;
    if (p.approvedBudget && eb && Math.abs(eb - p.approvedBudget.total) > 1) idWarn.push(`Report budget ${Math.round(eb).toLocaleString('en-GB')} differs from the approved budget ${Math.round(p.approvedBudget.total).toLocaleString('en-GB')} (${p.approvedBudget.source}); the approved budget is kept`);
  }
  const fillIds = useCoe && ((!p.bh && coe!.meta.bh) || (!p.contractNo && coe!.meta.contract) || (!p.jp && coe!.meta.jp));
  const missing = useCoe ? [] : LF.filter((f) => f.req && map[f.key] == null).map((f) => f.label);
  const checks = file ? [...missing.map((m) => ({ level: 'error' as const, text: `Choose the column for “${m}”` })), ...rowErr.slice(0, 5).map((t) => ({ level: 'error' as const, text: t })), ...(missing.length ? [] : checkReport(p, report))] : [];
  if (file && !reportDate) checks.unshift({ level: 'error', text: 'Report date is invalid' });
  idWarn.forEach((t) => checks.unshift({ level: 'warning', text: t }));
  idErr.forEach((t) => checks.unshift({ level: 'error', text: `${t} — this report belongs to another project` }));
  const errors = checks.filter((c) => c.level === 'error');
  const prev = reportsByDate(p).filter((r) => r.date <= report.date).at(-1);
  const t = reportTotals(report);
  const delta = prev ? compareReports(prev, report) : [];

  if (bulk) return <BulkReports p={p} files={bulk} close={close} />;
  return (
    <>
      <div class="drawer-h"><div><div class="num muted" style={{ fontSize: '12px' }}>{p.code}</div><h2>Import financial report</h2></div><button class="btn icon ghost" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={close}>✕</button></div>
      <div class="drawer-b">
        <label class={`drop ${over ? 'on' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick([...(e.dataTransfer?.files ?? [])]); }}>
          <input type="file" hidden multiple accept=".xlsx,.csv,text/csv" onChange={(e) => pick([...((e.target as HTMLInputElement).files ?? [])])} />
          <strong style={{ color: 'var(--ink)' }}>{file ? file.name : 'Drop one or many report workbooks (.xlsx) — or a CSV budget report'}</strong><br />{file ? `${file.rows.length} rows read · click to choose another` : 'or click to choose a file'}
        </label>
        {err && <ul class="errlist"><li>{err}</li></ul>}
        {file && (
          <>
            <section class="card card-b" style={{ display: 'grid', gap: '12px' }}>
              <div class="form-2">
                <div class="field"><label for="r-name">Report name</label><input id="r-name" value={meta.name} onInput={(e) => setMeta({ ...meta, name: (e.target as HTMLInputElement).value })} /></div>
                <div class="field"><label for="r-date">Report date (period end)</label><input id="r-date" type="date" value={meta.date} onInput={(e) => setMeta({ ...meta, date: (e.target as HTMLInputElement).value })} /></div>
              </div>
              <div class="form-2">
                <div class="field"><label for="r-type">Type</label><select id="r-type" value={meta.type} onChange={(e) => setMeta({ ...meta, type: (e.target as HTMLSelectElement).value })}>{TYPES.map((x) => <option>{x}</option>)}</select></div>
                {file.wb && file.wb.sheets.length > 1
                  ? <div class="field"><label for="r-sheet">Sheet</label><select id="r-sheet" value={sheet} onChange={(e) => pickSheet((e.target as HTMLSelectElement).value)}>{file.wb.sheets.map((s) => <option>{s}</option>)}</select></div>
                  : <div class="field"><label for="r-head">Header row</label><input id="r-head" type="number" min={1} value={head + 1} onInput={(e) => setHead(Math.max(0, +(e.target as HTMLInputElement).value - 1))} /></div>}
              </div>
            </section>
            {useCoe && <CoeSummary wb={coe!} onManual={() => setManual(true)} fillIds={!!fillIds} saveIds={saveIds} setSaveIds={setSaveIds} />}
            {!useCoe && <section class="card card-b" style={{ display: 'grid', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '14px' }}>Match columns <span class="muted" style={{ fontWeight: 400 }}>· header: {(file.rows[head] ?? []).filter(Boolean).slice(0, 4).join(', ')}</span></h3>
              <div class="form-2" style={{ gap: '10px' }}>
                {LF.map((f) => (
                  <div class="field"><label>{f.label}{f.req && ' *'}</label>
                    <select value={map[f.key] ?? ''} aria-label={f.label} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; const m = { ...map }; if (v === '') delete m[f.key]; else m[f.key] = +v; setMap(m); }}>
                      <option value="">— not in file —</option>{(file.rows[head] ?? []).map((h, i) => <option value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select></div>
                ))}
              </div>
            </section>}
            <section class="card">
              <div class="card-h"><div><h2>Preview</h2><p>{lines.length} lines{staff?.records.length ? ` · ${staff.records.filter((r) => r.name).length} staff records${staff.records.some((r) => r.review) ? ` (${staff.records.filter((r) => r.review).length} to review)` : ''}` : ''} · approved {short(t.approved)} · spent {short(t.actual)}{prev ? ` (${t.actual >= reportTotals(prev).actual ? '+' : '−'}${short(Math.abs(t.actual - reportTotals(prev).actual))} since ${prev.name})` : ''}</p></div></div>
              {checks.length > 0 && <ul class="att" style={{ marginTop: '10px' }}>{checks.slice(0, 12).map((c) => <li style={{ cursor: 'default' }}><span class={`badge ${c.level === 'error' ? 'critical' : 'warning'}`}>{c.level}</span><div class="d" style={{ color: 'var(--ink)' }}>{c.text}</div><span /></li>)}</ul>}
              <div class="card-b" style={{ paddingTop: '4px' }}>
                <table class="mini">
                  <thead><tr><th>Line</th><th>Description</th><th class="r">Approved</th><th class="r">Spent</th><th class="r">Change</th></tr></thead>
                  <tbody>{lines.slice(0, 60).map((l) => { const d = delta.find((x) => x.code === l.code); const ch = d ? d.actual[1] - d.actual[0] : null; return (
                    <tr><td class="num">{l.code}</td><td>{l.description}</td><td class="r num">{full(l.approved ?? 0)}</td><td class="r num">{full(l.actual ?? 0)}</td>
                      <td class="r num" style={{ color: ch != null && ch < 0 ? 'var(--critical)' : 'var(--ink-3)' }}>{ch == null ? (prev ? 'new' : '') : `${ch >= 0 ? '+' : '−'}${short(Math.abs(ch))}`}</td></tr>); })}</tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
      <div class="drawer-f">
        <button class="btn" onClick={close}>Cancel</button>
        <button class="btn primary" disabled={!file || errors.length > 0} onClick={() => {
          upsertReport(p.id, report);
          // An approved budget baseline (DoA annex) stays authoritative; reports only set the budget when there is none.
          const eb = useCoe && !p.approvedBudget ? coe!.totals.eligible?.budget : undefined;
          if ((fillIds && saveIds) || (eb && Math.abs(eb - p.budget) > 1))
            updateProject(p.id, { ...(fillIds && saveIds ? { bh: p.bh || coe!.meta.bh, contractNo: p.contractNo || coe!.meta.contract, jp: p.jp || coe!.meta.jp } : {}), ...(eb ? { budget: Math.round(eb * 100) / 100 } : {}) });
          close();
        }}>
          {file && errors.length ? `${errors.length} problem${errors.length > 1 ? 's' : ''} to fix` : `Save report${reportDate ? ` · ${date(reportDate)}` : ''}`}
        </button>
      </div>
    </>
  );
}

export function RiskForm({ projectId, id, close }: { projectId: string; id?: string; close: () => void }) {
  const p = useStore((s) => s.ledger.projects.find((x) => x.id === projectId));
  const existing = p?.riskRegister?.find((r) => r.id === id);
  const [r, setR] = useState<Risk>(existing ?? { id: 'k' + Date.now().toString(36), title: '', category: 'Operational', likelihood: '3', impact: '3', mitigation: '', status: 'Open', owner: '' });
  const [touched, setTouched] = useState(false);
  const bad = !r.title.trim();
  const fld = (k: keyof Risk, label: string, opts?: string[]) => (
    <div class="field" data-invalid={touched && k === 'title' && bad ? '' : undefined}><label for={`k-${k}`}>{label}</label>
      {opts ? <select id={`k-${k}`} value={String(r[k] ?? '')} onChange={(e) => setR({ ...r, [k]: (e.target as HTMLSelectElement).value })}>{opts.map((o) => <option>{o}</option>)}</select>
        : <input id={`k-${k}`} value={String(r[k] ?? '')} onInput={(e) => setR({ ...r, [k]: (e.target as HTMLInputElement).value })} />}
      {touched && k === 'title' && bad && <span class="err">Required</span>}
    </div>
  );
  if (!p) return null;
  return (
    <>
      <div class="drawer-h"><h2>{existing ? 'Edit risk' : 'Add risk'}</h2><button class="btn icon ghost" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={close}>✕</button></div>
      <div class="drawer-b">
        {fld('title', 'Risk')}
        <div class="form-2">{fld('category', 'Category', ['Operational', 'Financial', 'Political', 'Security', 'Reputational', 'Other'])}{fld('owner', 'Owner')}</div>
        <div class="form-2">{fld('likelihood', 'Likelihood (1–5)', ['1', '2', '3', '4', '5'])}{fld('impact', 'Impact (1–5)', ['1', '2', '3', '4', '5'])}</div>
        <div class="field"><label for="k-mit">Mitigation</label><textarea id="k-mit" rows={4} style={{ height: 'auto', padding: '8px 12px' }} value={r.mitigation} onInput={(e) => setR({ ...r, mitigation: (e.target as HTMLTextAreaElement).value })} /></div>
        {fld('status', 'Status', ['Open', 'Resolved'])}
        <p class="muted" style={{ margin: 0, fontSize: '13px' }}>Score {Number(r.likelihood) * Number(r.impact)} — 12 or more is flagged on the overview.</p>
      </div>
      <div class="drawer-f"><button class="btn" onClick={close}>Cancel</button>
        <button class="btn primary" onClick={() => { setTouched(true); if (bad) return; upsertRisk(p.id, { ...r, title: r.title.trim() }); close(); }}>{existing ? 'Save' : 'Add risk'}</button></div>
    </>
  );
}

function CoeSummary({ wb, onManual, fillIds, saveIds, setSaveIds }: { wb: CoeWorkbook; onManual: () => void; fillIds: boolean; saveIds: boolean; setSaveIds: (v: boolean) => void }) {
  const m = wb.meta, e = wb.totals.eligible;
  const openPO = wb.pos.filter((x) => /open/i.test(x.status) && x.balance > 0.5);
  return (
    <section class="card card-b" style={{ display: 'grid', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span class="badge good">Recognised</span><b style={{ fontSize: '14px' }}>Council of Europe financial report workbook</b>
        <button class="btn ghost" style={{ marginLeft: 'auto', height: '26px' }} onClick={onManual}>Map columns manually</button></div>
      {m.title && <div style={{ fontSize: '13.5px' }}>{m.title}</div>}
      <dl class="dl" style={{ gridTemplateColumns: '130px 1fr', fontSize: '13px' }}>
        {m.contract && <><dt>Contract</dt><dd class="num">{m.contract}</dd></>}
        {(m.jp || m.bh) && <><dt>JP / BH</dt><dd class="num">{m.jp ?? '—'} / {m.bh ?? '—'}</dd></>}
        {m.periodFrom && <><dt>Report period</dt><dd>{date(m.periodFrom)} → {date(m.periodTo!)}</dd></>}
        {m.asAt && <><dt>Actuals as at</dt><dd>{date(m.asAt)}</dd></>}
        {m.plannedFrom && <><dt>Forecast period</dt><dd>{date(m.plannedFrom)} → {date(m.plannedTo!)}</dd></>}
        {e && <><dt>Total eligible</dt><dd class="num">budget {full(e.budget)} · actual {full(e.actual)} · S&C {full(e.sc)}{e.planned != null ? ` · next 12 m ${full(e.planned)}` : ''}</dd></>}
        <dt>Also read</dt><dd>{[wb.situation.length && 'budget situation', wb.pos.length && `${wb.pos.length} POs (${openPO.length} open)`, wb.monthly.length && `${wb.monthly.length} months of postings`, wb.movements.length && `${wb.movements.filter((x) => x.funding).length} funding movements`, wb.staff.length && `${wb.staff.filter((x) => x.name).length} staff records`].filter(Boolean).join(' · ')}</dd>
        <dt>Sheets</dt><dd class="muted" style={{ fontSize: '12px' }}>{wb.sheets.join(', ')}</dd>
      </dl>
      {fillIds && <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}><input type="checkbox" checked={saveIds} onChange={() => setSaveIds(!saveIds)} />Save contract / JP / BH from this file to the project</label>}
      <ul class="att" style={{ margin: '0 -20px' }}>
        {wb.checks.map((c) => <li style={{ cursor: 'default' }}><span class={`badge ${c.level === 'error' ? 'critical' : c.level === 'warning' ? 'warning' : 'good'}`}>{c.level === 'info' ? 'ok' : c.level}</span><div class="d" style={{ color: 'var(--ink)', whiteSpace: 'normal' }}>{c.text}</div><span /></li>)}
      </ul>
    </section>
  );
}
