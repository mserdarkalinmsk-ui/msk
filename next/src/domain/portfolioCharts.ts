import { HEADINGS, lineExposure, lines, n, parseDate, portfolioSeries, spendAt } from './calc';
import { cashRow } from './cash';
import { earlyWarnings } from './earlywarn';
import type { BudgetLine, Project } from './types';

/**
 * Series for the portfolio charts beside "Spending over time": the monthly spend needed to use the budget by the end,
 * the headings against the flexibility, spent and committed, staff against activities, cash received against spending and
 * how close the planned expenditure of each report came to what was then spent.
 */
const MONTH = 30.4375 * 864e5;
const live = (P: Project[]) => P.filter((p) => !p.datesTbc);
const reports = (p: Project) => (p.reportingPeriods ?? []).filter((r) => r.snapshot?.lines?.length).map((r) => ({ t: parseDate(r.date).getTime(), L: r.snapshot!.lines })).sort((a, b) => a.t - b.t);
/** Value of the latest report on or before t (0 before the first one). */
const stepAt = <T>(R: { t: number; v: T }[], t: number, zero: T): T => { let v = zero; for (const r of R) { if (r.t <= t) v = r.v; else break; } return v; };
const sumL = (L: BudgetLine[], f: (l: BudgetLine) => number, keep: (code: string) => boolean = () => true) => L.reduce((a, l) => a + (keep(l.code) ? f(l) : 0), 0);

/** 1. Monthly spend (actual, then forecast) and the monthly spend needed from that month to use the budget by the end. */
export function neededSeries(P: Project[], today: Date) {
  const ps = live(P), S = portfolioSeries(ps, today);
  return S.map((x, i) => {
    const prev = S[i - 1], cum = x.actual ?? x.mid, cum0 = prev ? prev.actual ?? prev.mid : 0;
    // Needed: what is left of each running project, spread over its months left.
    const needed = ps.reduce((a, p) => {
      const end = parseDate(p.end).getTime(); if (x.t >= end || x.t < parseDate(p.start).getTime()) return a;
      const left = Math.max(0, n(p.budget) - spendAt(p, Math.min(x.t, today.getTime())));
      return a + left / Math.max(1, (end - x.t) / MONTH);
    }, 0);
    return { t: x.t, spend: cum != null && cum0 != null ? Math.max(0, cum - cum0) : null, past: x.actual != null, needed: x.t <= today.getTime() + MONTH ? needed : null };
  }).slice(1);
}

/** 2. Headings 1–6 over the portfolio: budget now, agreement, spent, committed, expected at the end and the worst stage. */
export function headingBars(P: Project[], today: Date) {
  const ps = live(P), W = ps.flatMap((p) => earlyWarnings(p, today));
  const order = ['addendum', 'notify-now', 'notify', 'watch', 'ok'];
  return ['1', '2', '3', '4', '5', '6'].map((code) => {
    const inH = (c: string) => c.split('.')[0] === code, L = ps.flatMap((p) => lines(p).filter((l) => inH(l.code)));
    const budget = L.reduce((a, l) => a + n(l.approved), 0), spent = L.reduce((a, l) => a + n(l.actual), 0), exposure = L.reduce((a, l) => a + lineExposure(l), 0);
    const w = W.filter((x) => x.code === code);
    // Projects without an approved budget (no early warning) count at spent + committed, against the budget as the agreement.
    const covered = new Set(w.map((x) => x.p)), rest = ps.filter((p) => !covered.has(p)).flatMap((p) => lines(p).filter((l) => inH(l.code)));
    return { code, label: HEADINGS[code], budget, spent, committed: Math.max(0, exposure - spent),
      baseline: w.reduce((a, x) => a + x.baseline, 0) + rest.reduce((a, l) => a + n(l.approved), 0),
      projected: w.reduce((a, x) => a + x.projected, 0) + rest.reduce((a, l) => a + lineExposure(l), 0),
      stage: w.map((x) => x.stage).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] ?? 'ok',
      flagged: w.filter((x) => x.stage === 'addendum' || x.stage === 'notify-now').map((x) => x.p.code) };
  }).filter((h) => h.budget || h.spent);
}

/** 3. Cumulative spent and spent + committed by month (each project at its latest report). */
export function committedSeries(P: Project[], today: Date) {
  const ps = live(P), S = portfolioSeries(ps, today), now = today.getTime();
  const R = ps.map((p) => reports(p).map((r) => ({ t: r.t, v: { a: sumL(r.L, (l) => n(l.actual)), sc: sumL(r.L, lineExposure) } })));
  return S.filter((x) => x.t <= now + MONTH).map((x) => {
    const v = R.reduce((acc, r) => { const s = stepAt(r, x.t, { a: 0, sc: 0 }); return { a: acc.a + s.a, sc: acc.sc + Math.max(s.sc, s.a) }; }, { a: 0, sc: 0 });
    return { t: x.t, spent: v.a, committed: v.sc - v.a };
  });
}

/** 4. Cumulative spend split into staff (1.1.1 / 1.2.1), charging back (4.2, 4.4) and activities. */
const isStaff = (c: string) => /^1\.[12]\.1(\.|$)/.test(c), isCb = (c: string) => c === '4.2' || c === '4.4';
export function mixSeries(P: Project[], today: Date) {
  const ps = live(P), S = portfolioSeries(ps, today), now = today.getTime();
  const R = ps.map((p) => reports(p).map((r) => ({ t: r.t, v: {
    staff: sumL(r.L, (l) => n(l.actual), isStaff), cb: sumL(r.L, (l) => n(l.actual), isCb),
    act: sumL(r.L, (l) => n(l.actual), (c) => /^[1-6](\.|$)/.test(c) && !isStaff(c) && !isCb(c)) } })));
  return S.filter((x) => x.t <= now + MONTH).map((x) => {
    const v = R.reduce((a, r) => { const s = stepAt(r, x.t, { staff: 0, cb: 0, act: 0 }); return { staff: a.staff + s.staff, cb: a.cb + s.cb, act: a.act + s.act }; }, { staff: 0, cb: 0, act: 0 });
    const tot = v.staff + v.cb + v.act;
    return { t: x.t, ...v, ratio: tot > 0 ? v.staff / tot : null };
  });
}

/** 5. Cash received from the donor against cumulative spending; the next request is due when spending reaches 70% of it. */
export function cashSeries(P: Project[], today: Date) {
  const ps = live(P).map((p) => ({ p, c: cashRow(p, today) })).filter((x) => x.c.received > 0), S = portfolioSeries(ps.map((x) => x.p), today);
  // Entered payments on their dates; without any, the contract's first payment at the start (marked as expected).
  const pay = ps.flatMap(({ p, c }) => p.payments?.length ? p.payments.map((x) => ({ t: parseDate(x.date).getTime(), v: n(x.amount) })) : [{ t: parseDate(p.start).getTime(), v: c.received }]).sort((a, b) => a.t - b.t);
  const threshold = ps.length ? ps.reduce((a, x) => a + x.c.threshold * x.c.received, 0) / ps.reduce((a, x) => a + x.c.received, 0) : 0.7;
  const rows = S.map((x) => ({ t: x.t, received: pay.filter((y) => y.t <= x.t).reduce((a, y) => a + y.v, 0), spent: x.actual ?? x.mid ?? 0, past: x.actual != null }));
  const now = today.getTime(), cur = rows.filter((r) => r.t <= now).at(-1);
  const due = rows.find((r) => r.t > now && r.spent >= r.received * threshold);
  return { rows, projects: ps.length, expected: ps.filter((x) => x.c.expected).length, threshold, usedNow: cur && cur.received ? cur.spent / cur.received : null,
    dueAt: cur && cur.received && cur.spent >= cur.received * threshold ? now : due?.t ?? null };
}

/** 6. For each report with planned expenditure: what it planned for the next period and what was spent until the next report. */
export function accuracyRows(P: Project[]) {
  const out: { t: number; planned: number; spent: number; projects: string[] }[] = [];
  for (const p of live(P)) {
    const R = reports(p);
    for (let i = 0; i + 1 < R.length; i++) {
      const planned = sumL(R[i].L, (l) => n(l.forecast)); if (!(planned > 0)) continue;
      const spent = sumL(R[i + 1].L, (l) => n(l.actual)) - sumL(R[i].L, (l) => n(l.actual));
      const d = new Date(R[i].t), k = Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3 + 2, 28);
      const row = out.find((x) => x.t === k);
      if (row) { row.planned += planned; row.spent += spent; row.projects.push(p.code); } else out.push({ t: k, planned, spent, projects: [p.code] });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
