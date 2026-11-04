
import { SharePanel } from './Share';
import { PortfolioImport } from './PortfolioImport';

import { AlertPanel } from './AlertPanel';
import { PeriodPanel } from './PeriodPanel';
import { SmartImport } from './SmartImport';
import { useEffect, useState } from 'preact/hooks';
import { deleteProjects, get, go, set, upsertProject, useStore } from '../data/store';
import { burnGap, elapsed, lines, money, parseDate, riskScore, spendPoints } from '../domain/calc';
import { normalizeSector, SECTORS, validUrl, type Project } from '../domain/types';
import { TODAY } from '../today';
import { base, Chart } from './Chart';
import { parseAmount, parseDay } from './csv';
import { full, month, pct, period, short, signedPct } from './format';
import { ReportImport, RiskForm } from './ReportImport';

import { ContractPanel } from './ContractPanel';
import { AppearancePanel } from './Appearance';
import { DocumentsPanel } from './DocumentsPanel';
import { CountryPanel } from './CountryPanel';
import { ImportPanel } from './ImportPanel';
import { X } from './CloseX';

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
        {d.kind === 'share' && <SharePanel close={close} />}
        {d.kind === 'contract' && <ContractPanel projectId={d.projectId} k={d.key} close={close} />}
        {d.kind === 'risk' && <RiskForm projectId={d.projectId} id={d.id} close={close} />}
        {d.kind === 'countries' && <CountryPanel close={close} edit={d.edit} />}
        {d.kind === 'import' && <ImportPanel close={close} />}
        {d.kind === 'smart-import' && <SmartImport files={d.files} close={close} />}
        {d.kind === 'portfolio-import' && <PortfolioImport files={d.files} close={close} />}
        {d.kind === 'alert' && <AlertPanel projectId={d.projectId} kind={d.alertKind} ids={d.ids} close={close} />}
        {d.kind === 'period' && <PeriodPanel t={d.t} from={d.from} ids={d.ids} close={close} />}
      </div>
    </>
  );
}

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

export type Draft = Record<'code' | 'name' | 'country' | 'sector' | 'funding' | 'start' | 'end' | 'budget' | 'status' | 'mae' | 'pmm' | 'bh' | 'ccm' | 'pmmUrl', string>;

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

;
