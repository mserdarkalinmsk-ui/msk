import { HEADINGS, lineExposure, lines, money, parseDate, reportsByDate } from '../domain/calc';
import { headings } from '../domain/insights';
import { catchUp } from '../domain/monitor';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { month, short } from '../ui/format';
import { Simulator } from './Studio';

const MS = 30.4375 * 86_400_000;
const C = { ok: '#30a46c', warn: '#f5a524', bad: '#e5484d', idle: '#3b82c4' };

export interface HeadRow { code: string; label: string; budget: number; spent: number; exposure: number; rate: number; endUse: number; runOut: number | null; status: 'over' | 'tight' | 'ok' | 'under' }

/** Per budget heading: monthly spend so far, the month it runs out at that pace and the projected use at the end date. */
export function depletion(p: Project): { rows: HeadRow[]; asOf: number; monthsLeft: number } {
  const L = lines(p), leaf = L.filter((l) => !L.some((x) => x !== l && x.code.startsWith(l.code + '.')));
  const last = reportsByDate(p).at(-1), asOf = last ? parseDate(last.date).getTime() : TODAY.getTime();
  const s = parseDate(p.start).getTime(), e = parseDate(p.end).getTime();
  const done = Math.max(1, (asOf - s) / MS), monthsLeft = Math.max(0, (e - Math.max(asOf, TODAY.getTime())) / MS);
  const H = new Map<string, { budget: number; spent: number; exposure: number }>();
  for (const l of leaf) {
    const k = l.code.split('.')[0]; if (!HEADINGS[k] || k === '8') continue;
    const h = H.get(k) ?? { budget: 0, spent: 0, exposure: 0 };
    h.budget += l.approved ?? 0; h.spent += l.actual ?? 0; h.exposure += lineExposure(l); H.set(k, h);
  }
  const rows = [...H].sort((a, b) => +a[0] - +b[0]).map(([code, h]) => {
    const rate = h.spent / done, left = h.budget - h.exposure;
    // Open commitments are spent first, so only the uncommitted balance is consumed at the monthly rate.
    const endUse = h.budget ? (h.exposure + rate * monthsLeft) / h.budget : 0;
    const runOut = left <= 0 ? asOf : rate > 0 ? Math.max(asOf, TODAY.getTime()) + (left / rate) * MS : null;
    const status: HeadRow['status'] = endUse > 1.02 ? 'over' : endUse > 0.95 ? 'tight' : endUse >= 0.85 ? 'ok' : 'under';
    return { code, label: HEADINGS[code], ...h, rate, endUse, runOut, status };
  });
  return { rows, asOf, monthsLeft };
}

/** Transfers from headings that will not use their budget to those that will run short, each capped at the flexibility limit of the receiving heading. */
export function transfers(p: Project, D: HeadRow[]) {
  const flex = headings(p).flex;
  const base = new Map(headings(p).rows.map((r) => [r.code, r.baseline]));
  const need = D.filter((r) => r.status === 'over' && r.code !== '10').map((r) => ({ r }));
  const give = D.filter((r) => r.status === 'under' && r.code !== '10').map((r) => ({ r, amt: Math.max(0, r.budget * (1 - r.endUse) * 0.8) }));
  const out: { from: string; to: string; amount: number; capped: boolean }[] = [];
  for (const n of need) {
    let want = Math.max(0, (n.r.endUse - 1) * n.r.budget);
    const cap = flex * (base.get(n.r.code) ?? n.r.budget);
    let room = cap;
    for (const g of give) {
      if (want <= 0 || room <= 0) break;
      const a = Math.min(want, g.amt, room); if (a < 1) continue;
      out.push({ from: g.r.code, to: n.r.code, amount: Math.round(a / 100) * 100, capped: false });
      g.amt -= a; want -= a; room -= a;
    }
    if (want > 1) out.push({ from: '', to: n.r.code, amount: Math.round(want / 100) * 100, capped: room <= 1 });
  }
  return { list: out, flex };
}

const lab = (st: HeadRow['status']) => (st === 'over' ? 'Runs short' : st === 'tight' ? 'Tight' : st === 'ok' ? 'On course' : 'Will not be used');
const col = (st: HeadRow['status']) => (st === 'over' ? C.bad : st === 'tight' ? C.warn : st === 'ok' ? C.ok : C.idle);

export function ProjectForesight({ p }: { p: Project }) {
  const m = money(p), cu = catchUp(p, TODAY);
  const D = depletion(p), T = transfers(p, D.rows), end = parseDate(p.end).getTime();
  return (
    <div class="grid g-12">
      <section class="card span-12" style={{ padding: '16px 20px' }}>
        <Simulator rows={[{ id: p.id, label: p.name, p, spent: m.spent, committed: Math.max(0, m.exposure - m.spent), budget: m.budget, rate: cu.rate }]} riskPct={20} />
      </section>
      <section class="card span-12">
        <div class="card-h"><div><h2>When each heading runs out</h2><p>At the monthly pace of spending so far, after open commitments · {D.monthsLeft.toFixed(1)} months left to {month(end)}</p></div></div>
        <div class="card-b table-scroll">
          {!D.rows.length ? <p class="muted">Import a financial report to see the forecast per heading.</p> :
          <table class="mini dep-t">
            <thead><tr><th>Heading</th><th class="r">Budget</th><th class="r">Spent + committed</th><th class="r">Per month</th><th style={{ minWidth: '220px' }}>Projected use at end</th><th>Runs out</th><th>Status</th></tr></thead>
            <tbody>{D.rows.map((r) => { const used = r.budget ? r.exposure / r.budget : 0; return (
              <tr style={{ borderLeft: `4px solid ${col(r.status)}` }}>
                <td><b>{r.code}.</b> {r.label}</td>
                <td class="r num">{short(r.budget)}</td><td class="r num">{short(r.exposure)}</td><td class="r num">{short(r.rate)}</td>
                <td><div class="dep-bar"><span class="now" style={{ width: `${Math.min(100, used / 1.3 * 100)}%` }} /><span class="fut" style={{ left: `${Math.min(100, used / 1.3 * 100)}%`, width: `${Math.max(0, Math.min(100, r.endUse / 1.3 * 100) - Math.min(100, used / 1.3 * 100))}%`, background: col(r.status) }} /><i style={{ left: `${100 / 1.3}%` }} /></div><small class="num" style={{ color: col(r.status) }}>{Math.round(r.endUse * 100)}%</small></td>
                <td class="num">{r.runOut == null ? '—' : r.runOut <= end ? <b style={{ color: col(r.status) }}>{month(r.runOut)}</b> : <span class="muted">after end</span>}</td>
                <td><span class="dep-pill" style={{ background: col(r.status) }}>{lab(r.status)}</span></td>
              </tr>); })}</tbody>
          </table>}
        </div>
      </section>
      {D.rows.length > 0 && <section class="card span-12">
        <div class="card-h"><div><h2>Suggested transfers</h2><p>From headings that will not use their budget to those that will run short · each heading may change up to {Math.round(T.flex * 100)}% without an amendment</p></div></div>
        <div class="card-b">
          {!T.list.length ? <p class="muted">No heading is projected to run short — no transfer needed.</p> :
          <ul class="dep-tr">{T.list.map((t) => <li>
            {t.from ? <><span class="dep-pill" style={{ background: C.idle }}>{t.from}. {HEADINGS[t.from]}</span><span class="arr">→</span></> : <span class="dep-pill" style={{ background: C.warn }}>{t.capped ? 'Above the flexibility limit — needs an amendment' : 'No spare heading — cut or amend'}</span>}
            <span class="dep-pill" style={{ background: C.bad }}>{t.to}. {HEADINGS[t.to]}</span><b class="num">{short(t.amount)}</b></li>)}</ul>}
          <p class="muted" style={{ fontSize: '11.5px', marginTop: '10px' }}>Projection = spent + committed + (average monthly spend so far × months left). A heading below 85% at the end gives up to 80% of its projected surplus. Check with the Revision tab before submitting.</p>
        </div>
      </section>}
    </div>
  );
}
