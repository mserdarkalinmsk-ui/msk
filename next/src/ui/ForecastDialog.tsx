import { useState } from 'preact/hooks';
import { useStore } from '../data/store';
import { earlyWarnings } from '../domain/earlywarn';
import { defaultOptions, FORECAST_KINDS, forecastFileName, forecastPeriod, forecastSheets, type ForecastKind, type ForecastOptions } from '../domain/forecastTemplate';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date } from './format';
import { download } from './xlsxwrite';

const KEY = (id: string) => `pl-forecast-opt:${id}`;
const load = (p: Project): ForecastOptions => { try { const x = JSON.parse(localStorage.getItem(KEY(p.id)) ?? 'null'); if (x?.kind && x?.programme) return x; } catch { /* storage blocked */ } return defaultOptions(p); };

/** Chooses the forecast template (guidelines: JP or VC, the kind of request, extension date, notification or addendum). */
export function ForecastDialog({ p, close }: { p: Project; close: () => void }) {
  const countries = useStore((s) => s.ledger.countries);
  const [o, setO] = useState<ForecastOptions>(() => load(p));
  const up = (x: Partial<ForecastOptions>) => setO((v) => { const n = { ...v, ...x }; if (!FORECAST_KINDS[n.kind].programmes.includes(n.programme)) n.kind = n.programme === 'JP' ? 'payment' : 'revision'; return n; });
  // %25 rule: an addendum when a heading would move beyond the flexibility, otherwise a notification.
  const W = earlyWarnings(p, TODAY), addendum = W.some((w) => w.stage === 'addendum'), worst = W.filter((w) => w.stage !== 'ok').sort((a, b) => b.changeIfCovered - a.changeIfCovered)[0];
  const suggest: 'addendum' | 'notification' = addendum ? 'addendum' : 'notification';
  const per = forecastPeriod(p, TODAY, o);
  const needsExt = o.kind === 'extension';
  const ok = !needsExt || (o.extendTo && o.extendTo > p.end);
  const go = () => {
    const opt = { ...o, change: o.programme === 'JP' && o.kind !== 'twelve' ? o.change ?? suggest : undefined };
    try { localStorage.setItem(KEY(p.id), JSON.stringify(opt)); } catch { /* storage blocked */ }
    download(forecastFileName(p, countries.find((c) => c.id === p.country)?.name ?? '', TODAY, opt), forecastSheets(p, TODAY, opt, p.forecastDraft?.lines)); close();
  };
  return (
    <>
      <div class="scrim" onClick={close} />
      <div class="fc-dlg card" role="dialog" aria-label="Forecast template">
        <div class="card-h"><h2>Forecast Excel</h2><button class="btn ghost" aria-label="Close" onClick={close}>✕</button></div>
        <div class="card-b fc-b">
          <label class="fc-l">Programme</label>
          <div class="seg">{(['JP', 'VC'] as const).map((x) => <button aria-pressed={o.programme === x} onClick={() => up({ programme: x })}>{x === 'JP' ? 'Joint Programme (JP)' : 'Voluntary Contribution (VC)'}</button>)}</div>
          <label class="fc-l">Template</label>
          <div class="fc-k">{(Object.keys(FORECAST_KINDS) as ForecastKind[]).filter((k) => FORECAST_KINDS[k].programmes.includes(o.programme)).map((k) => (
            <button class={`fc-opt${o.kind === k ? ' on' : ''}`} aria-pressed={o.kind === k} onClick={() => up({ kind: k })}><b>{FORECAST_KINDS[k].label}</b><small>{FORECAST_KINDS[k].hint}</small></button>))}</div>
          {(o.kind === 'revision' || o.kind === 'extension') && <>
            <label class="fc-l" for="fc-ext">{needsExt ? 'Extended end date' : 'Extended end date (only if the project is extended)'}</label>
            <input id="fc-ext" type="date" value={o.extendTo ?? ''} min={p.end} onInput={(e) => up({ extendTo: (e.target as HTMLInputElement).value || undefined })} />
            <small class="muted">Current end date {date(p.end)}</small>
          </>}
          {o.programme === 'JP' && o.kind !== 'twelve' && <>
            <label class="fc-l">Budget change</label>
            <div class="seg">{(['notification', 'addendum'] as const).map((x) => <button aria-pressed={(o.change ?? suggest) === x} onClick={() => up({ change: x })}>{x === 'notification' ? 'Notification (≤ 25%)' : 'Addendum (> 25%)'}{x === suggest ? ' · suggested' : ''}</button>)}</div>
            <small class="muted">{addendum ? `Suggested addendum: at the current plan ${worst?.code} ${worst?.label} would move ${Math.round((worst?.changeIfCovered ?? 0) * 100)}% from the agreement (limit 25% between sub-totals).` : 'Suggested notification: no heading is expected to move beyond 25% between sub-totals. Check the variation column once the plan is filled in.'}</small>
            <label class="fc-l" for="fc-no">Number (from PMM → Documents → Contract; ask the RFO for notifications)</label>
            <input id="fc-no" value={o.changeNo ?? ''} placeholder="e.g. 2" onInput={(e) => up({ changeNo: (e.target as HTMLInputElement).value || undefined })} />
          </>}
          {o.programme === 'VC' && <small class="muted">The rounded proposal is titled “Revised ({TODAY.toLocaleString('en-GB', { month: 'short', year: '2-digit' }).toUpperCase().replace(' ', '-')})”; the variation sheet has no justification column (VCs).</small>}
          <div class="fc-sum">Actuals as at <b>{date(per.asAt)}</b> · planned from <b>{date(per.from)}</b> to <b>{date(per.to)}</b>{o.kind === 'payment' && <> · revision {date(per.revFrom)} → {date(per.revTo)}</>}{o.kind === 'extension' && per.extTo && <> · extension {date(per.extFrom)} → {date(per.extTo)}</>}</div>
        </div>
        <div class="drawer-f"><button class="btn" onClick={close}>Cancel</button><button class="btn primary" disabled={!ok} onClick={go}>⤓ Download</button></div>
      </div>
    </>
  );
}
