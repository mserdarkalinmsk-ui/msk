import { go, useStore } from '../data/store';
import { type Office, officeCountry, officePace, officeView, transferPlan } from '../domain/office';
import { date, full, short } from '../ui/format';

const RED = 'var(--critical)', OB = '#1d5fa8', LS = '#7b2d8e';
const pc = (v: number) => `${Math.round(v * 100)}%`;

/** Latest situation of each office (within the country filter): both funds, year-end outlook and what to decide. */
export function officeRows(O: Office[]) {
  return O.filter((o) => o.reports.length).map((o) => {
    const r = o.reports.at(-1)!, V = officeView(r), N = o.notes ?? {}, done = (c: string) => !!N[`${r.year}:${c}`]?.resolved;
    const flags = V.lines.filter((l) => !done(l.code) && (l.c.ob.flag || l.c.ls.flag)).length;
    const pace = officePace(r), T = transferPlan(r, done);
    const end = Math.max(pace.paceEnd, pace.officeEnd);
    return { o, r, T: V.T, ys: V.yearShare, flags, end, short: V.T.ob.budget - end, request: T.request, moved: T.transfers.reduce((s, t) => s + t.amount, 0) };
  });
}

export function OfficeSummary({ variant }: { variant: 'card' | 'pack' | 'slide' }) {
  const O = useStore((s) => s.ledger.offices ?? []);
  const cf = useStore((s) => s.filters.country);
  const countries = useStore((s) => s.ledger.countries);
  const R = officeRows(cf ? O.filter((o) => o.country === cf) : O);
  if (!R.length) return variant === 'card' ? null : <p class="muted">No office budget loaded{cf ? ' for this country' : ''}.</p>;
  const cname = (id: string) => countries.find((c) => c.id === id)?.name ?? officeCountry(id)?.name ?? id.toUpperCase();
  const story = R.map((x) => `${x.o.name}: Ordinary Budget ${short(x.T.ob.budget)}, ${pc(x.T.ob.budget ? x.T.ob.sc / x.T.ob.budget : 0)} spent or committed with ${pc(x.ys)} of the year gone; ${x.short < -0.5 ? `about ${short(-x.short)} short at year end — ${x.moved ? `${short(x.moved)} can be covered by transfers, ` : ''}${x.request > 0.5 ? `${short(x.request)} to request` : 'no extra budget needed'}` : 'within budget at year end'}. LS & Pagoda ${short(x.T.ls.budget)}, ${short(x.T.ls.left)} left after the forecast.`);
  const table = (
    <table class={`mini ${variant === 'slide' ? 'sl-t' : variant === 'pack' ? 'pack-t' : ''}`}>
      <thead><tr><th>Office</th><th class="r">OB budget</th><th class="r">OB used</th><th class="r">OB year-end</th><th class="r">OB short / spare</th><th class="r">Transfers</th><th class="r">To request</th><th class="r">LS & Pagoda</th><th class="r">LS left</th><th class="r">Lines to check</th></tr></thead>
      <tbody>{R.map((x) => <tr class={variant === 'card' ? 'click' : ''} onClick={() => variant === 'card' && go('offices')}>
        <td><b>{x.o.name}</b><small class="muted" style={{ display: 'block' }}>{cname(x.o.country)} · situation {date(x.r.date)}</small></td>
        <td class="r num">{full(x.T.ob.budget)}</td>
        <td class="r num"><span class="of-u"><i style={{ width: `${Math.min(1, x.T.ob.sc / (x.T.ob.budget || 1)) * 100}%`, background: x.T.ob.sc > x.T.ob.budget ? RED : OB }} /><u style={{ left: `${x.ys * 100}%` }} /></span>{pc(x.T.ob.budget ? x.T.ob.sc / x.T.ob.budget : 0)}</td>
        <td class="r num">{full(x.end)}</td><td class="r num" style={{ color: x.short < -0.5 ? RED : 'var(--good)' }}><b>{x.short < 0 ? '−' : '+'}{full(Math.abs(x.short))}</b></td>
        <td class="r num">{x.moved ? full(x.moved) : '—'}</td><td class="r num" style={{ color: x.request > 0.5 ? RED : undefined }}><b>{x.request > 0.5 ? full(x.request) : '—'}</b></td>
        <td class="r num" style={{ color: LS }}>{full(x.T.ls.budget)}</td><td class="r num" style={{ color: x.T.ls.left < -0.5 ? RED : undefined }}>{full(x.T.ls.left)}</td>
        <td class="r num">{x.flags || '—'}</td></tr>)}</tbody></table>);
  if (variant === 'slide') return <>{table}<ul class="sl-pts" style={{ marginTop: '14px' }}>{story.map((t) => <li>{t}</li>)}</ul></>;
  if (variant === 'pack') return <><ul class="pack-pts">{story.map((t, i) => <li class={`t-${R[i].short < -0.5 ? 'bad' : 'good'}`}><span>{R[i].o.name}</span><p>{t}</p></li>)}</ul><div class="table-scroll">{table}</div></>;
  return <section class="card span-12"><div class="card-h" style={{ alignItems: 'center' }}><div><h2>Office running costs</h2><p>Programme offices' own budgets (Ordinary Budget and LS & Pagoda) — kept apart from the project figures above · click to open</p></div><button class="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => go('offices')}>Offices →</button></div>
    <div class="card-b table-scroll">{table}</div></section>;
}
