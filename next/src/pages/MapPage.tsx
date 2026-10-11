import { go, set, useStore } from '../data/store';
import { attention, money, totals } from '../domain/calc';
import { CENTROIDS, iso3Of } from '../domain/geo';
import { roster } from '../domain/staff';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from '../ui/Chart';
import { pct, short, signedPct } from '../ui/format';
import { SECTORS } from '../domain/types';

interface Row { id: string; name: string; iso?: string; budget: number; spent: number; gap: number; projects: number; staff: number; flags: number; sectors: Record<string, number> }

export function MapPage() {
  const L = useStore((s) => s.ledger);
  const sector = useStore((s) => s.filters.sector);
  const P = L.projects.filter((p) => !sector || p.sector === sector);
  const rows: Row[] = L.countries.map((c) => {
    const ps = P.filter((p) => p.country === c.id), T = totals(ps, TODAY);
    const sectors: Record<string, number> = {};
    ps.forEach((p) => { sectors[p.sector ?? '—'] = (sectors[p.sector ?? '—'] ?? 0) + money(p).budget; });
    return { id: c.id, name: c.name, iso: iso3Of(c), budget: T.budget, spent: T.spent, gap: T.burn - T.elapsed, projects: ps.length, staff: ps.reduce((s, p) => s + roster(p, TODAY).filter((a) => a.status === 'Active').length, 0), flags: attention(ps, TODAY).filter((f) => f.severity !== 'warning').length, sectors };
  });
  const placed = rows.filter((r) => r.iso);
  const unplaced = rows.filter((r) => !r.iso);
  const pick = (id: string) => { set((s) => ({ filters: { ...s.filters, country: id } })); go('overview'); };
  return (
    <>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select class="select" style={{ height: '28px', borderRadius: '99px' }} value={sector} onChange={(e) => set((s) => ({ filters: { ...s.filters, sector: (e.target as HTMLSelectElement).value } }))} aria-label="Sector">
          <option value="">All sectors</option>{SECTORS.map((s) => <option>{s}</option>)}
        </select>
        <button class="chip" style={{ borderStyle: 'dashed' }} onClick={() => set({ drawer: { kind: 'countries', edit: 'new' } })}>+ Country</button>
      </div>
      <div class="grid g-12">
        <section class="card span-8">
          <div class="card-h"><div><h2>Portfolio map</h2><p>Bubble size = budget · colour = spending pace against time · click a country to open its overview</p></div></div>
          <div class="card-b">
            <div class="legend" style={{ marginBottom: '4px' }}>
              <span><i style={{ background: 'var(--c1)', borderRadius: '50%' }} />On track</span><span><i style={{ background: 'var(--warn)', borderRadius: '50%' }} />Behind</span><span><i style={{ background: 'var(--serious)', borderRadius: '50%' }} />Far behind / ahead</span>
            </div>
            <Chart height={460} label="Map of countries by budget" onClick={(e) => e.data?.id && pick(e.data.id)} option={(t) => mapOption(t, placed)} />
            {unplaced.length > 0 && <p class="muted" style={{ fontSize: '12.5px', margin: '8px 0 0' }}>Not on the map (add an ISO code under Manage countries): {unplaced.map((r) => r.name).join(', ')}</p>}
          </div>
        </section>
        <section class="span-4" style={{ display: 'grid', gap: '16px', alignContent: 'start' }}>
          {rows.sort((a, b) => b.budget - a.budget).map((r) => (
            <button class="card ccard" onClick={() => pick(r.id)}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}><b style={{ fontSize: '15px' }}>{r.name}</b><span class="num muted" style={{ fontSize: '11.5px' }}>{r.iso}</span>
                {r.flags > 0 && <span class="badge serious" style={{ marginLeft: 'auto' }}>{r.flags} alerts</span>}</div>
              <div class="num" style={{ fontSize: '22px', fontWeight: 600, margin: '6px 0 2px' }}>{short(r.budget)}</div>
              <div class="muted" style={{ fontSize: '12.5px' }}>{r.projects} projects · {r.staff} staff · {pct(r.budget ? r.spent / r.budget : 0)} spent · {r.projects ? signedPct(r.gap) : '—'}</div>
              {r.budget > 0 && <div class="sector-bar">{SECTORS.map((s, i) => r.sectors[s] ? <span title={`${s}: ${short(r.sectors[s])}`} style={{ flex: r.sectors[s], background: `var(--c${[1, 2, 3][i]})` }} /> : null)}</div>}
            </button>
          ))}
          <div class="legend" style={{ fontSize: '12px' }}>{SECTORS.map((s, i) => <span><i style={{ background: `var(--c${[1, 2, 3][i]})` }} />{s}</span>)}</div>
        </section>
      </div>
    </>
  );
}

function mapOption(t: Tokens, R: Row[]) {
  const max = Math.max(1, ...R.map((r) => r.budget));
  const tone = (r: Row) => (!r.projects ? t.plan : r.gap < -0.3 || r.gap > 0.1 ? t.serious : r.gap < -0.15 ? t.warn : t.c[0]);
  const lons = R.map((r) => CENTROIDS[r.iso!][0]), lats = R.map((r) => CENTROIDS[r.iso!][1]);
  // Frame the portfolio with some context around it.
  const x0 = Math.min(-10, ...lons) - 4, x1 = Math.max(40, ...lons) + 12, y0 = Math.min(34, ...lats) - 3, y1 = Math.max(60, ...lats) + 3;
  const backdrop = Object.entries(CENTROIDS).filter(([, v]) => v[0] >= x0 && v[0] <= x1 && v[1] >= y0 && v[1] <= y1 && !R.some((r) => Math.hypot(CENTROIDS[r.iso!][0] - v[0], CENTROIDS[r.iso!][1] - v[1]) < 4.5));
  return {
    ...base(t),
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    tooltip: { ...(base(t).tooltip as object), trigger: 'item', formatter: (x: any) => x.data?.r ? `<b>${x.data.r.name}</b><br/>Budget <b>${short(x.data.r.budget)}</b> · ${x.data.r.projects} projects<br/>${pct(x.data.r.budget ? x.data.r.spent / x.data.r.budget : 0)} spent · pace ${signedPct(x.data.r.gap)}<br/>${x.data.r.staff} staff under contract` : x.name },
    xAxis: { type: 'value', min: x0, max: x1, show: false },
    // Simple equirectangular projection; latitude stretched for mid-latitudes.
    yAxis: { type: 'value', min: y0, max: y1, show: false },
    series: [
      { type: 'scatter', silent: false, data: backdrop.map(([, v]) => ({ name: v[2], value: [v[0], v[1]] })), symbolSize: 5, itemStyle: { color: t.line },
        label: { show: true, formatter: (x: any) => x.name, position: 'right', color: t.ink3, fontSize: 10, opacity: 0.7 }, labelLayout: { hideOverlap: true }, z: 1 },
      { type: 'scatter', data: R.map((r) => ({ id: r.id, r, value: [CENTROIDS[r.iso!][0], CENTROIDS[r.iso!][1]], symbolSize: 18 + 60 * Math.sqrt(r.budget / max), itemStyle: { color: tone(r), opacity: 0.85, borderColor: t.surface, borderWidth: 2 } })),
        label: { show: true, position: 'right', distance: 8, formatter: (x: any) => `{n|${x.data.r.name}}\n{v|${short(x.data.r.budget)}}`, rich: { n: { color: t.ink, fontWeight: 650, fontSize: 12.5 }, v: { color: t.ink2, fontFamily: t.mono, fontSize: 11.5 } } },
        emphasis: { scale: 1.08 }, z: 3 },
    ],
  };
}

