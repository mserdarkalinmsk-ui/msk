import { deadlines, elapsed, money, parseDate, reportsByDate } from '../domain/calc';
import { outcome } from '../domain/insights';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { Count } from '../ui/Count';
import { date, month, short } from '../ui/format';

const DAY = 86_400_000;

/** One-glance project story: a sentence, the time track with every milestone, and four numbers. */
export function Cockpit({ p }: { p: Project }) {
  if (p.datesTbc) return null;
  const m = money(p), o = outcome(p, TODAY), el = elapsed(p, TODAY);
  const s = parseDate(p.start).getTime(), e = parseDate(p.end).getTime(), at = (t: number) => `${Math.max(0, Math.min(100, (t - s) / (e - s) * 100))}%`;
  const used = m.budget ? m.spent / m.budget : 0, gap = used - el;
  const D = deadlines(p, TODAY), next = D.find((d) => d.status !== 'submitted');
  const R = reportsByDate(p).filter((r) => !/approved budget/i.test(r.type));
  const monthsLeft = Math.max(0, Math.round((e - TODAY.getTime()) / DAY / 30.44));
  const tone = Math.abs(gap) < 0.1 ? 'good' : gap < -0.25 || o.overrun ? 'critical' : 'warning';
  const pace = !m.spent ? 'has not reported spending yet' : Math.abs(gap) < 0.1 ? 'is on pace' : gap < 0 ? `is ${Math.round(-gap * 100)} points behind time` : `is ${Math.round(gap * 100)} points ahead of time`;
  const fc = o.basis === 'no data' ? '' : o.overrun ? ` At the current rate it would overrun by ${short(o.overrun)}.` : o.unused > m.budget * 0.05 ? ` At the current rate ${short(o.unused)} would stay unused — about ${short(o.needRate)} a month is needed.` : ' At the current rate the budget is used in full.';
  return (
    <section class={`cockpit span-12 tone-${tone}`}>
      <p class="ck-story"><b>{Math.round(used * 100)}% spent</b> with <b>{Math.round(el * 100)}% of time gone</b> — the project {pace}.{fc}</p>
      <div class="ck-track" aria-label="Project timeline">
        <div class="ck-rail"><span class="ck-time" style={{ width: at(TODAY.getTime()) }} /><span class="ck-spend" style={{ width: `${Math.min(100, used * 100)}%` }} /></div>
        {R.map((r) => <i class="ck-rep" style={{ left: at(parseDate(r.date).getTime()) }} title={`${r.name} · ${date(r.date)}`} />)}
        {D.map((d) => <i class={`ck-dl ${d.status}`} style={{ left: at(parseDate(d.due).getTime()) }} title={`${d.kind} due ${date(d.due)} · ${d.status}`} />)}
        <span class="ck-today" style={{ left: at(TODAY.getTime()) }}><em>Today</em></span>
        <div class="ck-ends"><span>{month(p.start)}</span><span>{month(p.end)}</span></div>
      </div>
      <div class="ck-stats">
        <div><span>Spent</span><b class="num"><Count value={m.spent} format={short} /></b><small>of {short(m.budget)}</small></div>
        <div><span>Forecast at end</span><b class="num"><Count value={o.projected} format={short} /></b><small>{o.basis === 'no data' ? 'needs reports' : `${Math.round(o.utilisation * 100)}% of budget`}</small></div>
        <div><span>Time left</span><b class="num"><Count value={monthsLeft} format={(v) => `${Math.round(v)} mo`} /></b><small>ends {date(p.end)}</small></div>
        <div><span>Next report</span><b class="num">{next ? date(next.due) : '—'}</b><small class={next?.status === 'overdue' ? 'bad' : ''}>{next ? `${next.kind.toLowerCase()} · ${next.status}` : 'none pending'}</small></div>
      </div>
    </section>
  );
}
