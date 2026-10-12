import { X } from './CloseX';
import { COUNTRY_LIST, countryInfo } from '../domain/countries';
import { useEffect, useState } from 'preact/hooks';
import { deleteCountry, set, upsertCountry, useStore } from '../data/store';
import type { Country } from '../domain/types';
import { money } from '../domain/calc';
import { short } from './format';
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
          <div class="card-h" style={{ alignItems: 'center' }}><div><h2>{countries.length} countries</h2><p>Removing a country also removes its projects (a restore point is kept)</p></div>
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
                    <button class="btn ghost danger" aria-label={`Remove ${c.name}`} title={P.length ? 'Has projects' : 'Remove'} onClick={() => { if (confirm(P.length ? `Remove ${c.name} and its ${P.length} project${P.length > 1 ? 's' : ''}? A restore point is kept (Settings → Backup).` : `Remove ${c.name}?`)) setMsg(deleteCountry(c.id, true) ?? ''); }}>Remove</button>
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
