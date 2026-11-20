import { HEADINGS } from './calc';
import { headings } from './insights';
import type { Project } from './types';

/**
 * Budget changes under the EU–CoE Contribution Agreement (PAGODA general conditions):
 *  - transfers between lines of the same heading are free;
 *  - transfers between headings are applied and notified in writing (at the latest in the next report) while the
 *    cumulative change of each heading stays within the flexibility (25 % of the amount originally entered,
 *    or the rate written in the agreement);
 *  - above it, a change of the total, a new heading, administrative costs (fixed 7 %) or the end date need an addendum;
 *  - using the contingency reserve needs the Contracting Authority's prior written approval.
 */
export type Verdict = 'free' | 'notify' | 'approval' | 'addendum';
export const VERDICT: Record<Verdict, { label: string; tone: string; what: string }> = {
  free: { label: 'No action', tone: 'good', what: 'Transfers within one heading — no notification needed; explain them in the next report.' },
  notify: { label: 'Notification', tone: 'warning', what: 'Within the flexibility between headings — apply and inform the Contracting Authority in writing, at the latest in the next report.' },
  approval: { label: 'Prior approval', tone: 'serious', what: 'Uses the contingency reserve — needs the Contracting Authority\'s prior written approval before any expenditure.' },
  addendum: { label: 'Addendum', tone: 'critical', what: 'Beyond the flexibility, or touches the total, a new heading or administrative costs — request an addendum before applying.' },
};
export interface Transfer { from: string; to: string; amount: number }
export interface HeadingImpact { code: string; label: string; baseline: number; current: number; after: number; change: number; room: { up: number; down: number }; over: boolean; isNew: boolean }
export interface ChangeAdvice { flex: number; verdict: Verdict; reasons: string[]; heads: HeadingImpact[]; per: { t: Transfer; verdict: Verdict; why: string }[] }

const head = (code: string) => code.split('.')[0];
const ORDER: Verdict[] = ['free', 'notify', 'approval', 'addendum'];
const worst = (a: Verdict, b: Verdict) => (ORDER.indexOf(a) > ORDER.indexOf(b) ? a : b);

/** What a set of planned transfers needs, heading by heading, on top of the changes already made since the baseline. */
export function adviseChanges(p: Project, T: Transfer[]): ChangeAdvice {
  const H = headings(p), flex = H.flex;
  const delta = new Map<string, number>();
  for (const t of T) { delta.set(head(t.from), (delta.get(head(t.from)) ?? 0) - t.amount); delta.set(head(t.to), (delta.get(head(t.to)) ?? 0) + t.amount); }
  const codes = [...new Set([...H.rows.map((r) => r.code), ...[...delta.keys()].filter((c) => c !== '10' && c !== '8')])].sort((a, b) => +a - +b);
  const heads: HeadingImpact[] = codes.map((c) => {
    const r = H.rows.find((x) => x.code === c), baseline = r?.baseline ?? 0, current = r?.approved ?? 0, after = current + (delta.get(c) ?? 0);
    const change = baseline ? (after - baseline) / baseline : after ? Infinity : 0;
    return { code: c, label: HEADINGS[c] ?? `Heading ${c}`, baseline, current, after, change, room: { up: Math.max(0, baseline * (1 + flex) - after), down: Math.max(0, after - baseline * (1 - flex)) }, over: Math.abs(change) > flex + 1e-9, isNew: !baseline && after > 0 };
  });
  const reasons: string[] = [];
  const per = T.map((t) => {
    const a = head(t.from), b = head(t.to);
    if (a === '10' || b === '10') return { t, verdict: 'addendum' as Verdict, why: 'Administrative costs are a fixed 7 % of direct costs — they cannot be moved by a transfer.' };
    if (a === '8' || b === '8') return { t, verdict: 'approval' as Verdict, why: 'Contingency reserve — prior written approval of the Contracting Authority.' };
    if (a === b) return { t, verdict: 'free' as Verdict, why: `Within heading ${a} ${HEADINGS[a] ?? ''}`.trim() };
    const hb = heads.find((h) => h.code === b), ha = heads.find((h) => h.code === a);
    if (hb?.isNew) return { t, verdict: 'addendum' as Verdict, why: `Heading ${b} had no budget in the agreement — a new heading needs an addendum.` };
    const over = [ha, hb].filter((h) => h?.over).map((h) => `${h!.code} ${h!.label} ${h!.change > 0 ? '+' : ''}${Math.round(h!.change * 100)}%`);
    return over.length ? { t, verdict: 'addendum' as Verdict, why: `Cumulative change above ${Math.round(flex * 100)}%: ${over.join(', ')}` } : { t, verdict: 'notify' as Verdict, why: `Between headings, within ${Math.round(flex * 100)}% of the amounts originally entered` };
  });
  let verdict: Verdict = T.length ? 'free' : 'free';
  for (const x of per) verdict = worst(verdict, x.verdict);
  // Changes already made since the agreement count too: a heading already beyond the limit needs an addendum anyway.
  const already = heads.filter((h) => Math.abs(h.baseline ? (h.current - h.baseline) / h.baseline : 0) > flex + 1e-9);
  if (already.length) { verdict = 'addendum'; reasons.push(`Already beyond ${Math.round(flex * 100)}% before these transfers: ${already.map((h) => `${h.code} ${h.label}`).join(', ')}`); }
  for (const v of ORDER.slice(1)) if (per.some((x) => x.verdict === v)) reasons.push(VERDICT[v].what);
  return { flex, verdict, reasons, heads, per };
}
