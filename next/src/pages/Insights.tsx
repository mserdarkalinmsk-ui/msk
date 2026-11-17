import { flexOf } from '../domain/flex';
import { useMemo, useState } from 'preact/hooks';
import { go, markAlerts, set, useStore } from '../data/store';
import { backReason, snoozeDay, splitAlerts } from '../domain/worklist';
import { Fig } from '../ui/Trace';
import { progress } from '../domain/logframe';
import { money } from '../domain/calc';
import { ALERT_KINDS, alerts, changes, headings, readiness, status, outcome, scenario, type Alert } from '../domain/insights';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { parseAmount } from '../ui/csv';
import { date, full, pct, short } from '../ui/format';

/* ---------------- alert centre ---------------- */
type WTab = 'open' | 'snoozed' | 'done' | 'log';
const SNOOZE: [string, number][] = [['1 week', 7], ['2 weeks', 14], ['1 month', 30], ['3 months', 91]];

/** The alerts as a work list: open ones first; each can be marked handled or snoozed with a note, and reopened. */
export function AlertCentre({ projects }: { projects: Project[] }) {
  const marks = useStore((s) => s.ledger.alertMarks), log = useStore((s) => s.ledger.alertLog) ?? [];
  const A = useMemo(() => alerts(projects, TODAY), [projects]);
  const G = useMemo(() => splitAlerts(A, marks, TODAY), [A, marks]);
  const [tab, setTab] = useState<WTab>('open');
  const [area, setArea] = useState('');
  const [sev, setSev] = useState('');
  const [edit, setEdit] = useState<{ key: string; mode: 'done' | 'snoozed' } | null>(null);
  const list = tab === 'log' ? [] : G[tab];
  const areas = [...new Set(list.map((a) => ALERT_KINDS[a.kind] ?? a.kind))];
  const shown = list.filter((a) => (!area || (ALERT_KINDS[a.kind] ?? a.kind) === area) && (!sev || a.severity === sev));
  const proj = (a: Alert) => projects.find((p) => p.id === a.projectId);
  const item = (a: Alert) => ({ key: a.key, title: a.title, project: proj(a)?.code, severity: a.severity });
  const n = (s: string) => G.open.filter((a) => a.severity === s).length;
  const go_ = (t: WTab) => { setTab(t); setArea(''); setEdit(null); };
  return (
    <>
      <section class="hero" aria-label="Alert summary">
        <div class="kpi lead"><span class="label">Open alerts</span><span class="value">{G.open.length}</span><span class="ctx">{G.done.length + G.snoozed.length ? `${G.done.length} handled · ${G.snoozed.length} snoozed` : 'finance, staff, reporting, activities'}</span></div>
        {(['critical', 'serious', 'warning'] as const).map((s) => (
          <button class={`kpi kpi-btn ${sev === s ? 'on' : ''}`} onClick={() => { setSev(sev === s ? '' : s); setTab('open'); }} aria-pressed={sev === s}>
            <span class="label">{s}</span><span class="value" style={{ color: n(s) ? `var(--${s === 'warning' ? 'warn' : s})` : undefined }}>{n(s)}</span><span class="ctx">{sev === s ? 'showing only these — click to clear' : 'click to filter'}</span>
          </button>
        ))}
      </section>
      <section class="card wl">
        <div class="card-h"><div><h2>Alert centre</h2><p>{tab === 'open' ? 'What still needs a decision, most urgent first — mark an item handled or put it off, with a note' : tab === 'snoozed' ? 'Put off until a date; they come back on their own' : tab === 'done' ? 'Handled while the condition lasts; an item comes back if it gets more serious' : 'Every decision taken on an alert, newest first'}</p></div>
          <div class="seg" style={{ marginLeft: 'auto' }} role="tablist" aria-label="Work list">
            {([['open', 'Open', G.open.length], ['snoozed', 'Snoozed', G.snoozed.length], ['done', 'Handled', G.done.length], ['log', 'History', log.length]] as [WTab, string, number][]).map(([k, l, c]) => <button role="tab" aria-pressed={tab === k} onClick={() => go_(k)}>{l} <span class="muted">{c}</span></button>)}
          </div>
        </div>
        {tab !== 'log' && areas.length > 1 && <div class="wl-areas" role="group" aria-label="Area">
          <button class={`chipb ${!area ? 'on' : ''}`} onClick={() => setArea('')}>All</button>
          {areas.map((x) => <button class={`chipb ${area === x ? 'on' : ''}`} onClick={() => setArea(area === x ? '' : x)}>{x} <span>{list.filter((a) => (ALERT_KINDS[a.kind] ?? a.kind) === x).length}</span></button>)}
          {tab === 'open' && shown.length > 1 && (area || sev) && <button class="btn ghost wl-all" onClick={() => markAlerts(shown.map(item), { state: 'done' })}>Mark these {shown.length} as handled</button>}
        </div>}
        {tab === 'log' ? (
          log.length ? <div class="table-scroll"><table class="mini wl-log"><thead><tr><th>When</th><th>Project</th><th>Alert</th><th>Decision</th><th>Note</th></tr></thead>
            <tbody>{log.slice(0, 200).map((e) => <tr><td class="num">{date(e.at.slice(0, 10))}</td><td class="num">{e.project ?? '—'}</td><td>{e.title}</td>
              <td><span class={`badge ${e.action === 'done' ? 'good' : e.action === 'snoozed' ? 'info' : 'neutral'}`}>{e.action === 'done' ? 'handled' : e.action === 'snoozed' ? `snoozed until ${e.until ? date(e.until) : '—'}` : 'reopened'}</span></td><td class="muted">{e.note ?? ''}</td></tr>)}</tbody></table></div>
            : <p class="wl-empty">No decision recorded yet. Mark an open alert as handled or snooze it — it is kept here with your note.</p>
        ) : (
          <ul class="wl-list alerts">
            {shown.map((a) => { const m = marks?.[a.key], back = tab === 'open' ? backReason(a, marks, TODAY) : undefined, ed = edit?.key === a.key ? edit.mode : null;
              return (
                <li class={`sev-${a.severity}${ed ? ' ed' : ''}`}>
                  <span class={`badge ${a.severity}`}>{a.severity}</span>
                  <button class="wl-main" onClick={() => go(`project/${a.projectId}`)} title="Open the project">
                    <span class="t"><b class="num">{proj(a)?.code ?? ''}</b> · {a.title}{back && <em class="wl-back">{back}</em>}</span>
                    <span class="d">{ALERT_KINDS[a.kind] ?? a.kind} · {a.detail}{a.due ? ` · due ${date(a.due)}` : ''}</span>
                    {tab !== 'open' && m && <span class="wl-note">{tab === 'done' ? `Handled ${date(m.at.slice(0, 10))}` : `Snoozed until ${m.until ? date(m.until) : '—'}`}{m.note ? ` — ${m.note}` : ''}</span>}
                  </button>
                  <span class="wl-act">
                    {tab === 'open' ? <>
                      <button class="btn" aria-pressed={ed === 'done'} onClick={() => setEdit(ed === 'done' ? null : { key: a.key, mode: 'done' })}>✓ Handled</button>
                      <button class="btn" aria-pressed={ed === 'snoozed'} onClick={() => setEdit(ed === 'snoozed' ? null : { key: a.key, mode: 'snoozed' })}>Snooze</button>
                    </> : <button class="btn" onClick={() => markAlerts([item(a)], null)}>Reopen</button>}
                  </span>
                  {ed && <MarkForm mode={ed} onCancel={() => setEdit(null)} onSave={(note, until) => { markAlerts([item(a)], { state: ed, note, until }); setEdit(null); }} />}
                </li>
              ); })}
            {!shown.length && <li class="wl-none"><span class="badge good">clear</span><span>{tab === 'open' ? 'No open alerts in this view.' : tab === 'snoozed' ? 'Nothing is snoozed.' : 'Nothing marked as handled.'}</span></li>}
          </ul>
        )}
      </section>
    </>
  );
}

/** The note and, for a snooze, the date an alert comes back. */
function MarkForm({ mode, onSave, onCancel }: { mode: 'done' | 'snoozed'; onSave: (note: string, until?: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState(''), [until, setUntil] = useState(snoozeDay(TODAY, 14));
  const min = snoozeDay(TODAY, 1), ok = mode === 'done' || until >= min;
  return (
    <form class="wl-form" onSubmit={(e) => { e.preventDefault(); if (ok) onSave(note, mode === 'snoozed' ? until : undefined); }}>
      {mode === 'snoozed' && <div class="wl-when"><span>Come back in</span>{SNOOZE.map(([l, d]) => <button type="button" class={`chipb ${until === snoozeDay(TODAY, d) ? 'on' : ''}`} onClick={() => setUntil(snoozeDay(TODAY, d))}>{l}</button>)}
        <input class="input" type="date" min={min} value={until} aria-label="Snooze until" onInput={(e) => setUntil((e.target as HTMLInputElement).value)} /></div>}
      <input class="input wl-in" autoFocus maxLength={240} placeholder={mode === 'done' ? 'What was done (optional) — e.g. notification letter sent on 12 November' : 'Why it can wait (optional)'} value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
      <button type="button" class="btn ghost" onClick={onCancel}>Cancel</button>
      <button class="btn primary" disabled={!ok}>{mode === 'done' ? 'Mark as handled' : 'Snooze'}</button>
    </form>
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
        <label class="muted" style={{ marginLeft: 'auto', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}>Compare with
          <input class="input" type="date" value={since} onInput={(e) => setSince((e.target as HTMLInputElement).value)} style={{ height: '30px' }} /></label>
      </div>
      <div class="card-b table-scroll">
        <table class="mini chg-t">
          <thead><tr><th>Project</th><th>Period</th><th class="r">Spent before</th><th class="r">Spent now</th><th>Change</th><th class="r">Spent + committed change</th><th class="r">Lines</th><th>Notes</th></tr></thead>
          <tbody>{C.map((c) => { const d = c.spent[1] - c.spent[0]; return (
            <tr class="click" onClick={() => go(`project/${c.project.id}`)}>
              <td><b class="num">{c.project.code}</b> <span class="muted">{c.project.name}</span></td>
              <td class="num" style={{ whiteSpace: 'nowrap' }}>{c.from ? date(c.from) : '—'} → {c.to ? date(c.to) : '—'}</td>
              <td class="r num">{full(c.spent[0])}</td><td class="r num">{full(c.spent[1])}</td>
              <td style={{ minWidth: '140px' }}><div class="delta-bar"><span style={{ width: `${Math.abs(d) / max * 100}%`, background: d < 0 ? 'var(--serious)' : 'var(--c1)' }} /><b class="num">{d > -0.5 ? '+' : ''}{short(d)}</b></div></td>
              <td class="r num">{full(c.exposure[1] - c.exposure[0])}</td><td class="r num">{c.lines}</td><td class="muted">{c.note.join(', ')}</td>
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
        <input class="input" aria-label="Filter the history" placeholder="Filter…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} style={{ marginLeft: 'auto', width: '180px', height: '30px' }} /></div>
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
  const S = status(p, TODAY);
  const [done, setDone] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(S.plain); setDone(true); setTimeout(() => setDone(false), 1500); };
  return (
    <section class={`card span-8 stw tone-${S.tone}`}>
      <div class="stw-top">
        <span class="stw-verdict">{S.verdict}</span>
        <button class="btn ghost" style={{ marginLeft: 'auto', height: '28px' }} onClick={copy}>{done ? 'Copied ✓' : 'Copy as text'}</button>
      </div>
      <h3 class="stw-head">{S.headline}</h3>
      <ul class="stw-list">
        {S.points.map((x) => (
          <li class={`t-${x.tone}`}>
            <span class="stw-area">{x.area}</span>
            <div><b>{x.head}</b><small>{x.text}</small></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ForecastCard({ p }: { p: Project }) {
  const o = outcome(p, TODAY), m = money(p);
  const use = Math.min(1.2, o.utilisation);
  const tone = o.overrun > 1 ? 'critical' : o.utilisation < 0.7 ? 'serious' : o.utilisation < 0.85 ? 'warn' : 'good';
  return (
    <section class="card span-4 fc-card">
      <div class="card-h"><div><h2>End-of-project forecast</h2><p>{o.basis === 'no data' ? 'Needs at least one report' : o.basis === 'recent rate' ? 'Average since start, adjusted for recent months' : 'Average monthly spend since start'}</p></div></div>
      <div class="card-b fc">
        <div class="fc-big" style={{ color: `var(--${tone})` }}>{pct(o.utilisation)}<small>of budget used</small></div>
        <div class="meter fc-m"><span style={{ width: `${Math.min(100, use / 1.2 * 100)}%`, background: `var(--${tone})` }} /><i class="tick" style={{ left: `calc(${100 / 1.2}% - 1px)` }} /></div>
        <dl class="fc-dl">
          <dt>Projected spend</dt><dd class="num"><Fig p={p} f="projected">{full(o.projected)}</Fig></dd>
          <dt>{o.overrun > 1 ? 'Over budget' : 'Likely unused'}</dt><dd class="num">{o.overrun > 1 ? full(o.overrun) : <Fig p={p} f="unused">{full(o.unused)}</Fig>}</dd>
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
  const [limit, setLimit] = useState(Math.round(flexOf(p) * 100)); // heading flexibility of the project
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
          <label class="muted" style={{ fontSize: '13px' }}>Flag changes above <input class="input num" type="number" min={1} max={100} value={limit} onInput={(e) => setLimit(Number((e.target as HTMLInputElement).value) || 10)} style={{ width: '56px', height: '30px' }} />%</label>
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
          <thead><tr><th>Line</th><th>Description</th><th class="r">Approved</th><th class="r">Spent + committed</th><th class="r">Change</th><th class="r">Revised</th><th class="r">Change %</th><th /></tr></thead>
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

/* ---------------- project: budget headings vs approved baseline ---------------- */
export function HeadingsCard({ p }: { p: Project }) {
  const H = headings(p);
  if (!H.rows.length) return null;
  const T = { good: 'good', ok: 'good', warn: 'warning', breach: 'serious' } as const;
  return (
    <section class="card span-12">
      <div class="card-h"><div><h2>Budget headings vs approved budget</h2><p>Transfers between headings up to {Math.round(H.flex * 100)}% need no amendment{p.approvedBudget ? ` · baseline: ${p.approvedBudget.source}` : ' · no approved budget on file, the latest report is used'}</p></div></div>
      <div class="card-b table-scroll">
        <table class="mini hd">
          <thead><tr><th>Heading</th><th class="r">Approved baseline</th><th class="r">Current budget</th><th class="r">Change</th><th class="r">Spent + committed</th><th>Use of heading</th><th /></tr></thead>
          <tbody>{H.rows.map((r) => (
            <tr>
              <td><b>{r.code}</b> {r.label}</td><td class="r num">{full(r.baseline)}</td><td class="r num">{full(r.approved)}</td>
              <td class="r num" style={{ color: Math.abs(r.change) > H.flex ? 'var(--serious)' : undefined }}>{Math.abs(r.change) >= 0.0005 ? `${r.change > 0 ? '+' : ''}${(r.change * 100).toFixed(1)}%` : '—'}</td>
              <td class="r num">{full(r.exposure)}</td>
              <td style={{ minWidth: '160px' }}><div class="minibar"><span style={{ width: `${Math.min(100, r.baseline ? r.exposure / r.baseline * 100 : 0)}%`, background: r.overspend > 0 ? 'var(--serious)' : 'var(--c1)' }} /><i style={{ left: '100%' }} /></div></td>
              <td><span class={`badge ${T[r.status]}`}>{r.status === 'ok' ? 'within' : r.status === 'warn' ? 'watch' : 'amendment'}</span></td>
            </tr>))}</tbody>
          <tfoot class="hd-f">
            {([['Total direct costs', H.direct], ['Administrative costs (indirect)', H.admin], ...(H.contingency ? [['Contingency reserve', { baseline: H.contingency, approved: H.contingency, exposure: 0 }]] : []), ['Total budget', H.total]] as [string, { baseline: number; approved: number; exposure: number }][]).map(([k, v], i, a) => {
              const ch = v.baseline ? (v.approved - v.baseline) / v.baseline : 0;
              return <tr class={i === a.length - 1 ? 'hd-total' : ''}><td>{k}</td><td class="r num">{full(v.baseline)}</td><td class="r num">{full(v.approved)}</td><td class="r num">{Math.abs(ch) >= 0.0005 ? `${ch > 0 ? '+' : ''}${(ch * 100).toFixed(1)}%` : '—'}</td><td class="r num">{full(v.exposure)}</td>
                <td><div class="minibar"><span style={{ width: `${Math.min(100, v.baseline ? v.exposure / v.baseline * 100 : 0)}%`, background: 'var(--c1)' }} /></div></td><td class="muted num">{v.baseline ? `${Math.round(v.exposure / v.baseline * 100)}%` : ''}</td></tr>;
            })}
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/* ---------------- project: set-up completeness ---------------- */
export function ReadinessCard({ p }: { p: Project }) {
  const R = readiness(p);
  return (
    <section class="card span-12 rd">
      <div class="card-h"><div><h2>Project file · {Math.round(R.score * 100)}% complete</h2><p>What has been read from documents and reports — open an item to add what is missing</p></div>
        <button class="btn primary" style={{ marginLeft: 'auto' }} onClick={() => set({ drawer: { kind: 'documents', projectId: p.id } })}>Add documents</button></div>
      <ol class="rd-list">{R.items.map((i) => (
        <li class={i.done ? 'ok' : ''}><span class="rd-dot" aria-hidden="true">{i.done ? '✓' : ''}</span><div><b>{i.label}</b><small>{i.hint}</small></div></li>
      ))}</ol>
    </section>
  );
}

/* ---------------- portfolio: compliance & results ---------------- */
export function Compliance({ projects }: { projects: Project[] }) {
  const rows = projects.map((p) => {
    const R = readiness(p), H = headings(p), I = p.indicators ?? [];
    const P = I.map(progress).filter((v): v is number => v != null);
    return { p, ready: R.score, missing: R.items.filter((i) => !i.done).map((i) => i.label), breach: H.rows.filter((r) => r.status === 'breach').length, watch: H.rows.filter((r) => r.status === 'warn').length, ok: H.rows.length > 0, ind: I.length, prog: P.length ? P.reduce((a, b) => a + Math.min(1, b), 0) / P.length : null };
  }).sort((a, b) => a.ready - b.ready);
  const avg = rows.length ? rows.reduce((s, r) => s + r.ready, 0) / rows.length : 0;
  return (
    <>
      <section class="hero" aria-label="Compliance summary">
        <div class="kpi lead"><span class="label">Project files complete</span><span class="value">{Math.round(avg * 100)}%</span><span class="ctx">average over {rows.length} projects</span></div>
        <div class="kpi"><span class="label">Headings beyond flexibility</span><span class="value" style={{ color: rows.some((r) => r.breach) ? 'var(--serious)' : undefined }}>{rows.reduce((s, r) => s + r.breach, 0)}</span><span class="ctx">need a budget amendment</span></div>
        <div class="kpi"><span class="label">Indicators tracked</span><span class="value">{rows.reduce((s, r) => s + r.ind, 0)}</span><span class="ctx">{rows.filter((r) => r.prog != null).length} projects with measured progress</span></div>
        <div class="kpi"><span class="label">Set-up incomplete</span><span class="value">{rows.filter((r) => r.p.datesTbc).length}</span><span class="ctx">dates and budget to confirm</span></div>
      </section>
      <section class="card">
        <div class="card-h"><div><h2>Compliance & results by project</h2><p>Least complete first · click a project to open it</p></div></div>
        <div class="card-b table-scroll">
          <table class="mini chg-t">
            <thead><tr><th>Project</th><th>Project file</th><th>Missing</th><th class="r">Headings</th><th>Results</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr class="click" onClick={() => go(`project/${r.p.id}`)}>
                <td><b class="num">{r.p.code}</b> <span class="muted">{r.p.name}</span></td>
                <td style={{ minWidth: '150px' }}><div class="delta-bar"><span style={{ width: `${r.ready * 100}%`, background: r.ready >= 0.8 ? 'var(--good)' : r.ready >= 0.5 ? 'var(--c1)' : 'var(--warn)' }} /><b class="num">{Math.round(r.ready * 100)}%</b></div></td>
                <td class="muted" style={{ fontSize: '12px' }}>{r.missing.slice(0, 4).join(', ')}{r.missing.length > 4 ? ` +${r.missing.length - 4}` : ''}</td>
                <td class="r">{r.p.datesTbc || !r.ok ? <span class="muted">—</span> : r.breach ? <span class="badge serious">{r.breach} amendment</span> : r.watch ? <span class="badge warning">{r.watch} watch</span> : <span class="badge good">within</span>}</td>
                <td>{r.prog != null ? <div class="delta-bar"><span style={{ width: `${r.prog * 100}px`, background: 'var(--c1)' }} /><b class="num">{Math.round(r.prog * 100)}%</b></div> : <span class="muted">{r.ind ? `${r.ind} indicators, none measured` : 'no logframe'}</span>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
