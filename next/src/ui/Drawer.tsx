import { PortfolioImport } from './PortfolioImport';
import { COUNTRY_LIST, countryInfo } from '../domain/countries';
import { backupNow } from './Backup';
import { AlertPanel } from './AlertPanel';
import { PeriodPanel } from './PeriodPanel';
import { useEffect, useState } from 'preact/hooks';
import { deleteCountry, deleteProjects, get, go, replaceLedger, resetDemo, restorePoints, set, upsertCountry, upsertProject, useStore } from '../data/store';
import type { Country } from '../domain/types';
import { burnGap, elapsed, lines, money, parseDate, riskScore, spendPoints, validateLedger } from '../domain/calc';
import { normalizeSector, SECTORS, validUrl, type Ledger, type Project } from '../domain/types';
import { TODAY } from '../today';
import { base, Chart } from './Chart';
import { parseAmount, parseCSV, parseDay } from './csv';
import { full, month, pct, period, short, signedPct } from './format';
import { readCoe, readTable, ReportImport, RiskForm } from './ReportImport';
import { migrateBackup } from '../domain/insights';
import { ContractPanel } from './ContractPanel';
import { AppearancePanel } from './Appearance';
import { DocumentsPanel } from './DocumentsPanel';

export function Drawer() {
  const d = useStore((s) => s.drawer);
  useEffect(() => {
    if (!d) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !get().palette) set({ drawer: null }); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [d]);
  if (!d) return null;
  const close = () => set({ drawer: null });
  return (
    <>
      <div class="scrim" onClick={close} />
      <div class="drawer" role="dialog" aria-modal="true">
        {d.kind === 'project' && <ProjectView id={d.id} close={close} />}
        {d.kind === 'new-project' && <ProjectForm close={close} preset={d.country} prefill={d.prefill} thenReport={d.thenReport} />}
        {d.kind === 'report' && <ReportImport projectId={d.projectId} close={close} />}
        {d.kind === 'documents' && <DocumentsPanel projectId={d.projectId} close={close} />}
        {d.kind === 'appearance' && <AppearancePanel close={close} />}
        {d.kind === 'contract' && <ContractPanel projectId={d.projectId} k={d.key} close={close} />}
        {d.kind === 'risk' && <RiskForm projectId={d.projectId} id={d.id} close={close} />}
        {d.kind === 'countries' && <CountryPanel close={close} edit={d.edit} />}
        {d.kind === 'import' && <ImportPanel close={close} />}
        {d.kind === 'portfolio-import' && <PortfolioImport files={d.files} close={close} />}
        {d.kind === 'alert' && <AlertPanel projectId={d.projectId} kind={d.alertKind} ids={d.ids} close={close} />}
        {d.kind === 'period' && <PeriodPanel t={d.t} from={d.from} ids={d.ids} close={close} />}
      </div>
    </>
  );
}

const X = ({ close }: { close: () => void }) => <button class="btn icon ghost" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={close}>✕</button>;

function ProjectView({ id, close }: { id: string; close: () => void }) {
  const p = useStore((s) => s.ledger.projects.find((x) => x.id === id));
  const countries = useStore((s) => s.ledger.countries);
  const [edit, setEdit] = useState(false);
  if (!p) return <div class="drawer-b">Project not found.</div>;
  if (edit) return <ProjectForm close={() => setEdit(false)} project={p} />;
  const m = money(p), el = elapsed(p, TODAY), gap = burnGap(p, TODAY);
  const pts = spendPoints(p);
  const L = lines(p);
  const risks = (p.riskRegister ?? []).filter((r) => (r.status ?? 'Open') === 'Open').sort((a, b) => riskScore(b) - riskScore(a)).slice(0, 5);
  const s = parseDate(p.start).getTime(), e = parseDate(p.end).getTime();
  return (
    <>
      <div class="drawer-h">
        <div><div class="num muted" style={{ fontSize: '12px' }}>{p.code}</div><h2>{p.name}</h2></div>
        <X close={close} />
      </div>
      <div class="drawer-b">
        <div class="hero" style={{ gridTemplateColumns: 'repeat(3,1fr)', margin: 0 }}>
          <div class="kpi"><span class="label">Spent</span><span class="value" style={{ fontSize: '22px' }}>{short(m.spent)}</span><span class="ctx">of {short(m.budget)}</span></div>
          <div class="kpi"><span class="label">Burn vs time</span><span class="value" style={{ fontSize: '22px' }}>{signedPct(gap)}</span><span class="ctx">{pct(el)} of time used</span></div>
          <div class="kpi"><span class="label">Remaining</span><span class="value" style={{ fontSize: '22px', color: m.remaining < 0 ? 'var(--critical)' : undefined }}>{short(m.remaining)}</span><span class="ctx">after commitments</span></div>
        </div>
        <section class="card">
          <div class="card-h"><div><h2>Cumulative spend vs linear plan</h2><p>Reported actuals at each financial report</p></div></div>
          <Chart height={200} label={`Spend chart for ${p.code}`} option={(t) => ({
            ...base(t),
            grid: { left: 8, right: 16, top: 16, bottom: 4, containLabel: true },
            tooltip: { ...(base(t).tooltip as object), trigger: 'axis', valueFormatter: (v: number) => full(v) },
            xAxis: { type: 'time', min: s, max: e, axisLine: { lineStyle: { color: t.line } }, axisLabel: { color: t.ink3, formatter: (v: number) => month(v) }, splitLine: { show: false } },
            yAxis: { type: 'value', axisLabel: { color: t.ink3, formatter: short, fontFamily: t.mono }, splitLine: { lineStyle: { color: t.line } } },
            series: [
              { name: 'Plan', type: 'line', data: [[s, 0], [e, m.budget]], symbol: 'none', lineStyle: { color: t.plan, type: 'dashed', width: 1.5 } },
              { name: 'Actual', type: 'line', data: pts.map((x) => [x.t, x.v]), symbolSize: 8, lineStyle: { width: 2, color: t.c[0] }, itemStyle: { color: t.c[0], borderColor: t.surface, borderWidth: 2 }, areaStyle: { color: t.c[0], opacity: 0.08 } },
            ],
          })} />
        </section>
        {L.length > 0 && (
          <section class="card">
            <div class="card-h"><div><h2>Budget lines</h2><p>Latest report: spent + committed against approved</p></div></div>
            <div class="card-b" style={{ display: 'grid', gap: '10px' }}>
              {L.map((l) => {
                const ex = l.spentCommitted ?? (l.actual ?? 0) + (l.committed ?? 0), ap = l.approved ?? 0, r = ap ? ex / ap : 0;
                return (
                  <div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '13px' }}><span class="num muted">{l.code}</span><span>{l.description}</span><span class="num" style={{ marginLeft: 'auto' }}>{short(ex)} / {short(ap)}</span></div>
                    <div class="minibar" style={{ marginTop: '6px' }}><span style={{ width: `${Math.min(100, r * 100)}%`, background: r > 1.1 ? 'var(--critical)' : r > 1 ? 'var(--serious)' : 'var(--c1)' }} /><i style={{ left: `${Math.min(100, el * 100)}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <dl class="dl">
          <dt>Country</dt><dd>{countries.find((c) => c.id === p.country)?.name ?? p.country}</dd>
          <dt>Sector</dt><dd>{p.sector || '—'}</dd>
          <dt>Funding</dt><dd>{p.funding || '—'}</dd>
          <dt>Period</dt><dd>{period(p)}</dd>
          <dt>Budget</dt><dd class="num">{full(m.budget)}</dd>
          <dt>Committed</dt><dd class="num">{full(m.committed)}</dd>
          <dt>Status</dt><dd>{p.status || 'Active'}</dd>
          {p.pmm && <><dt>PMM</dt><dd class="num">{p.pmm}</dd></>}
          {p.bh && <><dt>Budget head</dt><dd class="num">{p.bh}</dd></>}
          {p.mae && <><dt>MAE</dt><dd>{p.mae}</dd></>}
          {validUrl(p.pmmUrl) && <><dt>PMM link</dt><dd><a href={validUrl(p.pmmUrl)!} target="_blank" rel="noopener noreferrer">Open in PMM ↗</a></dd></>}
        </dl>
        {risks.length > 0 && (
          <section class="card"><div class="card-h"><h2>Open risks</h2></div>
            <ul class="att" style={{ marginTop: '8px' }}>{risks.map((r) => (
              <li style={{ cursor: 'default' }}><span class={`badge ${riskScore(r) >= 16 ? 'critical' : riskScore(r) >= 12 ? 'serious' : riskScore(r) >= 6 ? 'warning' : 'neutral'}`}>{riskScore(r)}</span><div><div class="t">{r.title}</div><div class="d">{r.mitigation}</div></div><span /></li>
            ))}</ul>
          </section>
        )}
      </div>
      <div class="drawer-f">
        <button class="btn danger" onClick={() => { if (confirm(`Delete ${p.code}? You can undo right after.`)) { deleteProjects([p.id]); close(); } }}>Delete</button>
        <span style={{ flex: 1 }} />
        <button class="btn" onClick={() => setEdit(true)}>Edit</button>
        <button class="btn primary" onClick={() => { close(); go(`project/${p.id}`); }}>Open project page →</button>
      </div>
    </>
  );
}

type Draft = Record<'code' | 'name' | 'country' | 'sector' | 'funding' | 'start' | 'end' | 'budget' | 'status' | 'mae' | 'pmm' | 'bh' | 'ccm' | 'pmmUrl', string>;

export function checkDraft(d: Draft, projects: Project[], selfId?: string): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {};
  if (!d.code.trim()) e.code = 'Required';
  else if (projects.some((p) => p.code.toLowerCase() === d.code.trim().toLowerCase() && p.id !== selfId)) e.code = 'Code already used';
  if (!d.name.trim()) e.name = 'Required';
  if (!d.country) e.country = 'Required';
  if (!(SECTORS as readonly string[]).includes(d.sector)) e.sector = `Choose ${SECTORS.join(', ')}`;
  const b = parseAmount(d.budget);
  if (b == null || b <= 0) e.budget = 'Enter a positive amount';
  const s = parseDay(d.start), en = parseDay(d.end);
  if (!s) e.start = 'Use YYYY-MM-DD';
  if (!en) e.end = 'Use YYYY-MM-DD';
  else if (s && en <= s) e.end = 'Must be after start';
  if (d.pmm && !/^\d+$/.test(d.pmm.trim())) e.pmm = 'Digits only';
  if (d.bh && !/^\d+$/.test(d.bh.trim())) e.bh = 'Digits only';
  if (d.pmmUrl && !validUrl(d.pmmUrl)) e.pmmUrl = 'Full http(s) link, no login in the link';
  return e;
}

export function ProjectForm({ close, project: editing, preset, prefill, thenReport }: { close: () => void; project?: Project; preset?: string; prefill?: Partial<Project>; thenReport?: boolean }) {
  const project = editing ?? (prefill as Project | undefined);
  const { countries, projects } = useStore((s) => s.ledger);
  const [d, setD] = useState<Draft>({
    code: project?.code ?? '', name: project?.name ?? '', country: project?.country ?? preset ?? countries[0]?.id ?? '',
    sector: normalizeSector(project?.sector) ?? '', funding: project?.funding ?? '', start: project?.start ?? '', end: project?.end ?? '',
    budget: project ? String(project.budget) : '', status: project?.status ?? 'Active',
    mae: project?.mae ?? '', pmm: project?.pmm ?? '', bh: project?.bh ?? '', ccm: project?.ccm ?? '', pmmUrl: project?.pmmUrl ?? '',
  });
  const [touched, setTouched] = useState(false);
  const errs = checkDraft(d, projects, editing?.id);
  const ok = !Object.keys(errs).length;
  const f = (k: keyof Draft, label: string, props: Record<string, unknown> = {}) => (
    <div class="field" data-invalid={touched && errs[k] ? '' : undefined}>
      <label for={`f-${k}`}>{label}</label>
      <input id={`f-${k}`} value={d[k]} onInput={(e) => setD({ ...d, [k]: (e.target as HTMLInputElement).value })} {...props} />
      {touched && errs[k] && <span class="err">{errs[k]}</span>}
    </div>
  );
  const save = () => {
    setTouched(true); if (!ok) return;
    const id = editing?.id ?? 'p' + Date.now().toString(36);
    upsertProject({
      ...(editing ?? { reportingPeriods: [], riskRegister: [], contractNo: prefill?.contractNo, jp: prefill?.jp }), id,
      code: d.code.trim(), name: d.name.trim(), country: d.country, sector: d.sector.trim(), funding: d.funding.trim(),
      start: parseDay(d.start)!, end: parseDay(d.end)!, budget: parseAmount(d.budget)!, status: d.status,
      mae: d.mae.trim() || undefined, pmm: d.pmm.trim() || undefined, bh: d.bh.trim() || undefined, ccm: d.ccm.trim() || undefined, pmmUrl: validUrl(d.pmmUrl) ?? undefined,
      // placeholder dates stay flagged until someone actually changes them
      datesTbc: editing?.datesTbc && parseDay(d.start) === editing.start && parseDay(d.end) === editing.end ? true : undefined,
    } as Project);
    if (thenReport) set({ drawer: { kind: 'report', projectId: id } }); else close();
  };
  return (
    <>
      <div class="drawer-h"><h2>{editing ? `Edit ${editing.code}` : 'New project'}</h2><X close={close} /></div>
      <form class="drawer-b" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div class="form-2">{f('code', 'Code', { placeholder: 'TR-ABC', autoFocus: true })}{f('budget', 'Budget (€)', { inputMode: 'decimal', placeholder: '2 500 000' })}</div>
        {f('name', 'Name')}
        <div class="form-2">
          <div class="field"><label for="f-country">Country</label>
            <select id="f-country" value={d.country} onChange={(e) => setD({ ...d, country: (e.target as HTMLSelectElement).value })}>{countries.map((c) => <option value={c.id}>{c.name}</option>)}</select>
          </div>
          <div class="field" data-invalid={touched && errs.sector ? '' : undefined}><label for="f-sector">Sector</label>
            <select id="f-sector" value={d.sector} onChange={(e) => setD({ ...d, sector: (e.target as HTMLSelectElement).value })}>
              <option value="">Choose…</option>{SECTORS.map((o) => <option>{o}</option>)}
            </select>{touched && errs.sector && <span class="err">Required</span>}
          </div>
        </div>
        <div class="form-2">{f('start', 'Start', { type: 'date' })}{f('end', 'End', { type: 'date' })}</div>
        <div class="form-2">{f('funding', 'Funding')}
          <div class="field"><label for="f-status">Status</label>
            <select id="f-status" value={d.status} onChange={(e) => setD({ ...d, status: (e.target as HTMLSelectElement).value })}>{['Active', 'Pipeline', 'Closed'].map((o) => <option>{o}</option>)}</select>
          </div>
        </div>
        <h3 style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--ink-2)' }}>Identifiers</h3>
        <div class="form-2">{f('pmm', 'PMM number', { inputMode: 'numeric' })}{f('bh', 'Budget head (BH)', { inputMode: 'numeric' })}{f('ccm', 'CCM', { inputMode: 'numeric', placeholder: 'e.g. 00901' })}</div>
        <div class="form-2">{f('mae', 'MAE / division')}{f('pmmUrl', 'PMM link', { type: 'url', placeholder: 'https://…' })}</div>
        <button type="submit" hidden />
      </form>
      <div class="drawer-f"><button class="btn" onClick={close}>Cancel</button><button class="btn primary" onClick={save}>{editing ? 'Save changes' : thenReport ? 'Add project and import report' : 'Add project'}</button></div>
    </>
  );
}

const FIELDS = [
  { key: 'code', label: 'Code', req: true, alias: ['code', 'project code', 'id', 'kod'] },
  { key: 'name', label: 'Name', req: true, alias: ['name', 'project', 'title', 'project name', 'ad'] },
  { key: 'country', label: 'Country', req: true, alias: ['country', 'ülke', 'ulke'] },
  { key: 'budget', label: 'Budget', req: true, alias: ['budget', 'total', 'bütçe', 'butce', 'amount'] },
  { key: 'start', label: 'Start', req: true, alias: ['start', 'start date', 'başlangıç', 'from'] },
  { key: 'end', label: 'End', req: true, alias: ['end', 'end date', 'bitiş', 'to'] },
  { key: 'sector', label: 'Sector', req: true, alias: ['sector', 'sektör', 'theme'] },
  { key: 'funding', label: 'Funding', req: false, alias: ['funding', 'donor', 'source'] },
  { key: 'pmm', label: 'PMM number', req: false, alias: ['pmm', 'pmm no', 'pmm number', 'pmm id', 'pmm no.'] },
  { key: 'bh', label: 'Budget head', req: false, alias: ['bh', 'budget head', 'budgethead'] },
  { key: 'ccm', label: 'CCM', req: false, alias: ['ccm', 'cost centre', 'cost center'] },
  { key: 'mae', label: 'MAE / division', req: false, alias: ['mae', 'division', 'directorate'] },
  { key: 'pmmUrl', label: 'PMM link', req: false, alias: ['pmm link', 'pmm url', 'link', 'url', 'pmmurl'] },
] as const;

function ImportPanel({ close }: { close: () => void }) {
  const ledger = useStore((s) => s.ledger);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [json, setJson] = useState<{ data: Ledger; errs: string[]; from: string } | null>(null);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const ELSEWHERE = 'Financial reports and project documents are added inside their project (open the project → Import report / Add documents), so they can never land on the wrong project.';
  async function readMany(files: File[]) {
    if (files.some((f) => /\.(pdf|docx)$/i.test(f.name))) { setErr(ELSEWHERE); return; }
    if (files.length > 1 && files.every((f) => /\.xls[xm]$/i.test(f.name))) { set({ drawer: { kind: 'portfolio-import', files } }); return; }
    if (files.length > 1) { setErr('Drop one project list or backup file at a time.'); return; }
    return read(files[0]);
  }

  async function read(file: File) {
    setErr(''); setRows(null); setJson(null);
    setBusy(`Reading ${file.name}…`);
    const wb = await readCoe(file).catch(() => null);
    setBusy('');
    if (wb) { setErr(`${file.name} is a financial report${wb.meta.title ? ` for “${wb.meta.title}”` : ''}. ${ELSEWHERE}`); return; }
    const text = await file.text();
    if (/\.json$/i.test(file.name) || text.trim().startsWith('{')) {
      try { const { ledger: data, from } = migrateBackup(JSON.parse(text)); setJson({ data: data as Ledger, errs: validateLedger(data), from }); } catch { setErr('This file is not valid JSON.'); }
      return;
    }
    let R: string[][];
    try { R = /\.xlsx?$/i.test(file.name) ? (await readTable(file)).rows : parseCSV(text); } catch (e) { setErr((e as Error).message); return; }
    if (R.length < 2) { setErr('The CSV needs a header row and at least one data row.'); return; }
    const head = R[0].map((h) => h.trim().toLowerCase());
    const m: Record<string, number> = {};
    for (const f of FIELDS) { const i = head.findIndex((h) => (f.alias as readonly string[]).includes(h)); if (i >= 0) m[f.key] = i; }
    setMap(m); setRows(R);
  }

  const countryId = (v: string) => {
    const t = v.trim().toLowerCase();
    return ledger.countries.find((c) => c.id === t || c.name.toLowerCase() === t || c.iso3?.toLowerCase() === t)?.id;
  };
  const parsed = rows?.slice(1).map((r, i) => {
    const g = (k: string) => (map[k] != null ? (r[map[k]] ?? '').trim() : '');
    const existing = ledger.projects.find((p) => p.code.toLowerCase() === g('code').toLowerCase());
    // Columns missing from the file keep the existing project's values.
    const keep = (k: string, v: string) => (map[k] == null && existing ? String((existing as unknown as Record<string, unknown>)[k] ?? '') : v);
    const d: Draft = {
      code: g('code'), name: keep('name', g('name')), country: keep('country', countryId(g('country')) ?? ''), sector: keep('sector', normalizeSector(g('sector')) ?? ''),
      funding: keep('funding', g('funding')), start: keep('start', parseDay(g('start')) ?? g('start')), end: keep('end', parseDay(g('end')) ?? g('end')),
      budget: keep('budget', g('budget')), status: existing?.status ?? 'Active',
      mae: keep('mae', g('mae')), pmm: keep('pmm', g('pmm')), bh: keep('bh', g('bh')), ccm: keep('ccm', g('ccm')), pmmUrl: keep('pmmUrl', g('pmmUrl')),
    };
    const e = checkDraft(d, ledger.projects, existing?.id);
    if (g('country') && !d.country) e.country = `Unknown country “${g('country')}” (add it under Manage countries)`;
    if (g('sector') && !d.sector) e.sector = `Unknown sector “${g('sector')}”`;
    return { line: i + 2, d, e, existing };
  }) ?? [];
  const good = parsed.filter((x) => !Object.keys(x.e).length);
  const dupInFile = new Set<string>();
  const importable = good.filter((x) => { const k = x.d.code.toLowerCase(); if (dupInFile.has(k)) return false; dupInFile.add(k); return true; });

  const exportJSON = () => {
    void backupNow();
  };

  return (
    <>
      <div class="drawer-h"><h2>Import & backup</h2><X close={close} /></div>
      <div class="drawer-b">
        <label class={`drop ${over ? 'on' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const F = [...(e.dataTransfer?.files ?? [])]; if (F.length) readMany(F); }}>
          <input type="file" multiple accept=".csv,.xlsx,.json,text/csv,application/json" hidden onChange={(e) => { const F = [...((e.target as HTMLInputElement).files ?? [])]; if (F.length) readMany(F); }} />
          <strong style={{ color: 'var(--ink)' }}>Drop a project list (Excel / CSV) or a JSON backup</strong><br />Financial reports and project documents are added inside each project.
        </label>
        {err && <ul class="errlist"><li>{err}</li></ul>}

        {busy && <div class="muted" role="status" style={{ fontSize: '13px' }}><span class="spin" /> {busy}</div>}
        {json && (
          <section class="card card-b">
            <h3 style={{ margin: '0 0 8px', fontSize: '14px' }}>{json.from === 'previous app' ? 'Backup from the previous Portfolio Ledger' : 'Backup file'}</h3>
            <p class="muted" style={{ margin: 0 }}>{json.data.projects?.length ?? 0} projects · {json.data.countries?.length ?? 0} countries. {json.data.audit?.length ? ` · ${json.data.audit.length} history entries` : ''}. Importing replaces the current data (you can undo).</p>
            {json.errs.length > 0 && <ul class="errlist" style={{ marginTop: '12px' }}>{json.errs.slice(0, 8).map((e) => <li>{e}</li>)}</ul>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button class="btn primary" disabled={json.errs.length > 0} onClick={() => { replaceLedger(json.data, `Imported ${json.data.projects.length} projects`); close(); }}>Replace data</button>
            </div>
          </section>
        )}

        {rows && (
          <>
            <section class="card card-b" style={{ display: 'grid', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '14px' }}>Match columns</h3>
              <div class="form-2" style={{ gap: '10px' }}>
                {FIELDS.map((f) => (
                  <div class="field"><label>{f.label}{f.req && ' *'}</label>
                    <select value={map[f.key] ?? ''} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; const m = { ...map }; if (v === '') delete m[f.key]; else m[f.key] = +v; setMap(m); }}>
                      <option value="">— not in file —</option>
                      {rows[0].map((h, i) => <option value={i}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </section>
            <section class="card">
              <div class="card-h"><div><h2>Preview</h2><p>{importable.filter((x) => !x.existing).length} new · {importable.filter((x) => x.existing).length} updates · {parsed.length - importable.length} with problems</p></div></div>
              <ul class="att" style={{ marginTop: '8px', maxHeight: '280px', overflow: 'auto' }}>
                {parsed.slice(0, 200).map((x) => {
                  const bad = Object.entries(x.e);
                  return (
                    <li style={{ cursor: 'default' }}>
                      <span class={`badge ${bad.length ? 'critical' : 'good'}`}>Row {x.line}</span>
                      <div><div class="t">{x.d.code || '—'} · {x.d.name || '—'} {x.existing && !bad.length && <span class="badge neutral count">update</span>}</div>
                        <div class="d">{bad.length ? bad.map(([k, v]) => `${k}: ${v}`).join(' · ') : `${short(parseAmount(x.d.budget) ?? 0)} · ${x.d.start} → ${x.d.end}`}</div></div><span />
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}

        <section class="card card-b" style={{ display: 'grid', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>Backup</h3>
          <p class="muted" style={{ margin: 0, fontSize: '13px' }}>Data is stored in this browser. Export a backup before clearing browser data or moving computers.</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button class="btn" onClick={exportJSON}>Export JSON backup</button>
            <button class="btn ghost" onClick={() => { if (confirm('Replace ALL current data with the start data? Export a backup first — this removes your reports and documents (undo is possible right after).')) { resetDemo(); close(); } }}>Reset to start data</button>
          </div>
        </section>
        <RestorePoints close={close} />
      </div>
      {rows && (
        <div class="drawer-f">
          <button class="btn" onClick={() => setRows(null)}>Cancel</button>
          <button class="btn primary" disabled={!importable.length} onClick={() => {
            const L: Ledger = JSON.parse(JSON.stringify(ledger));
            importable.forEach((x, i) => {
              const fields = { code: x.d.code, name: x.d.name, country: x.d.country, sector: x.d.sector, funding: x.d.funding, start: parseDay(x.d.start)!, end: parseDay(x.d.end)!, budget: parseAmount(x.d.budget)!,
                mae: x.d.mae.trim() || undefined, pmm: x.d.pmm.trim() || undefined, bh: x.d.bh.trim() || undefined, ccm: x.d.ccm?.trim() || undefined, pmmUrl: validUrl(x.d.pmmUrl) ?? undefined };
              const at = L.projects.findIndex((p) => p.id === x.existing?.id);
              if (at >= 0) L.projects[at] = { ...L.projects[at], ...fields };
              else L.projects.push({ id: `p${Date.now().toString(36)}${i}`, ...fields, status: 'Active', reportingPeriods: [], riskRegister: [] });
            });
            replaceLedger(L, `Imported ${importable.length} project${importable.length > 1 ? 's' : ''}`); close();
          }}>Import {importable.length} row{importable.length === 1 ? '' : 's'}</button>
        </div>
      )}
    </>
  );
}

export function checkCountry(c: Country, all: Country[], selfId?: string) {
  const e: Partial<Record<'name' | 'iso3', string>> = {};
  if (!c.name.trim()) e.name = 'Required';
  else if (all.some((x) => x.name.toLowerCase() === c.name.trim().toLowerCase() && x.id !== selfId)) e.name = 'Already exists';
  if (c.iso3 && !/^[A-Za-z]{3}$/.test(c.iso3)) e.iso3 = 'Three letters, e.g. TUR';
  return e;
}

function CountryPanel({ close, edit: initial }: { close: () => void; edit?: string }) {
  const { countries, projects } = useStore((s) => s.ledger);
  const [edit, setEdit] = useState<string | null>(initial ?? null);
  const [d, setD] = useState<Country>({ id: '', name: '', region: '', iso3: '', ccm: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const c = countries.find((x) => x.id === edit);
    setD(c ? { region: '', iso3: '', ccm: '', ...c } : { id: '', name: '', region: '', iso3: '', ccm: '' }); setErr({});
  }, [edit]);
  const regions = [...new Set([...countries.map((c) => c.region), ...COUNTRY_LIST.map((c) => c.region)].filter(Boolean))] as string[];
  const save = () => {
    const e = checkCountry(d, countries, edit !== 'new' ? edit ?? undefined : undefined);
    setErr(e as Record<string, string>); if (Object.keys(e).length) return;
    let id = d.id;
    if (!id) { const b = (d.iso3 || d.name).toLowerCase().replace(/[^a-z]/g, '').slice(0, 3) || 'c'; id = b; let i = 2; while (countries.some((c) => c.id === id)) id = b + i++; }
    upsertCountry({ id, name: d.name.trim(), region: d.region?.trim() || undefined, iso3: d.iso3?.toUpperCase() || undefined, ccm: d.ccm?.trim() || undefined });
    setEdit(null);
  };
  return (
    <>
      <div class="drawer-h"><h2>Countries</h2><X close={close} /></div>
      <div class="drawer-b">
        {msg && <ul class="errlist"><li>{msg}</li></ul>}
        {edit != null && (
          <section class="card card-b" style={{ display: 'grid', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px' }}>{edit === 'new' ? 'Add country' : `Edit ${d.name}`}</h3>
            <div class="field" data-invalid={err.name ? '' : undefined}><label for="c-name">Name</label>
              <input id="c-name" autoFocus list="coe-countries" placeholder="Start typing — member states are listed" value={d.name}
                onInput={(e) => { const v = (e.target as HTMLInputElement).value, k = countryInfo(v); setD(k ? { ...d, name: k.name, iso3: k.iso3, region: k.region } : { ...d, name: v }); }} onKeyDown={(e) => e.key === 'Enter' && save()} />
              <datalist id="coe-countries">{COUNTRY_LIST.filter((c) => !countries.some((x) => x.name === c.name && x.id !== d.id)).map((c) => <option value={c.name}>{c.member ? 'Member state' : 'Partner'} · {c.region}</option>)}</datalist>
              {err.name && <span class="err">{err.name}</span>}</div>
            <div class="form-2">
              <div class="field"><label for="c-region">Region</label>
                <input id="c-region" list="regions" value={d.region} onInput={(e) => setD({ ...d, region: (e.target as HTMLInputElement).value })} />
                <datalist id="regions">{regions.map((r) => <option value={r} />)}</datalist></div>
              <div class="field" data-invalid={err.iso3 ? '' : undefined}><label for="c-iso">ISO code</label>
                <input id="c-iso" maxLength={3} value={d.iso3} placeholder="TUR" onInput={(e) => setD({ ...d, iso3: (e.target as HTMLInputElement).value })} />
                {err.iso3 && <span class="err">{err.iso3}</span>}</div>
              <div class="field"><label for="c-ccm">CCM</label>
                <input id="c-ccm" inputMode="numeric" value={d.ccm} placeholder="00901" onInput={(e) => setD({ ...d, ccm: (e.target as HTMLInputElement).value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button class="btn" onClick={() => setEdit(null)}>Cancel</button>
              <button class="btn primary" onClick={save}>{edit === 'new' ? 'Add country' : 'Save'}</button>
            </div>
          </section>
        )}
        <section class="card">
          <div class="card-h" style={{ alignItems: 'center' }}><div><h2>{countries.length} countries</h2><p>A country can be removed once it has no projects</p></div>
            <div class="tools">{edit == null && <button class="btn" onClick={() => { setMsg(''); setEdit('new'); }}>+ Add country</button>}</div></div>
          <ul class="att" style={{ marginTop: '12px' }}>
            {countries.map((c) => {
              const P = projects.filter((p) => p.country === c.id);
              return (
                <li style={{ cursor: 'default', gridTemplateColumns: '1fr auto' }}>
                  <div><div class="t">{c.name} {c.iso3 && <span class="num muted" style={{ fontSize: '11.5px' }}>{c.iso3}</span>}</div>
                    <div class="d">{c.region || 'No region'} · {P.length} project{P.length === 1 ? '' : 's'} · {short(P.reduce((s, p) => s + money(p).budget, 0))}</div></div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button class="btn ghost" title="Add a project in this country" onClick={() => set({ drawer: { kind: 'new-project', country: c.id } })}>+ Project</button>
                    <button class="btn ghost" onClick={() => { setMsg(''); setEdit(c.id); }}>Edit</button>
                    <button class="btn ghost danger" aria-label={`Remove ${c.name}`} title={P.length ? 'Has projects' : 'Remove'} onClick={() => setMsg(deleteCountry(c.id) ?? '')}>Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}

/** Plans every dropped workbook against the ledger and applies them in one undoable step. */

/** Daily restore points kept in this browser: bring back the data as it was on an earlier day. */
function RestorePoints({ close }: { close: () => void }) {
  const [P, setP] = useState<Awaited<ReturnType<typeof restorePoints>> | null>(null);
  useEffect(() => { restorePoints().then(setP); }, []);
  const now = useStore((s) => s.ledger);
  const nowReports = now.projects.reduce((a, p) => a + (p.reportingPeriods?.length ?? 0), 0);
  return (
    <section class="card" style={{ padding: '16px', display: 'grid', gap: '8px' }}>
      <h3 style={{ margin: 0, fontSize: '14px' }}>Restore points</h3>
      <p class="muted" style={{ margin: 0, fontSize: '13px' }}>A copy is kept each day you work (last 30 days). Now: {now.projects.length} projects, {nowReports} reports.</p>
      {!P ? <span class="muted">Loading…</span> : !P.length ? <span class="muted">No restore points yet.</span> : (
        <table class="mini"><thead><tr><th>Saved</th><th class="r">Projects</th><th class="r">Reports</th><th>Missing now</th><th /></tr></thead>
          <tbody>{P.map((x) => { const miss = x.ledger.projects.filter((p) => !now.projects.some((q) => q.id === p.id || (p.bh && q.bh === p.bh))).map((p) => p.bh ? `BH ${p.bh}` : p.code);
            return <tr><td>{x.key.endsWith('rescued') ? 'Rescued at load · ' : ''}{new Date(x.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td><td class="r num">{x.projects}</td><td class="r num">{x.reports}</td><td>{miss.join(', ') || '—'}</td>
              <td><button class="btn" onClick={() => { if (confirm('Replace the current data with this restore point? (undo is possible right after)')) { replaceLedger(x.ledger, `Restored data from ${x.at.slice(0, 10)}`); close(); } }}>Restore</button></td></tr>; })}</tbody></table>)}
    </section>
  );
}
