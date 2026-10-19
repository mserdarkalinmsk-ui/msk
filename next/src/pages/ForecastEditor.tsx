import { useState } from 'preact/hooks';
import { toast, updateProject, useStore } from '../data/store';
import { autoLine, autofillStaff, balanceOn, computePlan, effective, resolvedLines, type BlockId, type ForecastDraft } from '../domain/forecastPlan';
import { costFactor, CPI_LAST, recentCpi, salaryPath, type InflationSettings } from '../domain/salaryProjection';
import { forecastPeriod } from '../domain/forecastTemplate';
import { defaultOptions, FORECAST_KINDS, forecastFileName, forecastSheets, type ForecastKind, type ForecastMode, type ForecastOptions } from '../domain/forecastTemplate';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full } from '../ui/format';
import { download } from '../ui/xlsxwrite';
import { ForecastNote } from '../ui/ForecastNote';

const pc = (v: number | null) => (v == null ? '' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}%`);
const num = (v: number) => v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The forecast inside the app: finance fills the staff and charging back lines (green), the project team's lines (yellow)
 * come back through the Excel or are typed here; the proposal, the variation per heading and the notification / addendum
 * decision follow as you type.
 */
export function ForecastEditor({ p }: { p: Project }) {
  const countries = useStore((s) => s.ledger.countries);
  const d: ForecastDraft = p.forecastDraft ?? { opt: defaultOptions(p), lines: {} };
  const save = (x: ForecastDraft) => updateProject(p.id, { forecastDraft: { ...x, updatedAt: new Date().toISOString() } });
  const setOpt = (o: Partial<ForecastOptions>) => { const opt = { ...d.opt, ...o }; if (!FORECAST_KINDS[opt.kind].programmes.includes(opt.programme)) opt.kind = opt.programme === 'JP' ? 'payment' : 'revision'; save({ ...d, opt }); };
  const setCell = (code: string, b: BlockId, k: 'u' | 'r', v: string) => {
    const x = v.trim() === '' ? undefined : Number(v.replace(/,/g, ''));
    if (x != null && !Number.isFinite(x)) return;
    save({ ...d, lines: { ...d.lines, [code]: { ...d.lines[code], [b]: { ...d.lines[code]?.[b], [k]: x } } } });
  };
  const [all, setAll] = useState(false), [note, setNote] = useState(false);
  const plug = autoLine(d), E = effective(p, TODAY, d), R = computePlan(p, TODAY, E), lastB = R.blocks.at(-1)!.id;
  const twelve = d.opt.kind === 'twelve';
  const shown = R.lines.filter((l) => all || !l.empty || Object.keys(l.cells).length);
  const opt = { ...d.opt, change: d.opt.programme === 'JP' && !twelve ? (d.opt.change ?? (R.decision === 'addendum' ? 'addendum' : 'notification')) : undefined };
  const xlsx = (mode: ForecastMode) => download(forecastFileName(p, countries.find((c) => c.id === p.country)?.name ?? '', TODAY, opt, mode), forecastSheets(p, TODAY, opt, resolvedLines(p, TODAY, E), mode));
  // Units that look like a rate typed in the wrong box: more months than the period has for a monthly line, or far more
  // than the budget has left.
  const odd = (l: (typeof R.lines)[number], b: BlockId): string | null => {
    const u = d.lines[l.code]?.[b]?.u; if (!u) return null;
    const blk = R.blocks.find((x) => x.id === b)!, months = (Date.parse(blk.to) - Date.parse(blk.from)) / (30.44 * 864e5) + 1;
    if (/month/i.test(l.unit) && u > months * (l.staff ? 3 : 2) + 0.5) return `${u} units for about ${Math.round(months)} months — is this a rate typed in the units box?`;
    if (l.bUnits && u > l.bUnits * 3) return `${u} units against ${l.bUnits} in the budget — please check`;
    return null;
  };
  const bad = R.lines.flatMap((l) => R.blocks.map((b) => odd(l, b.id)).filter(Boolean).map((m) => `${l.code}: ${m}`));
  const tone = R.decision === 'addendum' ? 'critical' : R.decision === 'notification' ? 'warn' : 'good';
  return (
    <div class="fe">
      <section class="card">
        <div class="card-h" style={{ flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <div><h2>Forecast</h2><p>Green: finance (staff, 4.2 / 4.4) · yellow: project team · amounts follow the CoE template formulas</p></div>
          <div class="fe-tools">
            <div class="seg">{(['JP', 'VC'] as const).map((x) => <button aria-pressed={d.opt.programme === x} onClick={() => setOpt({ programme: x })}>{x}</button>)}</div>
            <select value={d.opt.kind} onChange={(e) => setOpt({ kind: (e.target as HTMLSelectElement).value as ForecastKind })}>
              {(Object.keys(FORECAST_KINDS) as ForecastKind[]).filter((k) => FORECAST_KINDS[k].programmes.includes(d.opt.programme)).map((k) => <option value={k}>{FORECAST_KINDS[k].label}</option>)}
            </select>
            {d.opt.programme === 'JP' && !twelve && <label class="fe-ext"><select value={d.opt.change ?? ''} onChange={(e) => setOpt({ change: ((e.target as HTMLSelectElement).value || undefined) as ForecastOptions['change'] })}>
              <option value="">{R.decision === 'addendum' ? 'Addendum (suggested)' : 'Notification (suggested)'}</option><option value="notification">Notification</option><option value="addendum">Addendum</option></select>
              n° <input style={{ width: '56px' }} value={d.opt.changeNo ?? ''} onChange={(e) => setOpt({ changeNo: (e.target as HTMLInputElement).value || undefined })} /></label>}
            {(d.opt.kind === 'revision' || d.opt.kind === 'extension') && <label class="fe-ext">until <input type="date" value={d.opt.extendTo ?? ''} min={p.end} onChange={(e) => setOpt({ extendTo: (e.target as HTMLInputElement).value || undefined })} /></label>}
          </div>
        </div>
        <div class="card-b fe-actions">
          <button class="btn primary" title="Units from the staff contracts on each line (months in each period × FTE), rates from the latest cost plus the guideline margin; 4.2 / 4.4 on the local staff months" onClick={() => save(autofillStaff(p, TODAY, d))}>✦ Fill staff and 4.2 / 4.4</button>
          <label class="fe-rate">4.2 rate <input type="number" value={d.rates?.r42 ?? ''} placeholder="per month" onChange={(e) => save({ ...d, rates: { ...d.rates, r42: Number((e.target as HTMLInputElement).value) || undefined } })} /></label>
          <label class="fe-rate">4.4 rate <input type="number" value={d.rates?.r44 ?? ''} placeholder="per month" onChange={(e) => save({ ...d, rates: { ...d.rates, r44: Number((e.target as HTMLInputElement).value) || undefined } })} /></label>
          {!twelve && <label class="fe-ext" title="Guidelines step 8: the total of the agreement does not change — the remainder of the direct costs goes to one line, in its last planned period">
            <input type="checkbox" checked={!!plug} onChange={() => save({ ...d, auto: { ...d.auto, on: !plug } })} /> Keep the total fixed — remainder on
            <select value={d.auto?.line ?? '5.7'} disabled={!plug} onChange={(e) => save({ ...d, auto: { ...d.auto, line: (e.target as HTMLSelectElement).value } })}>
              {R.lines.filter((l) => !l.staff && !l.cb && (l.budget || l.code === (d.auto?.line ?? '5.7'))).map((l) => <option value={l.code}>{l.code} {l.description.slice(0, 32)}</option>)}
            </select></label>}
          {!twelve && !plug && <button class="btn" title="Puts the difference with the budget on 5.7 once (guidelines, step 8)" onClick={() => save(balanceOn(p, TODAY, d))}>⚖ Balance on 5.7</button>}
          <button class="btn" title="Working file for the project team: the rounded proposal and variation columns hidden (guidelines, step 7)" onClick={() => xlsx('team')}>⤓ Excel for the project team</button>
          <button class="btn" title="Every sheet and column visible — the finance working file" onClick={() => xlsx('working')}>⤓ Working file</button>
          {!twelve && <button class="btn primary" title="Donor version (guidelines, steps 9–10): Budget presentation and variation with values only, the forecast sheet hidden, named as a revised budget proposal" onClick={() => {
            if (d.opt.programme === 'JP' && !d.opt.changeNo && !confirm(`No ${opt.change} number yet (PMM → Documents → Contract, or the RFO). Download without it?`)) return;
            xlsx('donor');
          }}>⤓ Donor version</button>}
          <button class="btn ghost danger" onClick={() => { if (confirm('Clear every planned unit and rate of this forecast?')) save({ opt: d.opt, lines: {}, rates: d.rates }); }}>Clear</button>
          <label class="fe-all"><input type="checkbox" checked={all} onChange={() => setAll(!all)} /> All template lines</label>
        </div>
        {d.notes?.length ? <details class="fe-notes"><summary>How the staff lines were filled ({d.notes.length})</summary><ul>{d.notes.map((x) => <li>{x}</li>)}</ul></details> : null}
      </section>

      <Inflation p={p} d={d} save={save} />

      {!twelve && <section class={`fe-decision ${tone}`} role="status">
        <div><b>{R.decision === 'addendum' ? 'Addendum needed' : R.decision === 'notification' ? 'Notification is enough' : R.direct.planned ? 'No change to the budget' : 'Fill in the planned expenditure'}</b>
          <span>{R.decision === 'addendum' ? ' — EU acceptance and a contract amendment' : R.decision === 'notification' ? ` — every heading stays within ${Math.round(R.flex * 100)}% of the agreement` : ''}</span></div>
        {plug && (E.lines[plug]?.[lastB]?.u ?? 0) === 0 && R.direct.rounded > R.direct.budget + 50 && <p class="fe-over">The other lines already plan <b>{full(R.direct.rounded - R.direct.budget)}</b> more than the budget — {plug} cannot go below zero. Reduce the plan or request an increase of the total (addendum).</p>}
        {R.reasons.length > 0 && <ul>{R.reasons.map((x) => <li>{x}</li>)}</ul>}
        <div class="fe-tot">Direct: budget <b>{full(R.direct.budget)}</b> → proposal <b>{full(R.direct.rounded)}</b> · total eligible <b>{full(R.total.rounded)}</b> · planned <b>{full(R.direct.planned)}</b></div>
      </section>}

      {!twelve && <div class="fe-heads">{R.heads.filter((h) => h.baseline || h.rounded).map((h) => (
        <div class={`fe-h${h.beyond || h.isNew ? ' bad' : Math.abs(h.change) > R.flex * 0.7 ? ' warn' : ''}`}>
          <span>{h.code} {h.label}</span><b>{pc(h.change)}</b><small>{full(h.baseline)} → {full(h.rounded)}</small>
          <i style={{ width: `${Math.min(100, Math.abs(h.change) / R.flex * 100)}%` }} />
        </div>))}</div>}

      <div class="fe-dl" role="toolbar" aria-label="Download the forecast">
        <span><b>Download</b> · {d.opt.programme} · {FORECAST_KINDS[d.opt.kind].label}{opt.change ? ` · ${opt.change} n°${d.opt.changeNo ?? '…'}` : ''}</span>
        <button class="btn" title="Working file for the project team: the rounded proposal and variation columns hidden (guidelines, step 7)" onClick={() => xlsx('team')}>⤓ For the project team</button>
        <button class="btn" title="Every sheet and column visible" onClick={() => xlsx('working')}>⤓ Working file</button>
        {!twelve && <button class="btn primary" title="Budget presentation and variation with values only, the forecast sheet hidden (guidelines, steps 9–10)" onClick={() => {
          if (d.opt.programme === 'JP' && !d.opt.changeNo && !confirm(`No ${opt.change} number yet (PMM → Documents → Contract, or the RFO). Download without it?`)) return;
          xlsx('donor');
        }}>⤓ Donor version</button>}
        <button class="btn" title="Revision note (Word / PDF) and the interim financial report (Excel), with your logos" onClick={() => setNote(true)}>📄 Reports</button>
        {note && <ForecastNote p={p} d={d} opt={opt} close={() => setNote(false)} />}
        {bad.length > 0 && <span class="fe-dl-warn" title={bad.join('\n')}>⚠ {bad.length} unit{bad.length > 1 ? 's' : ''} to check</span>}
      </div>
      <section class="card">
        <div class="card-b table-scroll">
          <table class="mini fe-t">
            <thead>
              <tr><th rowSpan={2}>Line</th><th rowSpan={2}>Unit</th><th colSpan={3} class="c">Budget for all years</th><th colSpan={2} class="c">Actual</th><th rowSpan={2} class="r">Spent + committed</th>
                {R.blocks.map((b) => <th colSpan={3} class="c">{b.label}<small>{date(b.from)} → {date(b.to)}</small></th>)}
                {!twelve && <><th rowSpan={2} class="r">Proposal (rounded)</th><th rowSpan={2} class="r">Variation</th></>}</tr>
              <tr><th class="r">Units</th><th class="r">Rate</th><th class="r">Cost</th><th class="r">Units</th><th class="r">Rate</th>{R.blocks.map(() => <><th class="r">Units</th><th class="r">Rate</th><th class="r">Cost</th></>)}</tr>
            </thead>
            <tbody>
              {['1', '2', '3', '4', '5', '6'].map((h) => {
                const ls = shown.filter((l) => l.code.split('.')[0] === h), hd = R.heads.find((x) => x.code === h)!;
                if (!ls.length) return null;
                return <>
                  <tr class="fe-hr"><td colSpan={2}><b>{h} {hd.label}</b></td><td /><td /><td class="r num">{num(hd.budget)}</td><td /><td /><td />{R.blocks.map(() => <><td /><td /><td /></>)}
                    {!twelve && <><td class="r num"><b>{num(hd.rounded)}</b></td><td class={`r num ${hd.beyond ? 'bad' : ''}`}>{pc(hd.change)}</td></>}</tr>
                  {ls.map((l) => (
                    <tr class={l.empty ? 'fe-empty' : ''}>
                      <td><span class="num muted">{l.code}</span> {l.description}</td><td class="muted">{l.unit}</td>
                      <td class="r num">{l.bUnits ? +l.bUnits.toFixed(2) : ''}</td><td class="r num">{l.rate ? num(l.rate) : ''}</td><td class="r num">{l.budget ? num(l.budget) : ''}</td>
                      <td class={`r num${l.bUnits && l.aUnits > l.bUnits ? ' bad' : ''}`} title={l.bUnits ? `${+(l.bUnits - l.aUnits).toFixed(2)} units left in the budget` : ''}>{l.aUnits ? +l.aUnits.toFixed(2) : ''}</td><td class={`r num${l.rate && l.aRate > l.rate * 1.15 ? ' warn' : ''}`}>{l.aRate ? num(l.aRate) : ''}</td>
                      <td class="r num">{l.sc ? num(l.sc) : ''}</td>
                      {R.blocks.map((b) => { const c = d.lines[l.code]?.[b.id], cls = l.staff || l.cb ? 'fe-in g' : 'fe-in y'; return <>
                        <td>{plug === l.code && b.id === lastB ? <span class="fe-auto" title="Calculated so the direct costs stay equal to the budget">{E.lines[l.code]?.[b.id]?.u ?? 0} <small>auto</small></span> : <input class={`${cls}${odd(l, b.id) ? ' odd' : ''}`} title={odd(l, b.id) ?? ''} inputMode="decimal" value={c?.u ?? ''} onChange={(e) => setCell(l.code, b.id, 'u', (e.target as HTMLInputElement).value)} aria-label={`${l.code} ${b.label} units`} />}</td>
                        <td><input class={cls} inputMode="decimal" value={c?.r ?? ''} placeholder={(l.defRates?.[b.id] ?? l.defRate) ? String(Math.round((l.defRates?.[b.id] ?? l.defRate)!)) : ''} onChange={(e) => setCell(l.code, b.id, 'r', (e.target as HTMLInputElement).value)} aria-label={`${l.code} ${b.label} rate`} /></td>
                        <td class="r num">{l.cells[b.id]?.cost ? num(l.cells[b.id]!.cost) : ''}</td></>; })}
                      {!twelve && <><td class="r num">{l.rounded ? num(l.rounded) : ''}</td><td class={`r num ${l.variation != null && l.variation > 0.25 ? 'warn' : ''}`}>{pc(l.variation)}</td></>}
                    </tr>))}
                </>;
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p class="muted" style={{ fontSize: '12px' }}>An empty rate uses the grey one: staff at the latest cost plus the guideline margin, 4.2 / 4.4 at the latest monthly rate, other lines at the budget rate. Saved with the project; the Excel carries what is typed here, and the 25% check is made on the sub-totals against the amounts originally agreed (EU–CoE rules).</p>
    </div>
  );
}

/** Local salary projection: the Türkiye raise policy on known and assumed CPI, and the EUR/TRY assumption. */
function Inflation({ p, d, save }: { p: Project; d: ForecastDraft; save: (x: ForecastDraft) => void }) {
  const s: InflationSettings = d.infl ?? { on: false };
  const set = (x: Partial<InflationSettings>) => save({ ...d, infl: { ...s, ...x } });
  const per = forecastPeriod(p, TODAY, d.opt), end = (d.opt.extendTo && d.opt.extendTo > p.end ? d.opt.extendTo : p.end).slice(0, 7);
  const path = salaryPath(end, s), ev = path.events.filter((e) => e.month > per.asAt.slice(0, 7));
  const blocks = computePlan(p, TODAY, d).blocks;
  // Actual CPI typed in as TurkStat publishes it (around the 3rd of each month): it replaces the assumption for that month.
  const extra = s.extra ?? {}, lastKnown = path.lastKnown, nextMonth = (() => { const [y, m] = lastKnown.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; })();
  const [cpiIn, setCpiIn] = useState('');
  const addCpi = () => { const v = Number(cpiIn.trim().replace(',', '.')); if (!Number.isFinite(v) || cpiIn.trim() === '' || Math.abs(v) > 50) { toast('Type the monthly CPI in %, e.g. 1,85'); return; } set({ extra: { ...extra, [nextMonth]: v } }); setCpiIn(''); toast(`CPI ${nextMonth}: ${v.toFixed(2)}% saved — raises recalculated`); };
  const dropCpi = (k: string) => { const e = { ...extra }; delete e[k]; set({ extra: e }); };
  const numIn = (k: keyof InflationSettings, ph: string, w = 64) => <input type="number" step="0.01" style={{ width: `${w}px` }} value={(s[k] as number | undefined) ?? ''} placeholder={ph} onChange={(e) => set({ [k]: (e.target as HTMLInputElement).value === '' ? undefined : Number((e.target as HTMLInputElement).value) })} />;
  return (
    <section class={`card fe-inf${s.on ? ' on' : ''}`}>
      <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div><h2>📈 Inflation — local salary projection</h2><p>Raise policy: CPI compounded since the last raise above {s.threshold ?? 7}% → {s.raise ?? 7}% raise from the next month (the cumulative rate after a single-month spike) · June triggers and the gap of the financial year go to the January catch-up</p></div>
        <label class="fe-all" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={s.on} onChange={() => set({ on: !s.on })} /> Apply to local staff rates (1.1.1.x)</label>
      </div>
      {s.on && <div class="card-b fe-inf-b">
        <div class="fe-inf-in">
          <label>Monthly CPI after {lastKnown} {numIn('cpi', String(recentCpi(6, s.extra)))} %</label>
          <label>EUR/TRY change per month {numIn('fx', '0')} %</label>
          <label>Threshold {numIn('threshold', '7', 52)} %</label>
          <label>Raise {numIn('raise', '7', 52)} %</label>
        </div>
        <div class="fe-inf-cpi">
          <span>Actual CPI <b>{nextMonth}</b> (TurkStat, monthly %)</span>
          <input type="text" inputMode="decimal" value={cpiIn} placeholder="e.g. 1,85" onInput={(e) => setCpiIn((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && addCpi()} />
          <button class="btn" disabled={cpiIn.trim() === ''} onClick={addCpi}>Add</button>
          {Object.keys(extra).sort().map((k) => <span class="fe-cpi-chip">{k} · {extra[k].toFixed(2)}% <button aria-label={`Remove ${k}`} onClick={() => dropCpi(k)}>✕</button></span>)}
          <small class="muted">Every month you add replaces the assumption; the raises and the effect above are recalculated at once.</small>
        </div>
        <div class="fe-inf-g">
          <div><b>Raises expected</b>{ev.length ? <ul>{ev.map((e) => <li class={e.projected ? 'proj' : ''}>{e.month} · {e.kind === 'catch-up' ? 'January catch-up' : e.kind === 'spike' ? 'raise after a spike' : 'raise'} <b>+{e.pct.toFixed(2)}%</b>{e.projected ? ' (projected)' : ''}</li>)}</ul> : <p class="muted">None up to the end date.</p>}</div>
          <div><b>Effect on the monthly cost in euros</b><ul>{blocks.map((b) => { const f = costFactor(per.asAt, b.from, b.to, s); return <li>{b.label}: <b>{f >= 1 ? '+' : ''}{((f - 1) * 100).toFixed(1)}%</b> <small class="muted">({b.from} → {b.to})</small></li>; })}</ul>
            <p class="muted" style={{ fontSize: '12px' }}>Against the average cost per unit of the latest report; leave the EUR/TRY change at 0 when salaries are paid in euros. Known CPI: TurkStat to {CPI_LAST}; the assumption is the average of the last six months unless typed.</p></div>
        </div>
      </div>}
    </section>
  );
}
