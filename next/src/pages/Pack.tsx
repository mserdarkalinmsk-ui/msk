import { BAND_COLOR, bandOf } from '../ui/viz';
import { OfficeSummary } from './OfficeSummary';
import { ProviderBrief } from './Providers';
import { filtered, get, go, set, useStore } from '../data/store';
import { monthSummaryDocx } from './MonthSummary';
import { asOf, deadlines, elapsed, money, parseDate, portfolioSeries, totals } from '../domain/calc';
import { Chart } from '../ui/Chart';
import { endMarks, spendOption } from './Overview';
import { alerts } from '../domain/insights';
import { openAlerts } from '../domain/worklist';
import { perfTrend, warningScore } from '../domain/monitor';
import { renewals, roster } from '../domain/staff';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, month, short } from '../ui/format';
import { Compare } from './Studio';
import { decisions, type Decision, KIND_INFO, kindUnit } from '../domain/decisions';
import { plabel } from '../domain/label';

/** Monitoring band of a performance ratio, as in the CoE monitoring sheet. */
const band = bandOf;
const BAND_C: Record<string, string> = BAND_COLOR;
const p0 = (v: number) => `${Math.round(v * 100)}%`;
const lab = (p: Project) => (plabel(p));
const pts = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} pts`;

export interface Move { p: Project; perf: number; prev: number | null; spent: number; added: number; from?: string; to?: string; was: string | null; now: string }

/** Latest report vs the previous one for each project: spend added, performance change and band transition. */
export function moves(P: Project[]): Move[] {
  return P.filter((p) => !p.datesTbc).map((p) => {
    const m = money(p), pl = m.budget * elapsed(p, asOf(p, TODAY)), perf = pl ? m.spent / pl : 0;
    const T = perfTrend(p), a = T.at(-2), b = T.at(-1);
    return { p, perf, prev: a ? a.perf : null, spent: m.spent, added: a && b ? b.spent - a.spent : 0, from: a?.date, to: b?.date, was: a ? band(a.perf) : null, now: band(perf) };
  });
}

export interface Point { label: string; text: string; tone: 'info' | 'good' | 'warn' | 'bad'; /** the projects behind the point, each with why */ items?: { id: string; label: string; why: string; group?: string; tone?: 'bad' | 'warn' | 'good' | 'info'; /** project tab that holds the detail */ to?: string }[] }
const names = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

/** Management summary as short labelled points, built from the figures. */
export function narrative(P: Project[], cname: (id: string) => string): Point[] {
  const M = moves(P);
  if (!M.length) return [{ label: 'Position', text: 'No projects with confirmed dates in this selection.', tone: 'info' }];
  const B = M.reduce((a, x) => a + money(x.p).budget, 0), S = M.reduce((a, x) => a + x.spent, 0);
  const PL = M.reduce((a, x) => a + money(x.p).budget * elapsed(x.p, asOf(x.p, TODAY)), 0), perf = PL ? S / PL : 0;
  const many = new Set(M.map((x) => x.p.country)).size > 1;
  const who = (x: Move) => many ? `${lab(x.p)} (${cname(x.p.country)})` : lab(x.p);
  const out: Point[] = [];
  // Each project carries its band, so the panel can group them: well behind, slightly behind, on plan, above plan.
  const GRP: Record<string, { group: string; tone: 'bad' | 'warn' | 'good' | 'info' }> = { red: { group: 'Well behind (under 70%)', tone: 'bad' }, amber: { group: 'Slightly behind (70–90%)', tone: 'warn' }, green: { group: 'On plan', tone: 'good' }, blue: { group: 'Above plan', tone: 'info' } };
  const it = (x: Move, why: string, g?: { group: string; tone: 'bad' | 'warn' | 'good' | 'info' }, to = 'summary') => ({ id: x.p.id, label: `${who(x)} · ${x.p.name}`, why, to, ...(g ?? GRP[x.now] ?? {}) });
  const base = (x: Move) => `${p0(x.perf)} of what should be spent by now · spent ${short(x.spent)} of ${short(money(x.p).budget)}`;
  const verdict = perf >= 1 ? 'ahead of plan' : perf >= 0.9 ? 'on track' : perf >= 0.7 ? 'somewhat behind plan' : 'well behind plan';
  out.push({ label: 'Position', tone: perf >= 0.9 ? 'good' : perf >= 0.7 ? 'warn' : 'bad',
    text: `${M.length} projects have spent ${short(S)} of their ${short(B)} budget (${p0(B ? S / B : 0)}). By now ${short(PL)} should have been spent, so spending is at ${p0(perf)} of plan — ${verdict}.`, items: [...M].sort((a, b) => a.perf - b.perf).map((x) => it(x, base(x))) });
  const cnt = (b: string) => M.filter((x) => x.now === b).length;
  const parts = [['blue', 'above plan'], ['green', 'on plan'], ['amber', 'slightly behind (70–90%)'], ['red', 'well behind (under 70%)']].filter(([b]) => cnt(b)).map(([b, w]) => `${cnt(b)} ${w}`);
  out.push({ label: 'Projects', tone: cnt('red') ? 'bad' : cnt('amber') ? 'warn' : 'good', text: cnt('red') === M.length ? `All ${M.length} projects are well behind plan (under 70%).` : `${names(parts)}.`, items: [...M].sort((a, b) => a.perf - b.perf).map((x) => it(x, base(x))) });
  const added = M.reduce((a, x) => a + x.added, 0);
  const D = M.filter((x) => x.prev != null).map((x) => ({ x, d: x.perf - x.prev! })).sort((a, b) => b.d - a.d);
  if (added) {
    const best = D[0] && D[0].d > 0.02 ? ` Biggest improvement: ${who(D[0].x)}, ${pts(D[0].d)}.` : '';
    const worst = D.at(-1) && D.at(-1)!.d < -0.02 ? ` Biggest slip: ${who(D.at(-1)!.x)}, ${pts(D.at(-1)!.d)}.` : '';
    // A fall in recorded spending, or a swing of more than 100 points, means two reports that do not cover the same thing.
    const odd = D.filter((d) => Math.abs(d.d) > 1).map((d) => who(d.x));
    const sinceItems = [...D].map(({ x, d }) => it(x, `${short(x.added)} added since the previous report; ${p0(x.prev!)} → ${p0(x.perf)} of plan (${pts(d)})`, d > 0.02 ? { group: 'Improved', tone: 'good' } : d < -0.02 ? { group: 'Slipped', tone: 'bad' } : { group: 'About the same', tone: 'info' }));
    out.push(added < 0 || odd.length
      ? { label: 'Since last report', tone: 'warn', text: `${added < 0 ? `Recorded spending is ${short(-added)} lower than in the previous reports` : `${short(added)} of new spending recorded`}${odd.length ? ` — the last two reports of ${names(odd)} do not look comparable (different budget or coverage); check which report is the current one.` : ' — corrections or reversals; check the latest reports.'}` }
      : { label: 'Since last report', tone: 'info', text: `${short(added)} of new spending recorded.${best}${worst}` });
    out.at(-1)!.items = sinceItems;
  }
  const order = ['blue', 'green', 'amber', 'red'];
  const worse = M.filter((x) => x.was && order.indexOf(x.now) > order.indexOf(x.was));
  if (worse.length) out.push({ label: 'Downgraded', tone: 'warn', text: `${names(worse.map((x) => `${who(x)} ${x.was} → ${x.now}`))}.`, items: worse.map((x) => it(x, `${x.was} → ${x.now}: ${p0(x.prev ?? 0)} → ${p0(x.perf)} of plan since the previous report`)) });
  const red = M.filter((x) => x.now === 'red').sort((a, b) => a.perf - b.perf);
  if (red.length) out.push({ label: 'Needs action', tone: 'bad', text: `${names(red.slice(0, 5).map((x) => `${who(x)} at ${p0(x.perf)}`))} of planned spending${red.length > 5 ? `, and ${red.length - 5} more` : ''}.`, items: red.map((x) => { const pl = money(x.p).budget * elapsed(x.p, asOf(x.p, TODAY)); return it(x, `${p0(x.perf)} of planned spending: ${short(x.spent)} spent, ${short(pl)} planned by now — ${short(Math.max(0, pl - x.spent))} behind`); }) });
  const high = M.filter((x) => warningScore(x.p, TODAY, { perf: x.perf, scp: x.perf, staffRatio: 0 }).level === 'high');
  const od = [...new Set(M.filter((x) => deadlines(x.p, TODAY).some((d) => d.status === 'overdue')).map(who))];
  if (high.length || od.length) out.push({ label: 'Follow-up', tone: 'warn', text: [high.length && `High attention score: ${names(high.map(who))}.`, od.length && `Report overdue: ${names(od)}.`].filter(Boolean).join(' '),
    items: M.filter((x) => high.includes(x) || deadlines(x.p, TODAY).some((d) => d.status === 'overdue')).map((x) => { const sc = warningScore(x.p, TODAY, { perf: x.perf, scp: x.perf, staffRatio: 0 }), o = deadlines(x.p, TODAY).find((d) => d.status === 'overdue');
      return it(x, [high.includes(x) && `attention score ${sc.score} (${sc.parts.filter((q) => q.points > 0).map((q) => q.label.toLowerCase()).join(', ')})`, o && `report due ${date(o.due)} not on file`].filter(Boolean).join(' · '), undefined, o ? 'reports' : 'summary'); }) });
  const ren = M.flatMap((x) => renewals(roster(x.p, TODAY), TODAY, 90));
  const renBy = M.map((x) => ({ x, R: renewals(roster(x.p, TODAY), TODAY, 90) })).filter((y) => y.R.length);
  if (ren.length) { const by = [...new Set(ren.map((r) => r.end).filter(Boolean))].sort(); out.push({ items: renBy.map(({ x, R }) => it(x, `${R.length} contract${R.length > 1 ? 's end' : ' ends'} by ${date(R.at(-1)!.end)}: ${R.map((r) => `${r.display} (${date(r.end)})`).join(', ')}`, undefined, 'staff')), label: 'Staff', tone: 'warn', text: `${ren.length} contract${ren.length > 1 ? 's end' : ' ends'} in the next 90 days${by[0] ? `, the first on ${date(by[0]!)}` : ''}.` }); }
  const ending = M.filter((x) => { const d = (parseDate(x.p.end).getTime() - TODAY.getTime()) / 864e5; return d > 0 && d < 183 && money(x.p).budget - x.spent > 0.15 * money(x.p).budget; });
  if (ending.length) out.push({ label: 'Closing soon', tone: 'bad', text: `${names(ending.map((x) => `${who(x)} ends ${date(x.p.end)} with ${short(money(x.p).budget - x.spent)} unspent`))}.`, items: ending.map((x) => it(x, `ends ${date(x.p.end)}; ${short(money(x.p).budget - x.spent)} of ${short(money(x.p).budget)} not spent yet`)) });
  return out;
}

/**
 * Decisions grouped by their kind (addendum, staff contract …), the most pressing kind first. A kind with many items
 * opens closed and lists them by project — one line per project with what each needs.
 */
/** The project tab where a decision of each kind is taken. */
const DEC_TAB: Record<string, string> = { 'Staff contract': 'staff', Addendum: 'statement', Notification: 'statement', 'Payment request': 'finance', Ending: 'summary', Data: 'docs' };
function DecisionGroups({ D }: { D: Decision[] }) {
  const G = [...D.reduce((m, x) => m.set(x.kind, [...(m.get(x.kind) ?? []), x]), new Map<string, Decision[]>())].map(([kind, L]) => ({ kind, L, tone: L.some((x) => x.tone === 'bad') ? 'bad' : 'warn' }))
    .sort((a, b) => (a.tone === 'bad' ? 0 : 1) - (b.tone === 'bad' ? 0 : 1));
  return <div class="dec-g">{G.map(({ kind, L, tone }) => {
    const projects = [...new Set(L.map((x) => x.p?.id ?? ''))];
    const byP = projects.map((id) => ({ p: L.find((x) => (x.p?.id ?? '') === id)?.p, L: L.filter((x) => (x.p?.id ?? '') === id) }));
    const strip = (x: Decision) => (x.p ? x.text.replace(new RegExp(`^${plabel(x.p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:?\\s*`), '') : x.text);
    return <details class={`dec-k t-${tone}`} open={L.length <= 4}>
      <summary title={KIND_INFO[kind]?.note}><span class="badge">{kind}</span><b>{L.length} {kindUnit(kind, L.length)}</b><span class="muted">{projects.filter(Boolean).length > 1 ? `across ${projects.filter(Boolean).length} projects` : L[0].p ? plabel(L[0].p) : ''}</span></summary>
      <ul>{L.length <= 4 ? L.map((x) => <li class={x.p ? 'click' : ''} onClick={() => x.p && go(`project/${x.p.id}/${DEC_TAB[kind] ?? 'summary'}`)}>{x.text}</li>)
        : byP.map(({ p, L: Q }) => <li class={p ? 'click' : ''} onClick={() => p && go(`project/${p.id}/${DEC_TAB[kind] ?? 'summary'}`)}><b>{p ? plabel(p) : 'Portfolio'}</b> <span class="muted">· {Q.length} {kindUnit(kind, Q.length)}</span><span class="dec-sub">{Q.map(strip).join(' · ')}</span></li>)}</ul>
    </details>; })}</div>;
}

export function MonthlyPack() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => !p.datesTbc);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const scope = s.filters.country ? cname(s.filters.country) : 'All countries';
  const M = moves(P).sort((a, b) => (a.prev == null ? 1 : 0) - (b.prev == null ? 1 : 0) || (a.perf - (a.prev ?? a.perf)) - (b.perf - (b.prev ?? b.perf)));
  const N = narrative(P, cname);
  const S = portfolioSeries(P, TODAY);
  const AA = openAlerts(alerts(P, TODAY), s.ledger.alertMarks, TODAY), nAll = AA.length;
  const A = AA.filter((a) => a.severity === 'critical' || a.severity === 'serious').slice(0, 8);
  const maxAdd = Math.max(1, ...M.map((x) => Math.abs(x.added)));
  const DEC = decisions(P, TODAY);
  return (
    <article class="pack">
      <header class="pack-h">
        <div><div class="muted pack-k">Monthly management pack · {scope}</div><h2>{month(TODAY.getTime())}</h2></div>
        <span class="no-print" style={{ display: 'flex', gap: '8px' }}><button class="btn" title="For the Head of Operations: the portfolio at a glance, then each project's figures, actions, Work Plan and FOMA notes (Word)" onClick={() => monthSummaryDocx(P, get().ledger)}>⬇ Summary (Word)</button><button class="btn primary" onClick={() => print()}>⎙ Print / save as PDF</button></span>
      </header>
      <section class="pack-s pack-sum">
        <h3>Summary</h3>
        <ul class="pack-pts">{N.map((t) => <li class={`t-${t.tone}${t.items?.length ? ' click' : ''}`} title={t.items?.length ? 'Which projects, and why' : undefined} onClick={t.items?.length ? () => set({ drawer: { kind: 'points', title: t.label, text: t.text, items: t.items! } }) : undefined}><span>{t.label}</span><p>{t.text}</p>{t.items?.length ? <em class="pack-n">{t.items.length} ›</em> : null}</li>)}</ul>
        <button class="btn ghost no-print" onClick={() => navigator.clipboard?.writeText(N.map((t) => `${t.label}: ${t.text}`).join('\n'))}>Copy summary</button>
      </section>
      <section class="pack-s pack-dec">
        <h3>Decisions and actions this month</h3>
        {DEC.length ? <DecisionGroups D={DEC} />
          : <p class="muted">Nothing needs a decision this month.</p>}
      </section>
      {S.length > 1 && <section class="pack-s"><h3>Spending over time</h3><p class="muted" style={{ margin: '-4px 0 8px', fontSize: '13px' }}>Cumulative actual spend against the linear plan, with the forecast range</p>
        <Chart height={260} label="Spending over time" option={(t) => ({ ...spendOption(t, S, totals(P, TODAY).budget, endMarks(P)), dataZoom: [], grid: { left: 8, right: endMarks(P).length ? 72 : 16, top: 22, bottom: 8, containLabel: true } })} /></section>}
      <section class="pack-s">
        <h3>What changed since the previous report <button class="linkish no-print pack-more" onClick={() => go('reports/changed')}>details ›</button></h3>
        <table class="mini pack-t">
          <thead><tr><th>Project</th><th>Country</th><th>Reports</th><th class="r">Spend added</th><th class="r">Performance</th><th class="r">Change</th><th>Band</th></tr></thead>
          <tbody>{M.map((x) => { const d = x.prev == null ? null : x.perf - x.prev; return (
            <tr class="click" onClick={() => go(`project/${x.p.id}/diff`)} style={{ borderLeft: `4px solid ${BAND_C[x.now]}` }}>
              <td><b class="num">{lab(x.p)}</b> <span class="muted">{x.p.name}</span></td>
              <td>{cname(x.p.country)}</td>
              <td class="num muted" style={{ whiteSpace: 'nowrap' }}>{x.from ? `${date(x.from)} → ${date(x.to!)}` : x.to ? date(x.to) : '—'}</td>
              <td class="r" style={{ minWidth: '130px' }}>{x.added ? <div class="delta-bar"><span style={{ width: `${Math.abs(x.added) / maxAdd * 100}%`, background: x.added < 0 ? 'var(--serious)' : 'var(--c1)' }} /><b class="num">{short(x.added)}</b></div> : <span class="muted">—</span>}</td>
              <td class="r num"><b style={{ color: BAND_C[x.now] }}>{p0(x.perf)}</b></td>
              <td class="r num" style={{ color: d == null ? undefined : d > 0.005 ? 'var(--good)' : d < -0.005 ? 'var(--critical)' : undefined }}>{d == null ? '—' : `${d > 0.005 ? '▲' : d < -0.005 ? '▼' : '■'} ${pts(d)}`}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{x.was && x.was !== x.now ? <><span class="band" style={{ background: BAND_C[x.was] }} />→ </> : null}<span class="band" style={{ background: BAND_C[x.now] }} /> {x.now}</td>
            </tr>); })}</tbody>
        </table>
      </section>
      {(s.ledger.offices ?? []).length > 0 && <section class="pack-s"><h3>Office running costs</h3><OfficeSummary variant="pack" /></section>}
      <section class="pack-s"><h3>Service providers <button class="linkish no-print pack-more" onClick={() => go('reports/providers')}>see all ›</button></h3><p class="muted" style={{ margin: '-4px 0 8px', fontSize: '13px' }}>Event management, interpretation, consultants, visibility, research, publication and grants — purchase orders of the latest report workbooks</p><ProviderBrief P={P} cname={cname} /></section>
      {A.length > 0 && <section class="pack-s"><h3>Top alerts <button class="linkish no-print pack-more" onClick={() => go('reports/alerts')}>all {nAll} alerts ›</button></h3>
        <ul class="pack-al">{A.map((a) => <li class="click" tabIndex={0} role="button" title="What it is and what to do" onClick={() => set({ drawer: { kind: 'alert', projectId: a.projectId, alertKind: a.kind, ids: [a.id] } })} onKeyDown={(e) => e.key === 'Enter' && set({ drawer: { kind: 'alert', projectId: a.projectId, alertKind: a.kind, ids: [a.id] } })}><span class={`badge ${a.severity}`}>{a.severity}</span><b>{(() => { const q = P.find((p) => p.id === a.projectId); return q ? lab(q) : ''; })()}</b> {a.title} <span class="muted">— {a.detail}</span></li>)}</ul></section>}
      <section class="pack-s pack-break"><h3>Expenditure monitoring</h3><Compare only /><p class="no-print pack-more"><button class="linkish" onClick={() => go('reports/compare')}>Detailed analysis — scenarios, commitment risk, early warning, catch-up and staff projection → Expenditure monitoring ›</button></p></section>
    </article>
  );
}
