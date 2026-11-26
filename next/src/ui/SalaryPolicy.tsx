import { useState } from 'preact/hooks';
import { toast } from '../data/store';
import { CPI_LAST, recentCpi, salaryPath, type InflationSettings } from '../domain/salaryProjection';

/**
 * The local salary policy of a country (Türkiye): CPI assumption, EUR/TRY change, raise threshold and raise, and the
 * monthly CPI typed in as TurkStat publishes it. One set per country; every project there uses it.
 */
export function PolicyFields({ s, set }: { s: InflationSettings; set: (x: Partial<InflationSettings>) => void }) {
  const extra = s.extra ?? {}, lastKnown = salaryPath(CPI_LAST, s).lastKnown;
  const nextMonth = (() => { const [y, m] = lastKnown.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; })();
  const [cpiIn, setCpiIn] = useState(''), [cpiMon, setCpiMon] = useState('');
  const mon = cpiMon && cpiMon > CPI_LAST ? cpiMon : nextMonth;
  const addCpi = () => { const v = Number(cpiIn.trim().replace(',', '.')); if (!Number.isFinite(v) || cpiIn.trim() === '' || Math.abs(v) > 50) { toast('Type the monthly CPI in %, e.g. 1,85'); return; } set({ extra: { ...extra, [mon]: v } }); setCpiIn(''); setCpiMon(''); };
  const dropCpi = (k: string) => { const e = { ...extra }; delete e[k]; set({ extra: e }); };
  const numIn = (k: keyof InflationSettings, ph: string, w = 64) => <input type="number" step="0.01" style={{ width: `${w}px` }} value={(s[k] as number | undefined) ?? ''} placeholder={ph}
    onChange={(e) => set({ [k]: (e.target as HTMLInputElement).value === '' ? undefined : Number((e.target as HTMLInputElement).value) } as Partial<InflationSettings>)} />;
  return <>
    <div class="fe-inf-in">
      <label>Monthly CPI after {lastKnown} {numIn('cpi', String(recentCpi(6, s.extra)))} %</label>
      <label>EUR/TRY change per month {numIn('fx', '0')} %</label>
      <label>Threshold {numIn('threshold', '7', 52)} %</label>
      <label>Raise {numIn('raise', '7', 52)} %</label>
    </div>
    <div class="fe-inf-cpi">
      <span>Actual CPI (TurkStat, monthly %) for</span>
      <input type="month" class="fe-cpi-mon" value={mon} min={`${CPI_LAST.slice(0, 4)}-${String(Number(CPI_LAST.slice(5)) + 1).padStart(2, '0')}`} onInput={(e) => setCpiMon((e.target as HTMLInputElement).value)} />
      <input type="text" inputMode="decimal" aria-label="Monthly CPI in %" value={cpiIn} placeholder="e.g. 1,85" onInput={(e) => setCpiIn((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && addCpi()} />
      <button class="btn" disabled={cpiIn.trim() === ''} onClick={addCpi}>Add</button>
      {Object.keys(extra).sort().map((k) => <span class="fe-cpi-chip">{k} · {extra[k].toFixed(2)}% <button aria-label={`Remove ${k}`} onClick={() => dropCpi(k)}>✕</button></span>)}
      <small class="muted">Built in: TurkStat to {CPI_LAST}. A month typed here replaces the assumption for that month (typed again, it is overwritten); every project of the country is recalculated at once.</small>
    </div>
  </>;
}
