import { useEffect, useState } from 'preact/hooks';
import { deleteCountry, deleteProjects, get, go, replaceLedger, resetDemo, set, upsertCountry, upsertProject, useStore } from '../data/store';
import type { Country } from '../domain/types';
import { burnGap, elapsed, lines, money, parseDate, riskScore, spendPoints, validateLedger } from '../domain/calc';
import { normalizeSector, SECTORS, type Ledger, type Project } from '../domain/types';
import { TODAY } from '../today';
import { base, Chart } from './Chart';
import { parseAmount, parseCSV, parseDay } from './csv';
import { full, month, pct, short, signedPct } from './format';
import { readTable, ReportImport, RiskForm } from './ReportImport';

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
        {d.kind === 'new-project' && <ProjectForm close={close} preset={d.country} />}
        {d.kind === 'report' && <ReportImport projectId={d.projectId} close={close} />}
        {d.kind === 'risk' && <RiskForm projectId={d.projectId} id={d.id} close={close} />}
        {d.kind === 'countries' && <CountryPanel close={close} edit={d.edit} />}
        {d.kind === 'import' && <ImportPanel close={close} />}
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
          <dt>Period</dt><dd>{month(p.start)} → {month(p.end)}</dd>
          <dt>Budget</dt><dd class="num">{full(m.budget)}</dd>
          <dt>Committed</dt><dd class="num">{full(m.committed)}</dd>
          <dt>Status</dt><dd>{p.status || 'Active'}</dd>
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

type Draft = Record<'code' | 'name' | 'country' | 'sector' | 'funding' | 'start' | 'end' | 'budget' | 'status', string>;

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
  return e;
}

export function ProjectForm({ close, project, preset }: { close: () => void; project?: Project; preset?: string }) {
  const { countries, projects } = useStore((s) => s.ledger);
  const [d, setD] = useState<Draft>({
    code: project?.code ?? '', name: project?.name ?? '', country: project?.country ?? preset ?? countries[0]?.id ?? '',
    sector: normalizeSector(project?.sector) ?? '', funding: project?.funding ?? '', start: project?.start ?? '', end: project?.end ?? '',
    budget: project ? String(project.budget) : '', status: project?.status ?? 'Active',
  });
  const [touched, setTouched] = useState(false);
  const errs = checkDraft(d, projects, project?.id);
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
    upsertProject({
      ...(project ?? { id: 'p' + Date.now().toString(36), reportingPeriods: [], riskRegister: [] }),
      code: d.code.trim(), name: d.name.trim(), country: d.country, sector: d.sector.trim(), funding: d.funding.trim(),
      start: parseDay(d.start)!, end: parseDay(d.end)!, budget: parseAmount(d.budget)!, status: d.status,
    } as Project);
    close();
  };
  return (
    <>
      <div class="drawer-h"><h2>{project ? `Edit ${project.code}` : 'New project'}</h2><X close={close} /></div>
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
        <button type="submit" hidden />
      </form>
      <div class="drawer-f"><button class="btn" onClick={close}>Cancel</button><button class="btn primary" onClick={save}>{project ? 'Save changes' : 'Add project'}</button></div>
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
] as const;

function ImportPanel({ close }: { close: () => void }) {
  const ledger = useStore((s) => s.ledger);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [json, setJson] = useState<{ data: Ledger; errs: string[] } | null>(null);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState('');

  async function read(file: File) {
    setErr(''); setRows(null); setJson(null);
    const text = await file.text();
    if (/\.json$/i.test(file.name) || text.trim().startsWith('{')) {
      try { const data = JSON.parse(text); setJson({ data, errs: validateLedger(data) }); } catch { setErr('This file is not valid JSON.'); }
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
    const d: Draft = { code: g('code'), name: g('name'), country: countryId(g('country')) ?? '', sector: normalizeSector(g('sector')) ?? '', funding: g('funding'), start: parseDay(g('start')) ?? g('start'), end: parseDay(g('end')) ?? g('end'), budget: g('budget'), status: 'Active' };
    const e = checkDraft(d, ledger.projects);
    if (g('country') && !d.country) e.country = `Unknown country “${g('country')}” (add it under Manage countries)`;
    if (g('sector') && !d.sector) e.sector = `Unknown sector “${g('sector')}”`;
    return { line: i + 2, d, e };
  }) ?? [];
  const good = parsed.filter((x) => !Object.keys(x.e).length);
  const dupInFile = new Set<string>();
  const importable = good.filter((x) => { const k = x.d.code.toLowerCase(); if (dupInFile.has(k)) return false; dupInFile.add(k); return true; });

  const exportJSON = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(ledger, null, 2)], { type: 'application/json' }));
    a.download = `portfolio-ledger-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };

  return (
    <>
      <div class="drawer-h"><h2>Import & backup</h2><X close={close} /></div>
      <div class="drawer-b">
        <label class={`drop ${over ? 'on' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer?.files[0]; if (f) read(f); }}>
          <input type="file" accept=".csv,.xlsx,.json,text/csv,application/json" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) read(f); }} />
          <strong style={{ color: 'var(--ink)' }}>Drop a project list (Excel or CSV) or a JSON backup</strong><br />or click to choose a file
        </label>
        {err && <ul class="errlist"><li>{err}</li></ul>}

        {json && (
          <section class="card card-b">
            <h3 style={{ margin: '0 0 8px', fontSize: '14px' }}>Backup file</h3>
            <p class="muted" style={{ margin: 0 }}>{json.data.projects?.length ?? 0} projects · {json.data.countries?.length ?? 0} countries. Importing replaces the current data (you can undo).</p>
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
              <div class="card-h"><div><h2>Preview</h2><p>{importable.length} ready · {parsed.length - importable.length} with problems</p></div></div>
              <ul class="att" style={{ marginTop: '8px', maxHeight: '280px', overflow: 'auto' }}>
                {parsed.slice(0, 200).map((x) => {
                  const bad = Object.entries(x.e);
                  return (
                    <li style={{ cursor: 'default' }}>
                      <span class={`badge ${bad.length ? 'critical' : 'good'}`}>Row {x.line}</span>
                      <div><div class="t">{x.d.code || '—'} · {x.d.name || '—'}</div>
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
            <button class="btn ghost" onClick={() => { resetDemo(); close(); }}>Restore demo data</button>
          </div>
        </section>
      </div>
      {rows && (
        <div class="drawer-f">
          <button class="btn" onClick={() => setRows(null)}>Cancel</button>
          <button class="btn primary" disabled={!importable.length} onClick={() => {
            const L: Ledger = JSON.parse(JSON.stringify(ledger));
            importable.forEach((x, i) => L.projects.push({ id: `p${Date.now().toString(36)}${i}`, code: x.d.code, name: x.d.name, country: x.d.country, sector: x.d.sector, funding: x.d.funding, start: x.d.start, end: x.d.end, budget: parseAmount(x.d.budget)!, status: 'Active', reportingPeriods: [], riskRegister: [] }));
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
  const [d, setD] = useState<Country>({ id: '', name: '', region: '', iso3: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const c = countries.find((x) => x.id === edit);
    setD(c ? { region: '', iso3: '', ...c } : { id: '', name: '', region: '', iso3: '' }); setErr({});
  }, [edit]);
  const regions = [...new Set(countries.map((c) => c.region).filter(Boolean))] as string[];
  const save = () => {
    const e = checkCountry(d, countries, edit !== 'new' ? edit ?? undefined : undefined);
    setErr(e as Record<string, string>); if (Object.keys(e).length) return;
    let id = d.id;
    if (!id) { const b = (d.iso3 || d.name).toLowerCase().replace(/[^a-z]/g, '').slice(0, 3) || 'c'; id = b; let i = 2; while (countries.some((c) => c.id === id)) id = b + i++; }
    upsertCountry({ id, name: d.name.trim(), region: d.region?.trim() || undefined, iso3: d.iso3?.toUpperCase() || undefined });
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
              <input id="c-name" autoFocus value={d.name} onInput={(e) => setD({ ...d, name: (e.target as HTMLInputElement).value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
              {err.name && <span class="err">{err.name}</span>}</div>
            <div class="form-2">
              <div class="field"><label for="c-region">Region</label>
                <input id="c-region" list="regions" value={d.region} onInput={(e) => setD({ ...d, region: (e.target as HTMLInputElement).value })} />
                <datalist id="regions">{regions.map((r) => <option value={r} />)}</datalist></div>
              <div class="field" data-invalid={err.iso3 ? '' : undefined}><label for="c-iso">ISO code</label>
                <input id="c-iso" maxLength={3} value={d.iso3} placeholder="TUR" onInput={(e) => setD({ ...d, iso3: (e.target as HTMLInputElement).value })} />
                {err.iso3 && <span class="err">{err.iso3}</span>}</div>
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
