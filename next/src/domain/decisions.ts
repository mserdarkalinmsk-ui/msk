import { cashRow, ending } from './cash';
import { portfolioWarnings } from './earlywarn';
import { health } from './health';
import { renewals, roster } from './staff';
import type { Project } from './types';

/** What needs a decision or an action this month, most urgent first, from the checks the app already runs. */
export interface Decision { tone: 'bad' | 'warn'; kind: string; p?: Project; text: string }
const eur = (v: number) => `€${Math.round(v).toLocaleString('en-GB')}`;
const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const d = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

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
  for (const p of live) for (const a of renewals(roster(p, today), today, 60)) out.push({ tone: 'warn', kind: 'Staff contract', p, text: `${lab(p)}: contract of ${a.display} (${a.position}) ends ${d(a.end)}` });
  const bad = live.map((p) => health(p, today)).filter((h) => h.level === 'bad');
  if (bad.length) out.push({ tone: 'warn', kind: 'Data', text: `${bad.length} project${bad.length > 1 ? 's' : ''} with data to fix (${bad.slice(0, 4).map((h) => lab(h.p)).join(', ')}${bad.length > 4 ? '…' : ''}) — see Data health` });
  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'bad' ? -1 : 1));
}
