import { set, useStore } from '../data/store';
import { elapsed, HEADINGS, money, parseDate, spendPoints, spendAt } from '../domain/calc';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { full, month, pct, short } from './format';

const PAL = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);

/** Actual spend per budget heading at a report, from leaf lines only (sub-totals would double count). */
function headingSpend(p: Project, i: number): Record<string, number> {
  const r = (p.reportingPeriods ?? []).filter((x) => x.snapshot?.lines?.length).sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())[i];
  const out: Record<string, number> = {};
  if (!r) return out;
  const L = r.snapshot!.lines, codes = L.map((l) => l.code);
  for (const l of L) {
    const h = l.code.match(/^(\d{1,2})(?:\.|$)/)?.[1];
    if (!h || !HEADINGS[h] || codes.some((c) => c !== l.code && c.startsWith(l.code + '.'))) continue;
    out[h] = (out[h] ?? 0) + num(l.actual);
  }
  return out;
}

/** Spend of one project between two dates split by heading, using the line movement of the report interval that covers it. */
function splitByHeading(p: Project, from: number, to: number): Record<string, number> {
  const pts = spendPoints(p), total = spendAt(p, to) - spendAt(p, from), out: Record<string, number> = {};
  if (Math.abs(total) < 1) return out;
  const off = pts.length - (p.reportingPeriods ?? []).filter((x) => x.snapshot?.lines?.length).length;
  let k = pts.findIndex((x) => x.t >= to); if (k < 1) k = pts.length - 1;
  const b = k - off >= 0 ? headingSpend(p, k - off) : {}, a = k - 1 - off >= 0 ? headingSpend(p, k - 1 - off) : {};
  const D = Object.keys(b).map((h) => [h, (b[h] ?? 0) - (a[h] ?? 0)] as const), sumD = D.reduce((s, [, v]) => s + v, 0);
  if (!sumD) return out;
  for (const [h, v] of D) if (v) out[h] = (total * v) / sumD;
  return out;
}

export function PeriodPanel({ t, from, ids, close }: { t: number; from: number; ids: string[]; close: () => void }) {
  const L = useStore((s) => s.ledger);
  const P = L.projects.filter((p) => ids.includes(p.id) && !p.datesTbc);
  const cname = (id: string) => L.countries.find((c) => c.id === id)?.name ?? id;
  const R = P.map((p) => {
    const spent = spendAt(p, t) - spendAt(p, from);
    const plan = num(p.budget) * (elapsed(p, new Date(t)) - elapsed(p, new Date(from)));
    return { p, spent, plan, cum: spendAt(p, t), share: num(p.budget) ? spendAt(p, t) / num(p.budget) : 0 };
  }).filter((r) => Math.abs(r.spent) > 1 || r.plan > 1).sort((a, b) => b.spent - a.spent);
  const tot = R.reduce((s, r) => s + r.spent, 0), plan = R.reduce((s, r) => s + r.plan, 0);
  const rate = plan ? tot / plan : 0;
  const tone = rate >= 1 ? 'info' : rate >= 0.9 ? 'good' : rate >= 0.7 ? 'warning' : 'critical';
  const C = [...new Set(R.map((r) => r.p.country))].map((c) => ({ c, v: R.filter((r) => r.p.country === c).reduce((s, r) => s + r.spent, 0) })).sort((a, b) => b.v - a.v);
  const H: Record<string, number> = {};
  for (const r of R) for (const [h, v] of Object.entries(splitByHeading(r.p, from, t))) H[h] = (H[h] ?? 0) + v;
  const HS = Object.entries(H).sort((a, b) => Number(a[0]) - Number(b[0]));
  const hTot = HS.reduce((s, [, v]) => s + v, 0);
  const maxP = Math.max(1, ...R.map((r) => Math.max(r.spent, r.plan)));
  const top = R[0];
  const open = (id: string) => set({ drawer: { kind: 'project', id } });
  return (
    <>
      <div class="drawer-h"><div><h2>{month(t)}</h2><p class="muted">Spend added this month · {R.length} projects</p></div><button class="btn ghost" onClick={close} aria-label="Close">✕</button></div>
      <div class="drawer-b ap pp">
        <div class="pp-kpis">
          <div class="pp-k c1"><span>Spent</span><b>{short(tot)}</b></div>
          <div class="pp-k"><span>Plan</span><b>{short(plan)}</b></div>
          <div class={`pp-k t-${tone}`}><span>vs plan</span><b>{pct(rate)}</b></div>
        </div>
        {top && top.spent > 0 && <p class="pp-note">Largest contributor: <b>{top.p.code}</b> with <b>{short(top.spent)}</b> ({pct(tot ? top.spent / tot : 0)} of the month).</p>}

        {HS.length > 0 && <><h3 class="pp-h">By budget heading</h3>
          <div class="pp-stack" role="img" aria-label="Spend by heading">{HS.map(([h, v], i) => v > 0 && <span style={{ width: `${(v / hTot) * 100}%`, background: PAL[i % 8] }} title={`${HEADINGS[h]} ${full(v)}`} />)}</div>
          <ul class="pp-leg">{HS.map(([h, v], i) => <li><i style={{ background: PAL[i % 8] }} /><span>{h}. {HEADINGS[h]}</span><b class="num">{short(v)}</b><small class="num">{hTot ? pct(v / hTot) : ''}</small></li>)}</ul></>}

        {C.length > 1 && <><h3 class="pp-h">By country</h3>
          <ul class="pp-leg">{C.map((x, i) => <li><i style={{ background: PAL[(i + 3) % 8] }} /><span>{cname(x.c)}</span><b class="num">{short(x.v)}</b><small class="num">{tot ? pct(x.v / tot) : ''}</small></li>)}</ul></>}

        <h3 class="pp-h">By project</h3>
        <ul class="pp-rows">{R.map((r) => {
          const q = r.plan ? r.spent / r.plan : 0, c = q >= 1 ? 'var(--c2)' : q >= 0.9 ? 'var(--good)' : q >= 0.7 ? 'var(--warn)' : 'var(--critical)';
          return <li tabIndex={0} role="button" onClick={() => open(r.p.id)} onKeyDown={(e) => e.key === 'Enter' && open(r.p.id)} style={{ borderLeftColor: c }}>
            <div class="pp-top"><b>{r.p.code}</b><span class="muted">{r.p.name}</span><b class="num" style={{ marginLeft: 'auto' }}>{short(r.spent)}</b></div>
            <div class="pp-bar"><span style={{ width: `${Math.max(0, (r.spent / maxP) * 100)}%`, background: c }} /><i style={{ left: `${(r.plan / maxP) * 100}%` }} title={`plan ${full(r.plan)}`} /></div>
            <small class="muted">plan {short(r.plan)} · <b style={{ color: c }}>{pct(q)}</b> · cumulative {short(r.cum)} ({pct(r.share)} of {short(money(r.p).budget)})</small>
          </li>;
        })}</ul>
        <p class="muted" style={{ fontSize: '11.5px' }}>Monthly amounts are interpolated between report dates; heading split follows line movement in the covering report interval. As of {month(TODAY.getTime())}.</p>
      </div>
    </>
  );
}
