import { byPeriodThenImport, lineExposure, lines, n } from './calc';
import type { Project } from './types';
import type { PO } from './workbook';

/**
 * Service providers: national / local consultants, interpretation, translation, and the event services of line 5.7.
 * Two views of the same money: the ceilings set in the approved budget (amount and unit rate per line) and what was
 * actually bought, supplier by supplier, from the purchase orders of the latest report workbook.
 */
export type Kind = 'consult' | 'intl' | 'interp' | 'transl' | 'events';
export const KINDS: { k: Kind; label: string; color: string }[] = [
  { k: 'consult', label: 'Consultants — national / local', color: '#3b82c4' },
  { k: 'intl', label: 'Consultants — international', color: '#8e4ec6' },
  { k: 'interp', label: 'Interpretation', color: '#0e9384' },
  { k: 'transl', label: 'Translation', color: '#c27c0e' },
  { k: 'events', label: 'Conferences / seminars (5.7)', color: '#64748b' },
];

const INTERP = /interpr|tercüm|sözlü çeviri|simultan|consecutive|ardıl/i;
const TRANSL = /translat|çeviri|traduc|proof-?read|redaksiyon/i;
const CONSULT = /consult|expert|danışman|uzman|trainer|eğitmen/i;
const INTL = /international|uluslararası|foreign/i;
/** Kind of a line by its budget code only: 1.1.2 / 1.1.3 local consultants, 1.2.2 / 1.2.3 international consultants,
 *  5.5.1 translation, 5.5.2 interpretation, 5.7 conferences. Other lines (5.1, 5.8 …) never count, whatever their wording.
 *  Within 5.7 a PO's own wording can name it an interpretation, translation or consultant service. */
export function kindOf(text: string, code = ''): Kind | null {
  if (/^5\.5\.1(\.|$)/.test(code)) return 'transl';
  if (/^5\.5\.2(\.|$)/.test(code)) return 'interp';
  if (/^1\.1\.[23](\.|$)/.test(code)) return 'consult';
  if (/^1\.2\.[23](\.|$)/.test(code)) return 'intl';
  if (/^5\.7(\.|$)/.test(code)) {
    if (INTERP.test(text)) return 'interp';
    if (TRANSL.test(text)) return 'transl';
    if (CONSULT.test(text)) return INTL.test(text) ? 'intl' : 'consult';
    return 'events';
  }
  return null;
}

/** Description of a line with the names of its heading rows (1.1 "Local" → 1.1.3 "Short-term consultant"). */
function fullText(p: Project, code: string, description = '') {
  const N = p.approvedBudget?.names ?? {};
  const parents = code.split('.').slice(0, -1).map((_, i, a) => N[a.slice(0, i + 1).join('.')] ?? '');
  return [...parents, description].join(' ');
}

export interface CeilingRow { p: Project; code: string; description: string; kind: Kind; unit: string; units: number | null; rate: number | null; approved: number; exposure: number; remaining: number; used: number }
/** Budget lines of the service kinds with their ceilings (amount, unit rate) and spent + committed. */
export function ceilings(P: Project[]): CeilingRow[] {
  return P.flatMap((p) => lines(p).flatMap((l) => {
    const kind = kindOf(fullText(p, l.code, l.description), l.code); if (!kind) return [];
    const approved = n(l.approved), exposure = lineExposure(l);
    if (!approved && !exposure) return [];
    return [{ p, code: l.code, description: l.description || `Line ${l.code}`, kind, unit: l.unit ?? '', units: l.approvedUnits ?? null, rate: l.unitRate ?? null, approved, exposure, remaining: approved - exposure, used: approved ? exposure / approved : exposure ? Infinity : 0 }];
  }));
}

export interface ProviderPO extends PO { p: Project; kind: Kind }
/** Purchase orders of the latest report workbook that pay a service provider of one of the kinds. */
export function providerPOs(P: Project[]): ProviderPO[] {
  return P.flatMap((p) => {
    const wb = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.workbook).sort(byPeriodThenImport).at(-1)?.snapshot?.workbook;
    if (!wb?.pos?.length) return [];
    const byCode = new Map(lines(p).map((l) => [l.code, l.description ?? '']));
    return wb.pos.flatMap((x) => {
      // The PO's own wording decides first (a 5.7 event PO can be an interpreter); otherwise the line it is posted on.
      const kind = kindOf(`${x.description} ${x.nature}`, x.line) ?? kindOf(fullText(p, x.line, byCode.get(x.line)), x.line);
      return kind && (x.sc || x.amount) ? [{ ...x, p, kind }] : [];
    });
  });
}

export interface SupplierRow { supplier: string; kind: Kind; pos: number; amount: number; spent: number; sc: number; projects: Map<string, number>; max: number }
/** Suppliers per kind, summed over the projects; `max` is the largest amount in a single project. */
export function suppliers(L: ProviderPO[]): SupplierRow[] {
  const m = new Map<string, SupplierRow>();
  for (const x of L) {
    const name = x.supplier.trim() || '(no supplier)', k = `${x.kind}|${name.toLowerCase()}`;
    const g = m.get(k) ?? { supplier: name, kind: x.kind, pos: 0, amount: 0, spent: 0, sc: 0, projects: new Map(), max: 0 };
    const v = x.sc || x.amount;
    g.pos++; g.amount += x.amount; g.spent += x.spent; g.sc += v;
    g.projects.set(x.p.id, (g.projects.get(x.p.id) ?? 0) + v); g.max = Math.max(g.max, g.projects.get(x.p.id)!);
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.sc - a.sc);
}
