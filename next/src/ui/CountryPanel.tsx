import { TR_SCALE_2027 } from '../domain/ccrScaleTR';
import { X } from './CloseX';
import { COUNTRY_LIST, countryInfo } from '../domain/countries';
import { useEffect, useState } from 'preact/hooks';
import { deleteCountry, set, upsertCountry, useStore } from '../data/store';
import type { Country } from '../domain/types';
import { money } from '../domain/calc';
import { short } from './format';
import { PolicyFields } from './SalaryPolicy';
import { CPI_LAST, salaryPath } from '../domain/salaryProjection';
import { CCR_2027, CCR_SOURCE, ccrOf } from '../domain/ccr';
export function checkCountry(c: Country, all: Country[], selfId?: string) {
  const e: Partial<Record<'name' | 'iso3', string>> = {};
  if (!c.name.trim()) e.name = 'Required';
  else if (all.some((x) => x.name.toLowerCase() === c.name.trim().toLowerCase() && x.id !== selfId)) e.name = 'Already exists';
  if (c.iso3 && !/^[A-Za-z]{3}$/.test(c.iso3)) e.iso3 = 'Three letters, e.g. TUR';
  return e;
}

export function CountryPanel({ close, edit: initial }: { close: () => void; edit?: string }) {
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
    // Keep what the form does not show (the salary scale of the country).
    upsertCountry({ ...countries.find((x) => x.id === id), id, name: d.name.trim(), region: d.region?.trim() || undefined, iso3: d.iso3?.toUpperCase() || undefined, ccm: d.ccm?.trim() || undefined });
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
          <div class="card-h" style={{ alignItems: 'center' }}><div><h2>{countries.length} countries</h2><p>Removing a country also removes its projects (a restore point is kept)</p></div>
            <div class="tools">{edit == null && <button class="btn" onClick={() => { setMsg(''); setEdit('new'); }}>+ Add country</button>}</div></div>
          <ul class="att" style={{ marginTop: '12px' }}>
            {countries.map((c) => {
              const P = projects.filter((p) => p.country === c.id);
              return (
                <li style={{ cursor: 'default', gridTemplateColumns: '1fr auto' }}>
                  <div><div class="t">{c.name} {c.iso3 && <span class="num muted" style={{ fontSize: '12px' }}>{c.iso3}</span>}</div>
                    <div class="d">{c.region || 'No region'} · {P.length} project{P.length === 1 ? '' : 's'} · {short(P.reduce((s, p) => s + money(p).budget, 0))}</div></div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button class="btn ghost" title="Add a project in this country" onClick={() => set({ drawer: { kind: 'new-project', country: c.id } })}>+ Project</button>
                    <button class="btn ghost" onClick={() => { setMsg(''); setEdit(c.id); }}>Edit</button>
                    <button class="btn ghost danger" aria-label={`Remove ${c.name}`} title={P.length ? 'Has projects' : 'Remove'} onClick={() => { if (confirm(P.length ? `Remove ${c.name} and its ${P.length} project${P.length > 1 ? 's' : ''}? A restore point is kept (Settings → Backup).` : `Remove ${c.name}?`)) setMsg(deleteCountry(c.id, true) ?? ''); }}>Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        {countries.filter((c) => c.iso3 === 'TUR' || /t[üu]rkiye|turkey/i.test(c.name)).map((c) => <SalaryScale c={c} />)}
        <details class="card ccr-all" style={{ marginTop: '16px' }}><summary>Salary adjustment indices at 1 January 2027 — Council of Europe member States ({CCR_2027.length})</summary>
          <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Country</th><th class="r">CPI</th><th class="r">PPP effect</th><th class="r">Index</th><th class="r">Special granted</th><th class="r">Applied 1 Jan 2027</th></tr></thead>
            <tbody>{CCR_2027.map((x) => <tr><td>{x.country}</td><td class="r num">{x.cpi.toFixed(1)}</td><td class="r num">{x.ppp == null ? '' : `${x.ppp > 0 ? '+' : ''}${x.ppp.toFixed(1)}`}</td><td class="r num">{x.index.toFixed(1)}</td><td class="r num">{x.special?.toFixed(1) ?? ''}</td><td class="r num"><b>{x.net > 100 ? '+' : x.net < 100 ? '−' : ''}{Math.abs(x.net - 100).toFixed(1)}%</b></td></tr>)}</tbody></table>
            <p class="muted" style={{ fontSize: '12px' }}>{CCR_SOURCE} (Annexes 1 and 1a), member States of the Council of Europe only. Index 100 = no change.</p></div>
        </details>
      </div>
    </>
  );
}

/** Türkiye's local salary scale: raises follow CPI. Kept once for the country; every project there uses it in its forecast. */
function SalaryScale({ c }: { c: Country }) {
  const projects = useStore((s) => s.ledger.projects);
  // Seeded from what a project had set before the policy moved to the country.
  const seed = projects.find((p) => p.country === c.id && p.forecastDraft?.infl && Object.keys(p.forecastDraft.infl).length > 1)?.forecastDraft?.infl;
  const s = c.salaryPolicy ?? { ...(seed ?? {}), on: true };
  const ev = salaryPath(`${new Date().getUTCFullYear() + 3}-12`, s).events.filter((e) => e.month > CPI_LAST).slice(0, 6);
  return <section class="card fe-inf on" style={{ marginTop: '16px' }}>
    <div class="card-h"><div><h2>📈 {c.name} — local salary scale</h2><p>Raises follow CPI: compounded since the last raise above {s.threshold ?? 7}% → {s.raise ?? 7}% raise from the next month; June triggers and the gap of the financial year go to the January catch-up · used by the forecast of every {c.name} project</p></div></div>
    <div class="card-b fe-inf-b">
      <PolicyFields s={s} set={(x) => upsertCountry({ ...c, salaryPolicy: { ...s, ...x, on: true } })} />
      {ev.length > 0 && <p class="muted" style={{ fontSize: '12px', margin: '8px 0 0' }}>Next raises: {ev.map((e) => `${e.month} +${e.pct.toFixed(2)}%${e.kind === 'official' ? ' (decided, CCR)' : e.projected ? ' (projected)' : ''}`).join(' · ')}</p>}
      {(() => { const x = ccrOf(c.iso3, c.name); return x && <div class="ccr-box">
        <b>Decided: annual adjustment at 1 January 2027</b>
        <span>Adjustment index {x.index.toFixed(1)} (CPI {x.cpi.toFixed(1)}{x.ppp ? `, PPP effect ${x.ppp > 0 ? '+' : ''}${x.ppp.toFixed(1)}` : ''}){x.special ? ` less the special adjustments already granted (${x.special.toFixed(1)}: 1 Oct 2025, 1 Feb 2026, 1 May 2026)` : ''} → <b>{x.net > 100 ? '+' : ''}{(x.net - 100).toFixed(1)}%</b> on the scale in force at 31 Dec 2026. The projection uses it in place of the January catch-up.</span>
        <small>{CCR_SOURCE}.</small>
      </div>; })()}
      {(c.iso3 === 'TUR' || /t[üu]rkiye|turkey/i.test(c.name)) && <TrScale />}
    </div>
  </section>;
}

/** The TRY scale at 1 January 2027 as published in CM(2026)136, grade by step, with the step values. */
function TrScale() {
  const R = TR_SCALE_2027.rows, n = Math.max(...R.map((r) => r.s.length));
  const f = (v: number) => v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <details class="ccr-all tr-scale">
    <summary>Monthly basic salary scale at 1 January 2027 (TRY, proposal) — {R.length} grades</summary>
    <div class="table-scroll"><table class="mini">
      <thead><tr><th>Grade</th>{Array.from({ length: n }, (_, i) => <th class="r">{i + 1}</th>)}<th class="r">Step value</th></tr></thead>
      <tbody>{R.map((r) => <tr class={r.g === 'B 6' || r.g === 'C 6' || r.g === 'L 5' ? 'tr-g' : ''}><th scope="row">{r.g}</th>{Array.from({ length: n }, (_, i) => <td class="r num">{r.s[i] != null ? f(r.s[i]) : ''}</td>)}<td class="r num muted">{r.step.map(f).join(' / ')}</td></tr>)}</tbody>
    </table></div>
    <small class="muted">{TR_SCALE_2027.source}. A grades: the second step value applies from step 7. Grades A 6 and A 7 have no Türkiye scale.</small>
  </details>;
}

/** Plans every dropped workbook against the ledger and applies them in one undoable step. */

/** Daily restore points kept in this browser: bring back the data as it was on an earlier day. */
