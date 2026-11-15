import { standardRate } from './rates';
import type { Project } from './types';
import type { PO, WbLine } from './workbook';

const n2 = (v: number) => v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = (v: number) => `EUR ${n2(v)}`;
const num = (v: number) => (Math.abs(v - Math.round(v)) < 0.005 ? Math.round(v).toLocaleString('en-GB') : v.toLocaleString('en-GB', { maximumFractionDigits: 2 }));
const PLACE: Record<string, string> = { sxb: 'Strasbourg', ank: 'Ankara', ist: 'Istanbul', izm: 'İzmir' };
const unitWord = (u: string, k: number) => { const w = u.replace(/^per\s+/i, '').toLowerCase().trim() || 'unit'; return k === 1 ? w : w === 'diem' ? 'per diems' : w.endsWith('s') ? w : `${w}s`; };

/** What a purchase order was for, in a few plain words, without the names of people. */
export function poPurpose(po: Pick<PO, 'description' | 'nature'>): { kind: 'mission' | 'expert' | 'event' | 'other'; label: string } {
  const d = po.description.trim();
  if (/^OM\d{2}_/i.test(d)) return { kind: 'mission', label: 'missions of project staff' };
  // A staff contract ("NAME,First - B4/1 - 100% - Ankara from 01/01/2026 to 31/12/2026"): the post, never the person.
  const st = d.match(/^[^,]+,[^-]+-\s*([A-Z]\d+\/\d+)\s*-\s*(\d+%)\s*-\s*([^\d]*?)\s*from\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (st) return { kind: 'other', label: `the salary of the ${st[1]} post (${st[2]}${st[3] ? `, ${st[3].trim()}` : ''}) from ${st[4]} to ${st[5]}` };
  const ex = d.match(/^EXPERT\d*_(.+?)_(.+)$/i);
  if (ex) { const place = PLACE[ex[1].toLowerCase()] ?? ex[1].replace(/_/g, ' '); return { kind: 'expert', label: `the participation of experts in ${place} (${ex[2].replace(/_/g, ' ')})` }; }
  const ev = d.match(/^Event Management[_\s]+(.+)$/i);
  if (ev) { const [name, ...rest] = ev[1].split('_').map((x) => x.trim()).filter(Boolean); return { kind: 'event', label: `${/^(the|for|of|a|an)\b/i.test(name) ? 'the event ' + name.replace(/^the\s+/i, '') : `the ${name}`}${rest.length ? ` (${rest.join(', ')})` : ''}` }; }
  const org = d.match(/^Organi[sz]ation of (?:the )?(.+)$/i);
  if (org) return { kind: 'event', label: `the ${org[1].replace(/\s+/g, ' ').trim()}` };
  if (/^perdiem|^per diem/i.test(d) || /experts?\s*-\s*per diem/i.test(po.nature)) return { kind: 'expert', label: d.replace(/_/g, ' ').replace(/^per\s*diem(s)?\s*(and travel cost\s*)?(for\s*)?/i, 'the per diems of ').replace(/\bcons\b/i, 'consultants') };
  return { kind: 'other', label: d.replace(/_/g, ', ').replace(/\s+/g, ' ').replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase()) };
}

/**
 * Why a line goes above its budget, from the figures only: more units than budgeted and/or a higher unit cost, and
 * the purchase orders behind the spending (events, experts, staff missions), largest first. Nothing is invented: where
 * the file gives no units or no purchase orders, only what it gives is said.
 */
export function increaseReason(p: Project, code: string, wbLines: WbLine[], pos: PO[] = []): string {
  const ab = p.approvedBudget?.lines?.find((l) => l.code === code), wl = wbLines.find((l) => l.code === code);
  const bu = ab?.approvedUnits ?? wl?.budget.units ?? 0, br = ab?.unitRate ?? wl?.budget.rate ?? 0, unit = ab?.unit ?? wl?.unit ?? '';
  const spent = wl?.actual.cost ?? 0, sc = wl?.sc ?? spent, u = wl?.actual.units ?? 0, ar = u ? spent / u : 0;
  const parts: string[] = [];
  // A tariff line (per diems, fees, salaries) has a fixed rate: the increase is a matter of units, counted at that rate.
  if (br > 0 && standardRate({ description: ab?.description ?? wl?.description, unit })) {
    const eq = Math.round((sc / br) * 100) / 100;
    if (eq > bu + 0.004) parts.push(`The increase is due to a higher number of ${unitWord(unit, 2)} than budgeted: the amount spent and committed corresponds to ${num(eq)} ${unitWord(unit, 2)} at the standard rate of ${eur(br)}, against ${num(bu)} planned.`);
  }
  const tariff = parts.length > 0;
  const more = !tariff && bu > 0 && u > bu + 0.004, dearer = !tariff && br > 0 && ar > br * 1.02;
  if (more && dearer) parts.push(`The increase is due both to a higher number of ${unitWord(unit, 2)} than budgeted (${num(u)} used against ${num(bu)} planned) and to a higher average cost (${eur(ar)} against ${eur(br)}).`);
  else if (more) parts.push(`The increase is due to a higher number of ${unitWord(unit, 2)} than budgeted: ${num(u)} have been used against ${num(bu)} planned${ar && br ? `, while the average cost (${eur(ar)}) remains ${ar <= br ? 'within' : 'close to'} the budgeted ${eur(br)}` : ''}.`);
  else if (dearer) parts.push(`The increase is due to a higher average cost than budgeted: ${eur(ar)} per ${unitWord(unit, 1)} against ${eur(br)}${bu ? `, for ${num(u)} of the ${num(bu)} ${unitWord(unit, 2)} planned` : ''}.`);
  else if (!tariff && sc > spent + 0.5) parts.push(`The increase covers the commitments already made on the line.`);
  // What the money went to: the purchase orders of the line, grouped by purpose.
  const P = pos.filter((x) => x.line === code && (x.sc || x.spent) > 0.005);
  if (P.length) {
    const G = new Map<string, { kind: string; amount: number; n: number }>();
    for (const x of P) { const g = poPurpose(x), k = g.kind === 'mission' ? g.label : g.label.toLowerCase(), y = G.get(k) ?? { kind: g.kind, amount: 0, n: 0 }; y.amount += Math.max(x.sc, x.spent); y.n++; G.set(k, { ...y, kind: g.kind }); }
    const labelOf = new Map(P.map((x) => { const g = poPurpose(x); return [g.kind === 'mission' ? g.label : g.label.toLowerCase(), g.label]; }));
    const top = [...G].sort((a, b) => b[1].amount - a[1].amount), shown = top.slice(0, 4), rest = top.slice(4);
    const say = ([k, g]: (typeof top)[number]) => g.kind === 'mission' ? `${g.n} mission${g.n > 1 ? 's' : ''} of project staff (${eur(g.amount)})` : `${labelOf.get(k)} (${eur(g.amount)})`;
    const list = shown.map(say), tail = rest.length ? ` and ${rest.length} other purchase order${rest.length > 1 ? 's' : ''} (${eur(rest.reduce((a, [, g]) => a + g.amount, 0))})` : '';
    parts.push(`The spending relates to ${list.length > 1 ? `${list.slice(0, -1).join(', ')}${tail ? ', ' : ' and '}${list.at(-1)}` : list[0]}${tail}.`);
  }
  if (sc > spent + 0.5) parts.push(`Of the total, ${eur(sc - spent)} is still committed on open purchase orders.`);
  return parts.join(' ');
}

/** Why a line can give: what stays unused after everything spent and committed. */
export function decreaseReason(budget: number, after: number, sc: number): string {
  return `After all amounts spent and committed (${eur(sc)}), ${eur(budget - sc)} of the line remained unused; the transfer of ${eur(budget - after)} leaves ${eur(after - sc)} available on the line.`;
}
