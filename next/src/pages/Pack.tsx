import { OfficeSummary } from './OfficeSummary';
import { ProviderBrief } from './Providers';
import { filtered, go, useStore } from '../data/store';
import { deadlines, elapsed, money, parseDate, portfolioSeries, totals } from '../domain/calc';
import { Chart } from '../ui/Chart';
import { endMarks, spendOption } from './Overview';
import { alerts } from '../domain/insights';
import { perfTrend, warningScore } from '../domain/monitor';
import { renewals, roster } from '../domain/staff';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, month, short } from '../ui/format';
import { Compare } from './Studio';

/** Monitoring band of a performance ratio, as in the CoE monitoring sheet. */
const band = (v: number) => (v >= 1 ? 'blue' : v >= 0.9 ? 'green' : v >= 0.7 ? 'amber' : 'red');
const BAND_C: Record<string, string> = { blue: 'var(--c1)', green: 'var(--good)', amber: 'var(--c4)', red: 'var(--critical)' };
const p0 = (v: number) => `${Math.round(v * 100)}%`;
const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const pts = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} pts`;

export interface Move { p: Project; perf: number; prev: number | null; spent: number; added: number; from?: string; to?: string; was: string | null; now: string }

/** Latest report vs the previous one for each project: spend added, performance change and band transition. */
export function moves(P: Project[]): Move[] {
  return P.filter((p) => !p.datesTbc).map((p) => {
    const m = money(p), pl = m.budget * elapsed(p, TODAY), perf = pl ? m.spent / pl : 0;
    const T = perfTrend(p), a = T.at(-2), b = T.at(-1);
    return { p, perf, prev: a ? a.perf : null, spent: m.spent, added: a && b ? b.spent - a.spent : 0, from: a?.date, to: b?.date, was: a ? band(a.perf) : null, now: band(perf) };
  });
}

export interface Point { label: string; text: string; tone: 'info' | 'good' | 'warn' | 'bad' }
const names = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

/** Management summary as short labelled points, built from the figures. */
export function narrative(P: Project[], cname: (id: string) => string): Point[] {
  const M = moves(P);
  if (!M.length) return [{ label: 'Position', text: 'No projects with confirmed dates in this selection.', tone: 'info' }];
  const B = M.reduce((a, x) => a + money(x.p).budget, 0), S = M.reduce((a, x) => a + x.spent, 0);
  const PL = M.reduce((a, x) => a + money(x.p).budget * elapsed(x.p, TODAY), 0), perf = PL ? S / PL : 0;
  const many = new Set(M.map((x) => x.p.country)).size > 1;
  const who = (x: Move) => many ? `${lab(x.p)} (${cname(x.p.country)})` : lab(x.p);
  const out: Point[] = [];
  const verdict = perf >= 1 ? 'ahead of plan' : perf >= 0.9 ? 'on track' : perf >= 0.7 ? 'somewhat behind plan' : 'well behind plan';
  out.push({ label: 'Position', tone: perf >= 0.9 ? 'good' : perf >= 0.7 ? 'warn' : 'bad',
    text: `${M.length} projects have spent ${short(S)} of their ${short(B)} budget (${p0(B ? S / B : 0)}). By now ${short(PL)} should have been spent, so spending is at ${p0(perf)} of plan — ${verdict}.` });
  const cnt = (b: string) => M.filter((x) => x.now === b).length;
  const parts = [['blue', 'above plan'], ['green', 'on plan'], ['amber', 'slightly behind (70–90%)'], ['red', 'well behind (under 70%)']].filter(([b]) => cnt(b)).map(([b, w]) => `${cnt(b)} ${w}`);
  out.push({ label: 'Projects', tone: cnt('red') ? 'bad' : cnt('amber') ? 'warn' : 'good', text: cnt('red') === M.length ? `All ${M.length} projects are well behind plan (under 70%).` : `${names(parts)}.` });
  const added = M.reduce((a, x) => a + x.added, 0);
  const D = M.filter((x) => x.prev != null).map((x) => ({ x, d: x.perf - x.prev! })).sort((a, b) => b.d - a.d);
  if (added) {
    const best = D[0] && D[0].d > 0.02 ? ` Biggest improvement: ${who(D[0].x)}, ${pts(D[0].d)}.` : '';
    const worst = D.at(-1) && D.at(-1)!.d < -0.02 ? ` Biggest slip: ${who(D.at(-1)!.x)}, ${pts(D.at(-1)!.d)}.` : '';
    out.push({ label: 'Since last report', tone: 'info', text: `${short(added)} of new spending recorded.${best}${worst}` });
  }
  const order = ['blue', 'green', 'amber', 'red'];
  const worse = M.filter((x) => x.was && order.indexOf(x.now) > order.indexOf(x.was));
  if (worse.length) out.push({ label: 'Downgraded', tone: 'warn', text: `${names(worse.map((x) => `${who(x)} ${x.was} → ${x.now}`))}.` });
  const red = M.filter((x) => x.now === 'red').sort((a, b) => a.perf - b.perf);
  if (red.length) out.push({ label: 'Needs action', tone: 'bad', text: `${names(red.slice(0, 5).map((x) => `${who(x)} at ${p0(x.perf)}`))} of planned spending${red.length > 5 ? `, and ${red.length - 5} more` : ''}.` });
  const high = M.filter((x) => warningScore(x.p, TODAY, { perf: x.perf, scp: x.perf, staffRatio: 0 }).level === 'high');
  const od = [...new Set(M.filter((x) => deadlines(x.p, TODAY).some((d) => d.status === 'overdue')).map(who))];
  if (high.length || od.length) out.push({ label: 'Follow-up', tone: 'warn', text: [high.length && `High attention score: ${names(high.map(who))}.`, od.length && `Report overdue: ${names(od)}.`].filter(Boolean).join(' ') });
  const ren = M.flatMap((x) => renewals(roster(x.p, TODAY), TODAY, 90));
  if (ren.length) { const by = [...new Set(ren.map((r) => r.end).filter(Boolean))].sort(); out.push({ label: 'Staff', tone: 'warn', text: `${ren.length} contract${ren.length > 1 ? 's end' : ' ends'} in the next 90 days${by[0] ? `, the first on ${date(by[0]!)}` : ''}.` }); }
  const ending = M.filter((x) => { const d = (parseDate(x.p.end).getTime() - TODAY.getTime()) / 864e5; return d > 0 && d < 183 && money(x.p).budget - x.spent > 0.15 * money(x.p).budget; });
  if (ending.length) out.push({ label: 'Closing soon', tone: 'bad', text: `${names(ending.map((x) => `${who(x)} ends ${date(x.p.end)} with ${short(money(x.p).budget - x.spent)} unspent`))}.` });
  return out;
}

export function MonthlyPack() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => !p.datesTbc);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const scope = s.filters.country ? cname(s.filters.country) : 'All countries';
  const M = moves(P).sort((a, b) => (a.prev == null ? 1 : 0) - (b.prev == null ? 1 : 0) || (a.perf - (a.prev ?? a.perf)) - (b.perf - (b.prev ?? b.perf)));
  const N = narrative(P, cname);
  const S = portfolioSeries(P, TODAY);
  const A = alerts(P, TODAY).filter((a) => a.severity === 'critical' || a.severity === 'serious').slice(0, 8);
  const maxAdd = Math.max(1, ...M.map((x) => Math.abs(x.added)));
  return (
    <article class="pack">
      <header class="pack-h">
        <div><div class="muted pack-k">Monthly management pack · {scope}</div><h2>{month(TODAY.getTime())}</h2></div>
        <button class="btn primary no-print" onClick={() => print()}>⎙ Print / save as PDF</button>
      </header>
      <section class="pack-s pack-sum">
        <h3>Summary</h3>
        <ul class="pack-pts">{N.map((t) => <li class={`t-${t.tone}`}><span>{t.label}</span><p>{t.text}</p></li>)}</ul>
        <button class="btn ghost no-print" onClick={() => navigator.clipboard?.writeText(N.map((t) => `${t.label}: ${t.text}`).join('\n'))}>Copy summary</button>
      </section>
      {S.length > 1 && <section class="pack-s"><h3>Spending over time</h3><p class="muted" style={{ margin: '-4px 0 8px', fontSize: '12.5px' }}>Cumulative actual spend against the linear plan, with the forecast range</p>
        <Chart height={260} label="Spending over time" option={(t) => ({ ...spendOption(t, S, totals(P, TODAY).budget, endMarks(P)), dataZoom: [], grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true } })} /></section>}
      <section class="pack-s">
        <h3>What changed since the previous report</h3>
        <table class="mini pack-t">
          <thead><tr><th>Project</th><th>Country</th><th>Reports</th><th class="r">Spend added</th><th class="r">Performance</th><th class="r">Change</th><th>Band</th></tr></thead>
          <tbody>{M.map((x) => { const d = x.prev == null ? null : x.perf - x.prev; return (
            <tr class="click" onClick={() => go(`project/${x.p.id}`)} style={{ borderLeft: `4px solid ${BAND_C[x.now]}` }}>
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
      <section class="pack-s"><h3>Service providers</h3><p class="muted" style={{ margin: '-4px 0 8px', fontSize: '12.5px' }}>Event management, interpretation, consultants, visibility, research, publication and grants — purchase orders of the latest report workbooks</p><ProviderBrief P={P} cname={cname} /></section>
      {A.length > 0 && <section class="pack-s"><h3>Top alerts</h3>
        <ul class="pack-al">{A.map((a) => <li><span class={`badge ${a.severity}`}>{a.severity}</span><b>{(() => { const q = P.find((p) => p.id === a.projectId); return q ? lab(q) : ''; })()}</b> {a.title} <span class="muted">— {a.detail}</span></li>)}</ul></section>}
      <section class="pack-s pack-break"><h3>Expenditure monitoring</h3><Compare /></section>
    </article>
  );
}
