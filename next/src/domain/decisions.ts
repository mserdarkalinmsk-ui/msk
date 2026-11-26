import { dayMonYear } from './dt';
import { cashRow, ending } from './cash';
import { portfolioWarnings } from './earlywarn';
import { health } from './health';
import { renewals, roster } from './staff';
import type { Project } from './types';
import { plabel } from './label';

/** What needs a decision or an action this month, most urgent first, from the checks the app already runs. */
export interface Decision { tone: 'bad' | 'warn'; kind: string; p?: Project; text: string; /** the date it is about (a contract's end), ISO */ at?: string }
/** What one item of each kind counts, how it reads in a sentence, and what the group means — so a figure always says what it counts. */
export const KIND_INFO: Record<string, { unit: [string, string]; say: [string, string]; note: string }> = {
  Addendum: { unit: ['heading', 'headings'], say: ['addendum', 'addenda'], note: 'Budget headings that will go beyond the allowed flexibility at the current pace' },
  Notification: { unit: ['heading', 'headings'], say: ['notification', 'notifications'], note: 'Budget headings already above their budget: transfer and notify' },
  'Payment request': { unit: ['project', 'projects'], say: ['payment request', 'payment requests'], note: 'Projects due to request their next payment' },
  Ending: { unit: ['project', 'projects'], say: ['project ending with money left', 'projects ending with money left'], note: 'Projects ending within 6 months with money left at the current pace' },
  'Staff contract': { unit: ['contract', 'contracts'], say: ['staff contract ending', 'staff contracts ending'], note: 'Staff contracts ending in the next 60 days: renew or let end' },
  Data: { unit: ['item', 'items'], say: ['data check', 'data checks'], note: 'Figures to fix before reporting' },
};
export const kindUnit = (k: string, n: number) => (KIND_INFO[k]?.unit ?? ['item', 'items'])[n === 1 ? 0 : 1];
export const kindSay = (k: string, n: number) => `${n} ${(KIND_INFO[k]?.say ?? [k.toLowerCase(), k.toLowerCase()])[n === 1 ? 0 : 1]}`;
const eur = (v: number) => `€${Math.round(v).toLocaleString('en-GB')}`;
const lab = (p: Project) => (plabel(p));
const d = (s: string) => dayMonYear(new Date(s + 'T00:00:00Z'));

export function decisions(P: Project[], today: Date): Decision[] {
  const out: Decision[] = [], live = P.filter((p) => !p.datesTbc);
  for (const w of portfolioWarnings(live, today)) {
    if (w.stage === 'addendum') out.push({ tone: 'bad', kind: 'Addendum', p: w.p, text: `${lab(w.p)} heading ${w.code} ${w.label}: needs ${Math.round(w.changeIfCovered * 100)}% more than agreed at the current pace — prepare the addendum request` });
    else if (w.stage === 'notify-now') out.push({ tone: 'bad', kind: 'Notification', p: w.p, text: `${lab(w.p)} heading ${w.code} ${w.label}: spent + committed above the heading budget — transfer and notify now` });
  }
  for (const p of live) {
    const c = cashRow(p, today);
    if (c.request === 'now') out.push({ tone: 'bad', kind: 'Payment request', p, text: `${lab(p)}: ${Math.round(c.used * 100)}% of the money received is spent — request the next payment` });
    else if (c.request === 'soon' && c.requestOn) out.push({ tone: 'warn', kind: 'Payment request', p, text: `${lab(p)}: next payment request due around ${d(c.requestOn)}` });
  }
  for (const e of ending(live, today, 6)) if (e.level !== 'ok') out.push({ tone: e.level === 'bad' ? 'bad' : 'warn', kind: 'Ending', p: e.p, text: `${lab(e.p)} ends ${d(e.p.end)}: about ${eur(e.unspent)} would be left at the current pace — plan the spending or an extension` });
  for (const p of live) for (const a of renewals(roster(p, today), today, 60)) out.push({ tone: 'warn', kind: 'Staff contract', p, text: `${lab(p)}: contract of ${a.display} (${a.position}) ends ${d(a.end)}`, at: a.end });
  const bad = live.map((p) => health(p, today)).filter((h) => h.level === 'bad');
  if (bad.length) out.push({ tone: 'warn', kind: 'Data', text: `${bad.length} project${bad.length > 1 ? 's' : ''} with data to fix (${bad.slice(0, 4).map((h) => lab(h.p)).join(', ')}${bad.length > 4 ? '…' : ''}) — see Data health` });
  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'bad' ? -1 : 1));
}
