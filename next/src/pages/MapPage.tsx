import { useState } from 'preact/hooks';
import { go, set, useStore } from '../data/store';
import { attention, burnGap, money, totals } from '../domain/calc';
import { roster } from '../domain/staff';
import { SECTORS, type Country, type Project } from '../domain/types';
import { TODAY } from '../today';
import { date, pct, short, signedPct } from '../ui/format';
import { MapView, MODES, shapeFor, type MapDatum, type MapMode } from '../ui/MapView';

export function mapData(countries: Country[], P: Project[]): MapDatum[] {
  return countries.map((c) => {
    const ps = P.filter((p) => p.country === c.id), T = totals(ps, TODAY), F = attention(ps, TODAY);
    return { id: c.id, name: c.name, budget: T.budget, spent: T.spent, gap: T.burn - T.elapsed, projects: ps.length,
      staff: ps.reduce((s, p) => s + roster(p, TODAY).filter((a) => a.status === 'Active').length, 0),
      alerts: F.filter((f) => f.severity !== 'warning').length, critical: F.filter((f) => f.severity === 'critical').length };
  });
}

export function ModeSwitch({ mode, setMode, only }: { mode: MapMode; setMode: (m: MapMode) => void; only?: MapMode[] }) {
  return (
    <div class="seg" role="group" aria-label="Map colour">
      {MODES.filter((m) => !only || only.includes(m.id)).map((m) => <button aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>)}
    </div>
  );
}

export function MapPage() {
  const L = useStore((s) => s.ledger);
  const sector = useStore((s) => s.filters.sector);
  const [mode, setMode] = useState<MapMode>('budget');
  const [sel, setSel] = useState<string | null>(null);
  const P = L.projects.filter((p) => !sector || p.sector === sector);
  const D = mapData(L.countries, P);
  const c = L.countries.find((x) => x.id === sel), d = D.find((x) => x.id === sel);
  const cps = P.filter((p) => p.country === sel);
  const missing = L.countries.filter((x) => !shapeFor(x));
  return (
    <>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <ModeSwitch mode={mode} setMode={setMode} />
        <select class="select" style={{ height: '30px' }} value={sector} onChange={(e) => set((s) => ({ filters: { ...s.filters, sector: (e.target as HTMLSelectElement).value } }))} aria-label="Sector">
          <option value="">All sectors</option>{SECTORS.map((s) => <option>{s}</option>)}
        </select>
        <span class="muted" style={{ fontSize: '12.5px' }}>{MODES.find((m) => m.id === mode)!.hint} · drag to pan, scroll to zoom</span>
        <button class="chip" style={{ marginLeft: 'auto', borderStyle: 'dashed' }} onClick={() => set({ drawer: { kind: 'countries', edit: 'new' } })}>+ Country</button>
      </div>
      <div class="map-layout">
        <section class="card map-main">
          <MapView countries={L.countries} data={D} mode={mode} height={Math.round(Math.max(420, Math.min(innerHeight - 200, (Math.min(innerWidth, 1800) - (innerWidth > 1000 ? 620 : 80)) * 0.68)))} selected={sel ?? undefined} onSelect={setSel} />
          <MapProjects P={sel ? P.filter((p) => p.country === sel) : P} cname={(id) => L.countries.find((x) => x.id === id)?.name ?? id} />
          {missing.length > 0 && <p class="muted" style={{ fontSize: '12px', margin: '8px 4px 0' }}>Not drawn (no outline match — check the ISO code): {missing.map((x) => x.name).join(', ')}</p>}
        </section>
        <aside class="card map-side">
          {c && d ? (
            <>
              <div class="map-side-h">
                <button class="btn ghost" style={{ height: '26px', padding: '0 8px' }} onClick={() => setSel(null)}>← All countries</button>
                <h2>{c.name}</h2><div class="muted" style={{ fontSize: '12.5px' }}>{c.region || '—'} {c.iso3 && `· ${c.iso3}`}</div>
              </div>
              <div class="map-side-kpis">
                <div><span>Budget</span><b class="num">{short(d.budget)}</b></div>
                <div><span>Spent</span><b class="num">{pct(d.budget ? d.spent / d.budget : 0)}</b></div>
                <div><span>Pace</span><b class="num">{signedPct(d.gap)}</b></div>
                <div><span>Staff</span><b class="num">{d.staff}</b></div>
              </div>
              <div class="map-side-list">
                {cps.map((p) => { const m = money(p), g = burnGap(p, TODAY); return (
                  <button class="map-proj" onClick={() => go(`project/${p.id}`)}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}><b class="num">{p.code}</b><span class="muted" style={{ fontSize: '12px' }}>{p.sector}</span><span class={`badge ${g < -0.3 ? 'serious' : g < -0.15 ? 'warning' : g > 0.1 ? 'serious' : 'good'}`} style={{ marginLeft: 'auto' }}>{signedPct(g)}</span></div>
                    <div style={{ fontSize: '13px', margin: '2px 0 6px' }}>{p.name}</div>
                    <div class="minibar"><span style={{ width: `${Math.min(100, (m.spent / (m.budget || 1)) * 100)}%` }} /></div>
                    <div class="muted num" style={{ fontSize: '11.5px', marginTop: '4px' }}>{short(m.spent)} of {short(m.budget)}</div>
                  </button>); })}
              </div>
              <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
                <button class="btn primary" onClick={() => { set((s) => ({ filters: { ...s.filters, country: c.id } })); go('overview'); }}>Open overview</button>
                <button class="btn" onClick={() => set({ drawer: { kind: 'new-project', country: c.id } })}>+ Project</button>
              </div>
            </>
          ) : (
            (() => {
              const on = [...D].filter((x) => x.projects).sort((a, b) => b.budget - a.budget), off = D.filter((x) => !x.projects);
              const tb = on.reduce((s, x) => s + x.budget, 0), ts = on.reduce((s, x) => s + x.spent, 0), maxB = Math.max(1, ...on.map((x) => x.budget));
              return (<>
                <div class="map-side-h"><h2>Portfolio by country</h2><div class="muted" style={{ fontSize: '12.5px' }}>{on.length} countr{on.length === 1 ? 'y' : 'ies'} with projects · select one for details</div></div>
                <div class="map-side-kpis">
                  <div><span>Budget</span><b class="num">{short(tb)}</b></div>
                  <div><span>Spent</span><b class="num">{pct(tb ? ts / tb : 0)}</b></div>
                  <div><span>Projects</span><b class="num">{on.reduce((s, x) => s + x.projects, 0)}</b></div>
                  <div><span>Staff</span><b class="num">{on.reduce((s, x) => s + x.staff, 0)}</b></div>
                </div>
                <div class="map-side-list">
                  {on.map((x) => (
                    <button class="map-proj" onClick={() => setSel(x.id)}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}><b>{x.name}</b><span class="muted num" style={{ fontSize: '12px' }}>{x.projects} project{x.projects > 1 ? 's' : ''}</span>{x.alerts > 0 && <span class={`badge ${x.critical ? 'critical' : 'serious'}`} style={{ marginLeft: 'auto' }}>{x.alerts}</span>}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0' }}><span class="num" style={{ fontSize: '19px', fontWeight: 650 }}>{short(x.budget)}</span><span class="muted" style={{ fontSize: '12px' }}>{pct(x.budget ? x.spent / x.budget : 0)} spent · pace {signedPct(x.gap)}</span></div>
                      <div class="map-bar"><i style={{ width: `${x.budget / maxB * 100}%` }}><b style={{ width: `${x.budget ? Math.min(100, x.spent / x.budget * 100) : 0}%` }} /></i></div>
                    </button>
                  ))}
                  {off.length > 0 && <div class="map-off"><span class="muted">No projects yet:</span> {off.map((x) => <button class="chip" onClick={() => set({ drawer: { kind: 'new-project', country: x.id } })} title={`Add a project in ${x.name}`}>{x.name} +</button>)}</div>}
                </div>
              </>);
            })()
          )}
        </aside>
      </div>
    </>
  );
}

/** Compact project list under the map: the selected country's projects, or all. */
function MapProjects({ P, cname }: { P: Project[]; cname: (id: string) => string }) {
  if (!P.length) return null;
  const R = P.map((p) => ({ p, m: money(p), g: burnGap(p, TODAY) })).sort((a, b) => b.m.budget - a.m.budget);
  return (
    <div class="table-scroll" style={{ marginTop: '10px' }}><table class="mini mp-t">
      <thead><tr><th>Project</th><th>Country</th><th class="r">Budget</th><th style={{ width: '22%' }}>Spent</th><th class="r">Pace</th><th>Ends</th></tr></thead>
      <tbody>{R.map(({ p, m, g }) => <tr class="click" onClick={() => go(`project/${p.id}`)}>
        <td><b class="num">{p.bh ? `BH ${p.bh}` : p.code}</b> <span class="muted">{p.name.length > 60 ? p.name.slice(0, 58) + '…' : p.name}</span></td><td>{cname(p.country)}</td>
        <td class="r num">{short(m.budget)}</td>
        <td><div class="map-bar"><i style={{ width: '100%' }}><b style={{ width: `${m.budget ? Math.min(100, m.spent / m.budget * 100) : 0}%` }} /></i></div><small class="muted num">{pct(m.budget ? m.spent / m.budget : 0)}</small></td>
        <td class="r num" style={{ whiteSpace: 'nowrap', color: g < -0.15 ? 'var(--serious)' : g > 0.1 ? 'var(--serious)' : 'var(--good)' }}>{p.datesTbc ? '—' : signedPct(g)}</td><td class="num" style={{ whiteSpace: 'nowrap' }}>{date(p.end)}</td></tr>)}</tbody></table></div>
  );
}
