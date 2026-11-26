import { lineExposure, lines, parseDate } from './calc';
import { roster, type Person } from './staff';
import type { Project } from './types';

const MONTH = 30.4375 * 864e5;
const months = (a: string, b: string) => Math.max(0, (parseDate(b).getTime() - parseDate(a).getTime() + 864e5) / MONTH);
const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);

export interface PlanPerson { a: Person; rate: number; rateSource: string; signedLeft: number; renewal: number; toEnd: number }
export interface StaffPlan { people: PlanPerson[]; months: { m: string; signed: number; renewal: number }[]; hrBudget: number; hrExposure: number; hrFree: number; renewalNeed: number; gap: number; end: string }

/** Staff lines of the budget: remuneration 1.1.1.x (local) and 1.2.1.x (HQ). */
const isStaffLine = (code: string) => /^1\.[12]\.1(\.|$)/.test(code);

/**
 * Staff cost to the project end: each active or upcoming person's monthly cost (their contract value ÷ contract months,
 * else the budget unit rate × FTE), the part already under contract, and what renewing them to the end date would need,
 * compared with the uncommitted staff budget.
 */
export function staffPlan(p: Project, today: Date): StaffPlan {
  const t = today.toISOString().slice(0, 10), end = p.end;
  const L = lines(p).filter((l) => isStaffLine(l.code) && !lines(p).some((x) => x !== l && x.code.startsWith(l.code + '.')));
  const hrBudget = L.reduce((s, l) => s + (l.approved ?? 0), 0), hrExposure = L.reduce((s, l) => s + lineExposure(l), 0);
  const people = roster(p, today).filter((a) => (a.status === 'Active' || a.status === 'Upcoming') && a.end).map((a) => {
    const c = a.contracts.filter((x) => x.recordKind !== 'Payroll observation' && x.start && x.end && (x.exposure ?? 0) > 0).sort((x, y) => x.start!.localeCompare(y.start!)).at(-1);
    const line = L.find((l) => l.code === a.code);
    let rate = 0, rateSource = '';
    if (c) { rate = (c.exposure ?? 0) / Math.max(1, months(c.start!, c.end!)); rateSource = `contract ${c.po || ''}`.trim(); }
    else if (line?.unitRate) { rate = line.unitRate * (a.fte ?? 1); rateSource = 'budget rate'; }
    const from = a.start > t ? a.start : t;
    const signedLeft = rate * months(from, a.end < end ? a.end : end);
    const renewal = a.end < end ? rate * months(a.end, end) : 0;
    return { a, rate, rateSource, signedLeft, renewal, toEnd: signedLeft + renewal };
  }).sort((x, y) => y.renewal - x.renewal);
  const M: StaffPlan['months'] = [];
  const s = parseDate(t);
  for (let i = 0; ; i++) {
    const me = monthEnd(s.getUTCFullYear(), s.getUTCMonth() + i); if (i > 120) break;
    const ms = me.slice(0, 8) + '01';
    let signed = 0, renewal = 0;
    for (const x of people) {
      if (x.a.start > me) continue;
      if (x.a.end >= ms) signed += x.rate; else if (ms <= end) renewal += x.rate;
    }
    M.push({ m: me, signed, renewal });
    if (me >= end) break;
  }
  const renewalNeed = people.reduce((a, x) => a + x.renewal, 0), hrFree = hrBudget - hrExposure;
  return { people, months: M, hrBudget, hrExposure, hrFree, renewalNeed, gap: hrFree - renewalNeed, end };
}
