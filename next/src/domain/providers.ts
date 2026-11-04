import { byUpload, lineExposure, lines, n } from './calc';
import type { Project } from './types';
import type { PO } from './workbook';

/**
 * Service providers: purchase orders sorted into Event management, Consultants (national / international),
 * Visibility, Research and Publication by what they buy (the PO wording), not by the budget code they are posted on.
 * The budget code only decides when the wording says nothing. A user's choice for a PO always wins.
 */
export type Kind = 'events' | 'interp' | 'consult' | 'intl' | 'visibility' | 'research' | 'publication' | 'grants' | 'perdiem' | 'staff' | 'petty';
export const KINDS: { k: Kind; label: string; color: string; optional?: boolean; on?: boolean }[] = [
  { k: 'events', label: 'Event management', color: 'var(--ink-3)' },
  { k: 'interp', label: 'Translation / interpretation', color: '#0891b2' },
  { k: 'consult', label: 'Consultant — national', color: 'var(--c1)' },
  { k: 'intl', label: 'Consultant — international', color: 'var(--c7)' },
  { k: 'visibility', label: 'Visibility', color: 'var(--critical)' },
  { k: 'research', label: 'Research', color: 'var(--c3)' },
  { k: 'publication', label: 'Publication', color: 'var(--warn)' },
  // Groups that can be added to the totals on request.
  { k: 'grants', label: 'Grants (6.1, 6.2)', color: 'var(--good)' },
  { k: 'perdiem', label: 'Per diem & travel (1.3, 2.x, OM)', color: '#a16207', optional: true },
  { k: 'staff', label: 'Staff salaries', color: '#94a3b8', optional: true },
  { k: 'petty', label: 'Petty cash, direct debit & internal', color: '#78716c', optional: true },
];
export const isKind = (v: unknown): v is Kind => KINDS.some((x) => x.k === v);

// Order matters: a PO naming a consultant is a consultant even when it is "for the research study".
const RULES: [Kind | 'person', RegExp][] = [
  ['interp', /interpr|translat|çeviri|\bçevir|tercüm|sözlü çeviri|simultan|consecutive|ardıl|booth|kabin|headset|kulaklık/i],
  // A PO that says it organises an event is event management, whatever the event is about (a study, a training).
  ['events', /event management|event organi[sz]|organi[sz](?:ation|ing|e) (?:of|the)|organisation of|organizasyon/i],
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
const TRAVEL = /^2(\.|$)/, TRAVEL_T = /travel|ticket|flight|airfare|bilet|seyahat|uçak|yolculuk/i;
const MISSION = /\bOM\b|ordre de mission|mission order|görev emri|\bmission\b/i;
const EVENT_CO = /congress|organi[sz]ation|organizasyon|event|tourism|turizm|travel|seyahat|hotel|otel|kongre/i;
const STAFF_T = /\bPAIE\b|payroll|salar(y|ies)|personnel temporaire|maaş|bordro/i;
/** Kind of a PO from its wording, then from its budget line's code and wording; null when it buys none of these. */
export function kindOf(text: string, code = '', lineText = '', supplier = ''): Kind | null {
  // Groups first: they never count as a service, whatever else the wording says.
  if (PETTY.test(text) || /service interne|internal service|internal recharge|direct debit|pr[ée]l[èe]vement|otomatik [öo]deme/i.test(`${text} ${supplier}`)) return 'petty';
  if (STAFF.test(code) || STAFF_T.test(text)) return 'staff';
  const byText = (t: string): Kind | null => {
    for (const [k, re] of RULES) if (re.test(t)) return k === 'person' ? (INTL.test(t) || /^1\.2(\.|$)/.test(code) ? 'intl' : 'consult') : k;
    return null;
  };
  // Travel and per diem lines (1.3.1, 1.3.2): mission orders (OM) and costs of experts are not counted; an event
  // management company paid from these lines (venue, travel of participants) counts as event management.
  // Travel (heading 2) is treated like the per diem lines: people's trips stay out, event companies count.
  if (PERDIEM.test(code) || TRAVEL.test(code) || (TRAVEL_T.test(text) && /consult|expert|staff|participant|uzman|danışman|katılımcı/i.test(text))) {
    if (MISSION.test(text) || PERDIEM_T.test(text) || /consult|expert|danışman|uzman/i.test(text)) return 'perdiem';
    const k = byText(text);
    if (k === 'visibility' || k === 'research' || k === 'publication') return k;
    // Only a real event service: an event company, or the PO organises the event (not a participant's trip to it).
    return EVENT_CO.test(supplier) || /organi[sz]|organizasyon|conference|konferans|venue|catering|congress|kongre|accommodation|konaklama|hotel|otel/i.test(text) ? 'events' : 'perdiem';
  }
  if (PERDIEM_T.test(text)) return 'perdiem';
  if (GRANTS.test(code) || /\bgrant|sub-?grant|hibe/i.test(text)) return 'grants';
  // Translation (5.5.1) and interpretation (5.5.2) lines decide before the wording ("translation of the study").
  if (/^5\.5\.[12](\.|$)/.test(code) || /translat|interpr|terc[üu]m|[çc]evir/i.test(supplier)) return 'interp';
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
  const out = P.flatMap((p) => {
    const wb = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.workbook).sort(byUpload).at(-1)?.snapshot?.workbook;
    if (!wb?.pos?.length) return [];
    const N = p.approvedBudget?.names ?? {}, byCode = new Map(lines(p).map((l) => [l.code, l.description ?? '']));
    return wb.pos.flatMap((x) => {
      const value = x.sc || x.amount; if (!value) return [];
      const key = poKey(p, x), auto = kindOf(`${x.description} ${x.nature} ${PETTY.test(x.supplier) ? x.supplier : ''}`, x.line, `${N[x.line] ?? ''} ${byCode.get(x.line) ?? ''}`, x.supplier);
      return [{ ...x, p, kind: auto, auto, key, value } as ProviderPO];
    });
  });
  // A provider known for interpretation (any of its POs reads as interpretation) is an interpretation firm: its
  // other POs (technical equipment, booths under 5.7, a "conference" PO) count as interpretation too.
  const interp = new Set(out.filter((x) => x.auto === 'interp').map((x) => supKey(x.supplier)));
  for (const x of out) {
    if (x.auto && interp.has(supKey(x.supplier)) && ['events', 'consult', 'intl'].includes(x.auto)) x.auto = 'interp';
    // Choices: a PO's own choice, then the choice made for the whole provider, then the automatic kind.
    const u = set[x.key] ?? set[`sup|${supKey(x.supplier)}`] ?? set[`sup|${x.supplier.trim().toLowerCase()}`];
    x.kind = u === 'none' ? null : isKind(u) ? u : x.auto;
  }
  return out.filter((x) => x.kind || all);
}
/**
 * One key per company, however the name was typed: case, punctuation, the legal form (A.S., INC., LTD. STI …),
 * a city after a dash and "(Fournisseur …)" notes are ignored, so "SERENAS … INC.- ANKARA" and "SERENAS … INC." merge.
 */
export function supKey(s: string) {
  return s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\s*[-–]\s*(ankara|istanbul|izmir|kyiv|tbilisi|strasbourg)\b.*$/i, ' ')
    .replace(/[.,;:'"’()\-–_/&]+/g, ' ')
    .replace(/(?<=^|\s)(a ?s|aş|a ?ş|inc|ltd|limited|sti|şti|org|co|corp|llc|gmbh|sarl|sa|srl|tic|ticaret|san|sanayi|ve)(?=\s|$)/g, ' ').replace(/(?<=^|\s)(a ?s|aş|inc|ltd|sti|şti|org)(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
/** Concentration: the largest provider's share of a kind (procurement spread). */
export function topShare(L: ProviderPO[]): { name: string; share: number } | null {
  const m = new Map<string, { name: string; v: number }>(); let t = 0;
  for (const x of L) { const k = supKey(x.supplier); const g = m.get(k) ?? { name: x.supplier, v: 0 }; g.v += x.value; t += x.value; m.set(k, g); }
  const top = [...m.values()].sort((a, b) => b.v - a.v)[0];
  return top && t > 0 && m.size > 1 ? { name: top.name, share: top.v / t } : top && m.size === 1 && t > 0 ? { name: top.name, share: 1 } : null;
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

/** Service providers in short for the monthly pack and the presentation: the main kinds only (no salaries,
 *  per diems or petty cash), by country, by kind and the largest providers. */
export function providerSummary(P: Project[], set: Record<string, string> = {}, top = 10) {
  const L = providerPOs(P, set).filter((x) => x.kind && !KINDS.find((k) => k.k === x.kind)?.optional);
  const total = L.reduce((a, x) => a + x.value, 0);
  const by = <K,>(f: (x: ProviderPO) => K) => [...L.reduce((m, x) => m.set(f(x), (m.get(f(x)) ?? 0) + x.value), new Map<K, number>())].sort((a, b) => b[1] - a[1]);
  return {
    total, pos: L.length, providers: new Set(L.map((x) => supKey(x.supplier))).size, projects: new Set(L.map((x) => x.p.id)).size,
    countries: by((x) => x.p.country).map(([c, v]) => ({ c, v })),
    kinds: by((x) => x.kind as Kind).map(([k, v]) => ({ k, v, label: KINDS.find((x) => x.k === k)!.label, n: L.filter((x) => x.kind === k).length })),
    top: suppliers(L).slice(0, top),
  };
}
export type ProviderSummary = ReturnType<typeof providerSummary>;
