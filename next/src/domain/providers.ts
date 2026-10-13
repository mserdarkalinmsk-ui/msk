import { byPeriodThenImport, lineExposure, lines, n } from './calc';
import type { Project } from './types';
import type { PO } from './workbook';

/**
 * Service providers: purchase orders sorted into Event management, Consultants (national / international),
 * Visibility, Research and Publication by what they buy (the PO wording), not by the budget code they are posted on.
 * The budget code only decides when the wording says nothing. A user's choice for a PO always wins.
 */
export type Kind = 'events' | 'consult' | 'intl' | 'visibility' | 'research' | 'publication' | 'grants' | 'perdiem' | 'staff' | 'petty';
export const KINDS: { k: Kind; label: string; color: string; optional?: boolean; on?: boolean }[] = [
  { k: 'events', label: 'Event management', color: '#64748b' },
  { k: 'consult', label: 'Consultant — national', color: '#3b82c4' },
  { k: 'intl', label: 'Consultant — international', color: '#8e4ec6' },
  { k: 'visibility', label: 'Visibility', color: '#e5484d' },
  { k: 'research', label: 'Research', color: '#0e9384' },
  { k: 'publication', label: 'Publication', color: '#c27c0e' },
  // Groups that can be added to the totals on request.
  { k: 'grants', label: 'Grants (6.1, 6.2)', color: '#30a46c' },
  { k: 'perdiem', label: 'Per diem (1.3.1, 1.3.2, DSA)', color: '#a16207', optional: true },
  { k: 'staff', label: 'Staff salaries', color: '#94a3b8', optional: true },
  { k: 'petty', label: 'Petty cash', color: '#78716c', optional: true },
];
export const isKind = (v: unknown): v is Kind => KINDS.some((x) => x.k === v);

// Order matters: a PO naming a consultant is a consultant even when it is "for the research study".
const RULES: [Kind | 'person', RegExp][] = [
  ['person', /consult|\bexpert|danışman|uzman|trainer|eğitmen|facilitator|moderat|rapporteur|\bfees?\b|honorari/i],
  ['research', /research|\bstudy\b|studies|survey|assessment|analys[ie]s|mapping|baseline|needs? analysis|evaluation|araştırma|anket|inceleme|değerlendirme|çalışması/i],
  ['publication', /publicat|printing|\bprint|layout|typesett|editing|\bbook|booklet|manual|handbook|guide(?:line)?s?\b|yayın|basım|baskı|matbaa|kitap|kılavuz|el kitabı|dizgi/i],
  ['visibility', /visib|promot|banner|roll-?up|poster|leaflet|brochure|flyer|video|film|photo|social media|communicat|branding|give-?away|merchandis|website|campaign|görünürlük|tanıtım|afiş|broşür|kampanya|iletişim/i],
  ['events', /event|conference|seminar|workshop|meeting|training|venue|catering|coffee|lunch|dinner|accommodation|hotel|room rent|organi[sz]ation of|round ?table|ceremony|toplantı|etkinlik|konferans|çalıştay|eğitim|organizasyon|otel|konaklama|yemek/i],
];
const INTL = /international|foreign|uluslararası|yabancı|abroad/i;
const PETTY = /petty cash|caisse|avance de fonds|cash advance/i; // advances to the office, not a provider
const STAFF = /^1\.[12]\.1(\.|$)/, PERDIEM = /^1\.3\.[12](\.|$)/, GRANTS = /^6\.[12](\.|$)/;
const PERDIEM_T = /per ?diem|\bDSA\b|daily subsistence|subsistence allowance|harcırah|indemnit[éy]s? journali|frais de mission/i;
const MISSION = /\bOM\b|ordre de mission|mission order|görev emri|\bmission\b/i;
const EVENT_CO = /congress|organi[sz]ation|organizasyon|event|tourism|turizm|travel|seyahat|hotel|otel|kongre/i;
const STAFF_T = /\bPAIE\b|payroll|salar(y|ies)|personnel temporaire|maaş|bordro/i;
/** Kind of a PO from its wording, then from its budget line's code and wording; null when it buys none of these. */
export function kindOf(text: string, code = '', lineText = '', supplier = ''): Kind | null {
  // Groups first: they never count as a service, whatever else the wording says.
  if (PETTY.test(text)) return 'petty';
  if (STAFF.test(code) || STAFF_T.test(text)) return 'staff';
  const byText = (t: string): Kind | null => {
    for (const [k, re] of RULES) if (re.test(t)) return k === 'person' ? (INTL.test(t) || /^1\.2(\.|$)/.test(code) ? 'intl' : 'consult') : k;
    return null;
  };
  // Travel and per diem lines (1.3.1, 1.3.2): mission orders (OM) and costs of experts are not counted; an event
  // management company paid from these lines (venue, travel of participants) counts as event management.
  if (PERDIEM.test(code)) {
    if (MISSION.test(text) || PERDIEM_T.test(text) || /consult|expert|danışman|uzman/i.test(text)) return 'perdiem';
    const k = byText(text);
    if (k === 'visibility' || k === 'research' || k === 'publication') return k;
    // Only a real event service: an event company, or the PO organises the event (not a participant's trip to it).
    return EVENT_CO.test(supplier) || /organi[sz]|organizasyon|conference|konferans|venue|catering|congress|kongre|accommodation|konaklama|hotel|otel/i.test(text) ? 'events' : 'perdiem';
  }
  if (PERDIEM_T.test(text)) return 'perdiem';
  if (GRANTS.test(code) || /\bgrant|sub-?grant|hibe/i.test(text)) return 'grants';
  const own = byText(text); if (own) return own;
  if (/^1\.1\.[23](\.|$)/.test(code)) return 'consult';
  if (/^1\.2\.[23](\.|$)/.test(code)) return 'intl';
  if (/^5\.7(\.|$)/.test(code)) return 'events';
  return lineText ? byText(lineText) : null;
}

export const poKey = (p: Project, x: Pick<PO, 'po' | 'line' | 'description'>) => `${p.id}|${x.po}|${x.line}|${x.description}`;
export interface ProviderPO extends PO { p: Project; kind: Kind | null; auto: Kind | null; key: string; value: number }
/**
 * Purchase orders of the latest report workbook of each project, with their kind. `set` holds the user's
 * corrections (a kind, or 'none' to leave a PO out); with `all`, POs of no kind come too (to correct them).
 */
export function providerPOs(P: Project[], set: Record<string, string> = {}, all = false): ProviderPO[] {
  return P.flatMap((p) => {
    const wb = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.workbook).sort(byPeriodThenImport).at(-1)?.snapshot?.workbook;
    if (!wb?.pos?.length) return [];
    const N = p.approvedBudget?.names ?? {}, byCode = new Map(lines(p).map((l) => [l.code, l.description ?? '']));
    return wb.pos.flatMap((x) => {
      const value = x.sc || x.amount; if (!value) return [];
      const key = poKey(p, x), auto = kindOf(`${x.description} ${x.nature} ${PETTY.test(x.supplier) ? x.supplier : ''}`, x.line, `${N[x.line] ?? ''} ${byCode.get(x.line) ?? ''}`, x.supplier);
      const u = set[key], kind = u === 'none' ? null : isKind(u) ? u : auto;
      return kind || all ? [{ ...x, p, kind, auto, key, value }] : [];
    });
  });
}

export interface SupplierRow { supplier: string; kind: Kind; pos: number; spent: number; sc: number; projects: Map<string, number>; max: number }
/** Suppliers per kind, summed over the projects; `max` is the largest amount in a single project. */
export function suppliers(L: ProviderPO[]): SupplierRow[] {
  const m = new Map<string, SupplierRow>();
  for (const x of L) {
    if (!x.kind) continue;
    const name = x.supplier.trim() || '(no supplier)', k = `${x.kind}|${name.toLowerCase()}`;
    const g = m.get(k) ?? { supplier: name, kind: x.kind, pos: 0, spent: 0, sc: 0, projects: new Map(), max: 0 };
    g.pos++; g.spent += x.spent; g.sc += x.value;
    g.projects.set(x.p.id, (g.projects.get(x.p.id) ?? 0) + x.value); g.max = Math.max(g.max, g.projects.get(x.p.id)!);
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.sc - a.sc);
}

/* ---------- budget ceilings by code (consultants and 5.7), for comparison ---------- */
export interface CeilingRow { p: Project; code: string; description: string; kind: Kind; unit: string; units: number | null; rate: number | null; approved: number; exposure: number; remaining: number; used: number }
const codeKind = (c: string): Kind | null => (/^1\.1\.[23](\.|$)/.test(c) ? 'consult' : /^1\.2\.[23](\.|$)/.test(c) ? 'intl' : /^5\.7(\.|$)/.test(c) ? 'events' : null);
export function ceilings(P: Project[]): CeilingRow[] {
  return P.flatMap((p) => lines(p).flatMap((l) => {
    const kind = codeKind(l.code); if (!kind) return [];
    const approved = n(l.approved), exposure = lineExposure(l);
    if (!approved && !exposure) return [];
    return [{ p, code: l.code, description: l.description || `Line ${l.code}`, kind, unit: l.unit ?? '', units: l.approvedUnits ?? null, rate: l.unitRate ?? null, approved, exposure, remaining: approved - exposure, used: approved ? exposure / approved : Infinity }];
  }));
}
