import { useMemo, useState } from 'preact/hooks';
import { go, useStore } from '../data/store';
import { money } from '../domain/calc';
import { ALERT_KINDS, alerts, changes, narrative, outcome, scenario, type Alert } from '../domain/insights';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { parseAmount } from '../ui/csv';
import { date, full, pct, short } from '../ui/format';

/* ---------------- alert centre ---------------- */
export function AlertCentre({ projects }: { projects: Project[] }) {
  const A = useMemo(() => alerts(projects, TODAY), [projects]);
  const [area, setArea] = useState('');
  const [sev, setSev] = useState('');
  const areas = [...new Set(A.map((a) => ALERT_KINDS[a.kind] ?? a.kind))];
  const shown = A.filter((a) => (!area || (ALERT_KINDS[a.kind] ?? a.kind) === area) && (!sev || a.severity === sev));
  const code = (a: Alert) => projects.find((p) => p.id === a.projectId)?.code ?? '';
  const n = (s: string) => A.filter((a) => a.severity === s).length;
  return (
    <>
      <section class="hero" aria-label="Alert summary">
        <div class="kpi lead"><span class="label">Open alerts</span><span class="value">{A.length}</span><span class="ctx">finance, staff, reporting, activities</span></div>
        {(['critical', 'serious', 'warning'] as const).map((s) => (
          <button class={`kpi kpi-btn ${sev === s ? 'on' : ''}`} onClick={() => setSev(sev === s ? '' : s)} aria-pressed={sev === s}>
            <span class="label">{s}</span><span class="value" style={{ color: n(s) ? `var(--${s === 'warning' ? 'warn' : s})` : undefined }}>{n(s)}</span><span class="ctx">{sev === s ? 'showing only these — click to clear' : 'click to filter'}</span>
          </button>
        ))}
      </section>
      <section class="card">
        <div class="card-h"><div><h2>Alert centre</h2><p>Everything that needs a decision, most urgent first</p></div>
          <div class="seg" style={{ marginLeft: 'auto' }} role="group" aria-label="Area">
            <button aria-pressed={!area} onClick={() => setArea('')}>All</button>
            {areas.map((x) => <button aria-pressed={area === x} onClick={() => setArea(x)}>{x} <span class="muted">{A.filter((a) => (ALERT_KINDS[a.kind] ?? a.kind) === x).length}</span></button>)}
          </div>
        </div>
        <ul class="att alerts" style={{ marginTop: '12px' }}>
          {shown.map((a) => (
            <li onClick={() => go(`project/${a.projectId}`)}>
              <span class={`badge ${a.severity}`}>{a.severity}</span>
              <div><div class="t"><b class="num">{code(a)}</b> · {a.title}</div><div class="d">{ALERT_KINDS[a.kind] ?? a.kind} · {a.detail}</div></div>
              <span class="num muted" style={{ fontSize: '12px' }}>{a.due ? date(a.due) : ''}</span>
            </li>
          ))}
          {!shown.length && <li style={{ cursor: 'default' }}><span class="badge good">clear</span><div class="d">No alerts in this view.</div><span /></li>}
        </ul>
      </section>
    </>
  );
}

/* ---------------- what changed ---------------- */
export function Changes({ projects }: { projects: Project[] }) {
  const [since, setSince] = useState('');
  const C = changes(projects, since || undefined);
  const tot = C.reduce((s, c) => s + c.spent[1] - c.spent[0], 0);
  const max = Math.max(1, ...C.map((c) => Math.abs(c.spent[1] - c.spent[0])));
  return (
    <section class="card">
      <div class="card-h"><div><h2>What changed</h2><p>{since ? `Latest report vs the last one on or before ${date(since)}` : 'Latest report vs the previous one, per project'} · <b>{full(tot)}</b> new spending</p></div>
        <label class="muted" style={{ marginLeft: 'auto', fontSize: '12.5px', display: 'flex', gap: '6px', alignItems: 'center' }}>Compare with
          <input class="input" type="date" value={since} onInput={(e) => setSince((e.target as HTMLInputElement).value)} style={{ height: '30px' }} /></label>
      </div>
      <div class="card-b table-scroll">
        <table class="mini chg-t">
          <thead><tr><th>Project</th><th>Period</th><th class="r">Spent before</th><th class="r">Spent now</th><th>Change</th><th class="r">Exposure Δ</th><th class="r">Lines</th><th>Notes</th></tr></thead>
          <tbody>{C.map((c) => { const d = c.spent[1] - c.spent[0]; return (
            <tr class="click" onClick={() => go(`project/${c.project.id}`)}>
              <td><b class="num">{c.project.code}</b> <span class="muted">{c.project.name}</span></td>
              <td class="num" style={{ whiteSpace: 'nowrap' }}>{c.from ? date(c.from) : '—'} → {c.to ? date(c.to) : '—'}</td>
              <td class="r num">{short(c.spent[0])}</td><td class="r num">{short(c.spent[1])}</td>
              <td style={{ minWidth: '140px' }}><div class="delta-bar"><span style={{ width: `${Math.abs(d) / max * 100}%`, background: d < 0 ? 'var(--serious)' : 'var(--c1)' }} /><b class="num">{d >= 0 ? '+' : '−'}{short(Math.abs(d)).replace('−', '')}</b></div></td>
              <td class="r num">{short(c.exposure[1] - c.exposure[0])}</td><td class="r num">{c.lines}</td><td class="muted">{c.note.join(', ')}</td>
            </tr>); })}</tbody>
        </table>
        {!C.length && <p class="muted">No project has two reports to compare yet.</p>}
      </div>
    </section>
  );
}

/* ---------------- history ---------------- */
export function History({ project }: { project?: string }) {
  const A = useStore((s) => s.ledger.audit ?? []).filter((e) => !project || e.project === project || e.message.includes(project));
  const [q, setQ] = useState('');
  const shown = A.filter((e) => !q || e.message.toLowerCase().includes(q.toLowerCase())).slice(0, 200);
  const day = (s: string) => s.slice(0, 10);
  return (
    <section class="card">
      <div class="card-h"><div><h2>Change history</h2><p>Every saved change, newest first · kept in this browser with the data</p></div>
        <input class="input" placeholder="Filter…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} style={{ marginLeft: 'auto', width: '180px', height: '30px' }} /></div>
      <ol class="hist">
        {shown.map((e, i) => (
          <li>
            {(i === 0 || day(shown[i - 1].at) !== day(e.at)) && <div class="hist-d">{e.at ? date(day(e.at)) : 'Earlier'}</div>}
            <div class="hist-i"><span class="num muted">{e.at ? new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</span>{e.project && <b class="num">{e.project}</b>}<span>{e.message}</span></div>
          </li>
        ))}
        {!shown.length && <li class="muted" style={{ padding: '12px 0' }}>No changes recorded yet.</li>}
      </ol>
    </section>
  );
}

/* ---------------- project: status in words + forecast ---------------- */
export function StatusWords({ p }: { p: Project }) {
  const S = narrative(p, TODAY);
  const copy = () => navigator.clipboard?.writeText(S.join(' '));
  return (
    <section class="card span-8">
      <div class="card-h"><div><h2>Status in words</h2><p>Written from the figures — ready to paste into a report</p></div><button class="btn ghost" style={{ marginLeft: 'auto' }} onClick={copy}>Copy</button></div>
      <div class="card-b narr">{S.map((x) => <p>{x}</p>)}</div>
    </section>
  );
}

export function ForecastCard({ p }: { p: Project }) {
  const o = outcome(p, TODAY), m = money(p);
  const use = Math.min(1.2, o.utilisation);
  const tone = o.overrun > 1 ? 'critical' : o.utilisation < 0.7 ? 'serious' : o.utilisation < 0.85 ? 'warn' : 'good';
  return (
    <section class="card span-4">
      <div class="card-h"><div><h2>End-of-project forecast</h2><p>{o.basis === 'no data' ? 'Needs at least one report' : `At the ${o.basis}`}</p></div></div>
      <div class="card-b fc">
        <div class="fc-big" style={{ color: `var(--${tone})` }}>{pct(o.utilisation)}<small>of budget used</small></div>
        <div class="meter fc-m"><span style={{ width: `${Math.min(100, use / 1.2 * 100)}%`, background: `var(--${tone})` }} /><i class="tick" style={{ left: `calc(${100 / 1.2}% - 1px)` }} /></div>
        <dl class="fc-dl">
          <dt>Projected spend</dt><dd class="num">{full(o.projected)}</dd>
          <dt>{o.overrun > 1 ? 'Over budget' : 'Likely unused'}</dt><dd class="num">{full(o.overrun > 1 ? o.overrun : o.unused)}</dd>
          <dt>Current rate</dt><dd class="num">{full(o.rate)}/mo</dd>
          <dt>Needed to use all</dt><dd class="num">{full(o.needRate)}/mo</dd>
          <dt>Months left</dt><dd class="num">{o.monthsLeft.toFixed(1)}</dd>
          <dt>Remaining budget</dt><dd class="num">{full(m.budget - m.spent)}</dd>
        </dl>
      </div>
    </section>
  );
}

/* ---------------- project: budget revision scenario ---------------- */
export function Scenario({ p }: { p: Project }) {
  const [d, setD] = useState<Record<string, number>>({});
  const [limit, setLimit] = useState(10);
  const S = scenario(p, d, limit / 100);
  if (!S.rows.length) return <div class="card empty-page"><div><h2>No budget lines yet</h2><p>Import a financial report to model a budget revision.</p></div></div>;
  const balance = () => {
    // Puts the net difference on the line with the largest uncommitted balance.
    const best = [...S.rows].sort((a, b) => (b.revised - b.exposure) - (a.revised - a.exposure))[0];
    if (best && !S.balanced) setD({ ...d, [best.code]: (d[best.code] ?? 0) - S.net });
  };
  return (
    <section class="card">
      <div class="card-h"><div><h2>Budget revision scenario</h2><p>Type increases or decreases per line — nothing is saved until you decide; the project data stays unchanged</p></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label class="muted" style={{ fontSize: '12.5px' }}>Flag changes above <input class="input num" type="number" min={1} max={100} value={limit} onInput={(e) => setLimit(Number((e.target as HTMLInputElement).value) || 10)} style={{ width: '56px', height: '30px' }} />%</label>
          <button class="btn" disabled={S.balanced} onClick={balance}>Balance</button>
          <button class="btn ghost" disabled={!Object.keys(d).length} onClick={() => setD({})}>Reset</button>
        </div>
      </div>
      <div class="scn-sum">
        <div><span>Approved total</span><b class="num">{full(S.approved)}</b></div>
        <div><span>Revised total</span><b class="num">{full(S.revised)}</b></div>
        <div><span>Moved between lines</span><b class="num">{full(S.moved)}</b></div>
        <div><span>Net change</span><b class="num" style={{ color: S.balanced ? 'var(--good)' : 'var(--serious)' }}>{S.balanced ? 'balanced' : (S.net > 0 ? '+' : '−') + full(Math.abs(S.net))}</b></div>
        <div><span>Flags</span><b class="num" style={{ color: S.flags ? 'var(--serious)' : undefined }}>{S.flags}</b></div>
      </div>
      <div class="card-b table-scroll">
        <table class="mini scn">
          <thead><tr><th>Line</th><th>Description</th><th class="r">Approved</th><th class="r">Spent + committed</th><th class="r">Change</th><th class="r">Revised</th><th class="r">Δ %</th><th /></tr></thead>
          <tbody>{S.rows.map((r) => (
            <tr class={r.flag ? 'flag' : r.delta ? 'chg' : ''}>
              <td class="num">{r.code}</td><td>{r.description}</td><td class="r num">{full(r.approved)}</td><td class="r num">{full(r.exposure)}</td>
              <td class="r"><input class="input num scn-in" inputMode="decimal" aria-label={`Change for line ${r.code}`} value={r.delta ? String(Math.round(r.delta)) : ''} placeholder="0"
                onChange={(e) => { const v = (e.target as HTMLInputElement).value.trim(); const x = v.startsWith('-') ? -(parseAmount(v.slice(1)) ?? 0) : parseAmount(v) ?? 0; const n = { ...d }; if (x) n[r.code] = x; else delete n[r.code]; setD(n); }} /></td>
              <td class="r num"><b>{full(r.revised)}</b></td><td class="r num">{r.delta ? `${r.share > 0 ? '+' : ''}${(r.share * 100).toFixed(1)}%` : ''}</td>
              <td>{r.flag && <span class="badge serious">{r.flag}</span>}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </section>
  );
}
