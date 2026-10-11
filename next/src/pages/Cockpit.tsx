import { category, deadlines, elapsed, money, parseDate, reportsByDate } from '../domain/calc';
import { outcome } from '../domain/insights';
import { tidy } from '../domain/logframe';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
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
      <div class="ck-chips">
        <span>Forecast at end <b class="num">{short(o.projected)}</b>{o.basis !== 'no data' && <> · {Math.round(o.utilisation * 100)}%</>}</span>
        <span>Time left <b class="num">{monthsLeft} mo</b></span>
        <span class={next?.status === 'overdue' ? 'bad' : ''}>Next report <b class="num">{next ? date(next.due) : '—'}</b>{next && <> · {next.status}</>}</span>
      </div>
    </section>
  );
}

/** Project identity card: what the documents say the project is — objectives, outputs, money, contract terms. */
export function IdentityCard({ p }: { p: Project }) {
  const I = p.indicators ?? [], c = (p.contract ?? {}) as Record<string, number | string | undefined>;
  const lvl = (re: RegExp) => [...new Set(I.filter((x) => re.test(x.level ?? '')).map((x) => tidy(x.result)).filter(Boolean))];
  const goals = [...lvl(/impact/i), ...lvl(/outcome/i)].slice(0, 3);
  const outputs = [...new Set(I.filter((x) => !/impact|outcome/i.test(x.level ?? '')).map((x) => tidy(x.result)).filter(Boolean))].slice(0, 8);
  const L = p.approvedBudget?.lines ?? [], tot = L.reduce((s, l) => s + (l.approved ?? 0), 0);
  const H = new Map<string, number>(); for (const l of L) { const k = category({ code: l.code, description: l.description ?? '' }); H.set(k, (H.get(k) ?? 0) + (l.approved ?? 0)); }
  const heads = [...H].sort((a, b) => b[1] - a[1]);
  const terms = [
    ['Contract', c.number ?? p.contractNo], ['Duration', c.months ? `${c.months} months` : `${month(p.start)} – ${month(p.end)}`],
    ['Reporting', c.repMonths ? `every ${c.repMonths} months, due +${c.progDays ?? 60} days` : undefined],
    ['Final report', c.finalMonths ? `${c.finalMonths} months after end` : undefined],
    ['Flexibility', c.flexPct ? `${c.flexPct}% between headings` : undefined], ['Pre-financing', c.prefinancing ? short(Number(c.prefinancing)) : undefined],
  ].filter((x) => x[1]);
  if (!goals.length && !outputs.length && !heads.length) return null;
  return (
    <section class="card span-12 idc">
      <div class="card-h"><div><h2>Project identity</h2><p>Read from the documents on file — objectives, outputs, approved budget and contract terms</p></div>
        <button class="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => print()}>Print brief</button></div>
      <div class="idc-g">
        <div>
          {goals.length > 0 && <><h3>Objectives</h3><ol class="idc-goals">{goals.map((g) => <li>{g}</li>)}</ol></>}
          {outputs.length > 0 && <><h3>Outputs</h3><ul class="idc-out">{outputs.map((o) => <li>{o}</li>)}</ul></>}
        </div>
        <div>
          {heads.length > 0 && <><h3>Approved budget · {short(tot)}</h3>
            <div class="idc-stack">{heads.map(([k, v], i) => <span style={{ flex: v, background: `var(--c${(i % 8) + 1})` }} title={`${k} ${short(v)}`} />)}</div>
            <ul class="idc-heads">{heads.map(([k, v], i) => <li><i style={{ background: `var(--c${(i % 8) + 1})` }} />{k}<b class="num">{short(v)}</b><small>{Math.round(v / (tot || 1) * 100)}%</small></li>)}</ul></>}
          {terms.length > 0 && <><h3>Contract terms</h3><dl class="idc-terms">{terms.map(([k, v]) => <><dt>{k}</dt><dd>{v}</dd></>)}</dl></>}
        </div>
      </div>
    </section>
  );
}
