import { filtered, go, useStore } from '../data/store';
import { deadlines, elapsed, money, parseDate } from '../domain/calc';
import { alerts } from '../domain/insights';
import { perfTrend, warningScore } from '../domain/monitor';
import { renewals, roster } from '../domain/staff';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, month, short } from '../ui/format';
import { Compare } from './Studio';

/** Monitoring band of a performance ratio, as in the CoE monitoring sheet. */
const band = (v: number) => (v >= 1 ? 'blue' : v >= 0.9 ? 'green' : v >= 0.7 ? 'amber' : 'red');
const BAND_C: Record<string, string> = { blue: '#3b82c4', green: '#30a46c', amber: '#f5a524', red: '#e5484d' };
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

/** Plain-language management summary built from the figures. */
export function narrative(P: Project[], cname: (id: string) => string): string[] {
  const M = moves(P);
  if (!M.length) return ['No projects with confirmed dates in this selection.'];
  const B = M.reduce((a, x) => a + money(x.p).budget, 0), S = M.reduce((a, x) => a + x.spent, 0);
  const PL = M.reduce((a, x) => a + money(x.p).budget * elapsed(x.p, TODAY), 0), perf = PL ? S / PL : 0;
  const cnt = (b: string) => M.filter((x) => x.now === b).length;
  const out: string[] = [];
  out.push(`At ${date(TODAY.toISOString().slice(0, 10))} the ${M.length} projects have spent ${short(S)} of ${short(B)} (${p0(B ? S / B : 0)}), which is ${p0(perf)} of the spending planned to date — ${perf >= 1 ? 'ahead of plan' : perf >= 0.9 ? 'on track' : perf >= 0.7 ? 'somewhat behind plan' : 'well behind plan'}. ${cnt('blue') + cnt('green')} on or above plan, ${cnt('amber')} amber and ${cnt('red')} red.`);
  const added = M.reduce((a, x) => a + x.added, 0);
  const up = M.filter((x) => x.prev != null).sort((a, b) => (b.perf - b.prev!) - (a.perf - a.prev!));
  if (added) out.push(`Since the previous reports ${short(added)} of new spending was recorded${up[0] && up[0].perf - up[0].prev! > 0.02 ? `; the strongest improvement is ${lab(up[0].p)} (${pts(up[0].perf - up[0].prev!)})` : ''}${up.at(-1) && up.at(-1)!.perf - up.at(-1)!.prev! < -0.02 ? `, while ${lab(up.at(-1)!.p)} slipped ${pts(up.at(-1)!.perf - up.at(-1)!.prev!)}` : ''}.`);
  const worse = M.filter((x) => x.was && x.was !== x.now && ['blue', 'green', 'amber', 'red'].indexOf(x.now) > ['blue', 'green', 'amber', 'red'].indexOf(x.was));
  if (worse.length) out.push(`Moved to a weaker band: ${worse.map((x) => `${lab(x.p)} (${x.was} → ${x.now})`).join(', ')}.`);
  const red = M.filter((x) => x.now === 'red').sort((a, b) => a.perf - b.perf);
  if (red.length) out.push(`Needs action: ${red.slice(0, 4).map((x) => `${lab(x.p)} ${cname(x.p.country)} at ${p0(x.perf)} of plan`).join('; ')}.`);
  const high = M.filter((x) => warningScore(x.p, TODAY, { perf: x.perf, scp: x.perf, staffRatio: 0 }).level === 'high');
  if (high.length) out.push(`${high.length} project${high.length > 1 ? 's have' : ' has'} a high attention score: ${high.map((x) => lab(x.p)).join(', ')}.`);
  const od = M.flatMap((x) => deadlines(x.p, TODAY).filter((d) => d.status === 'overdue').map(() => lab(x.p)));
  if (od.length) out.push(`Overdue reports: ${[...new Set(od)].join(', ')}.`);
  const ren = M.flatMap((x) => renewals(roster(x.p, TODAY), TODAY, 90));
  if (ren.length) out.push(`${ren.length} staff contract${ren.length > 1 ? 's end' : ' ends'} within 90 days.`);
  const ending = M.filter((x) => { const e = parseDate(x.p.end).getTime(), d = (e - TODAY.getTime()) / 864e5; return d > 0 && d < 183 && money(x.p).budget - x.spent > 0.15 * money(x.p).budget; });
  if (ending.length) out.push(`Ending within six months with more than 15% unspent: ${ending.map((x) => `${lab(x.p)} (${short(money(x.p).budget - x.spent)} left, ends ${date(x.p.end)})`).join('; ')}.`);
  return out;
}

export function MonthlyPack() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => !p.datesTbc);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const scope = s.filters.country ? cname(s.filters.country) : 'All countries';
  const M = moves(P).sort((a, b) => (a.prev == null ? 1 : 0) - (b.prev == null ? 1 : 0) || (a.perf - (a.prev ?? a.perf)) - (b.perf - (b.prev ?? b.perf)));
  const N = narrative(P, cname);
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
        {N.map((t) => <p>{t}</p>)}
        <button class="btn ghost no-print" onClick={() => navigator.clipboard?.writeText(N.join('\n\n'))}>Copy summary</button>
      </section>
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
              <td class="r num" style={{ color: d == null ? undefined : d > 0.005 ? '#30a46c' : d < -0.005 ? '#e5484d' : undefined }}>{d == null ? '—' : `${d > 0.005 ? '▲' : d < -0.005 ? '▼' : '■'} ${pts(d)}`}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{x.was && x.was !== x.now ? <><span class="band" style={{ background: BAND_C[x.was] }} />→ </> : null}<span class="band" style={{ background: BAND_C[x.now] }} /> {x.now}</td>
            </tr>); })}</tbody>
        </table>
      </section>
      {A.length > 0 && <section class="pack-s"><h3>Top alerts</h3>
        <ul class="pack-al">{A.map((a) => <li><span class={`badge ${a.severity}`}>{a.severity}</span><b>{(() => { const q = P.find((p) => p.id === a.projectId); return q ? lab(q) : ''; })()}</b> {a.title} <span class="muted">— {a.detail}</span></li>)}</ul></section>}
      <section class="pack-s pack-break"><h3>Expenditure monitoring</h3><Compare /></section>
    </article>
  );
}
