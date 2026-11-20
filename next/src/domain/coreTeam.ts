import { contractSeverity, daysTo, type ContractDue } from './contracts';

/** A member of a programme office's own team (not on a project), entered by hand for the country's office. */
export interface CoreMember {
  id: string; name: string; position: string; grade?: string; start?: string; end?: string;
  /** what pays for the post: Ordinary Budget, LS & Pagoda, or a project (then `project` and its share) */
  fund?: 'ob' | 'ls' | 'project' | 'other';
  project?: string; share?: number; note?: string;
  /** the employment contract, attached by the user */ doc?: import('../ui/attach').Attachment;
}
export const FUND_LABEL: Record<NonNullable<CoreMember['fund']>, string> = { ob: 'Ordinary Budget', ls: 'LS & Pagoda', project: 'Charged to a project', other: 'Other' };

export interface CoreDue { m: CoreMember; days: number | null; severity: ContractDue['severity'] | 'none' }
/** Each member with the time left on the contract, warned 90, 60 and 30 days before its end (as contracts with providers). */
export function coreDue(M: CoreMember[], today: Date): CoreDue[] {
  return M.map((m) => { if (!m.end) return { m, days: null, severity: 'none' as const }; const d = daysTo(m.end, today); return { m, days: d, severity: contractSeverity(d) }; })
    .sort((a, b) => (a.m.end ?? '9').localeCompare(b.m.end ?? '9') || a.m.name.localeCompare(b.m.name));
}
/** On the team today: started (or no start given) and not ended. */
export const onTeam = (m: CoreMember, today: Date) => (!m.start || daysTo(m.start, today) <= 0) && (!m.end || daysTo(m.end, today) >= 0);

/* ---------- a core team list read from a spreadsheet ---------- */
const HEAD: [keyof Omit<CoreMember, 'id'>, RegExp][] = [
  ['name', /^(full )?name|staff( member)?$|employee|ad[ıi]? ?soyad|^person/i],
  ['position', /position|title|post|function|role|g[öo]rev|pozisyon|unvan/i],
  ['grade', /grade|level|derece|kademe/i],
  ['start', /start|from|begin|ba[şs]la/i],
  ['end', /end|until|expir|bit[iı]ş|to$/i],
  ['fund', /fund|budget|paid|kaynak|b[üu]t[çc]e/i],
  ['note', /note|comment|remark|a[çc][ıi]klama/i],
];
/** A date as a spreadsheet gives it: an Excel day number, dd/mm/yyyy or yyyy-mm-dd. */
export function sheetDate(v: string): string {
  const t = String(v ?? '').trim();
  if (/^\d{5}(\.\d+)?$/.test(t)) return new Date(Date.UTC(1899, 11, 30) + Math.round(+t) * 864e5).toISOString().slice(0, 10);
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : '';
}
const fundOf = (v: string): CoreMember['fund'] => /pagoda|\bls\b|0128/i.test(v) ? 'ls' : /ordinary|\bob\b|0127/i.test(v) ? 'ob' : /project|bh\s*\d|vc|jp/i.test(v) ? 'project' : v.trim() ? 'other' : 'ob';
/**
 * The core team from a sheet: the first row naming a name and a position column is the heading; every row below with a
 * name is a member. Nothing is guessed: a column that is not there stays empty.
 */
export function coreFromRows(rows: string[][]): CoreMember[] {
  const hi = rows.findIndex((r) => r.some((c) => HEAD[0][1].test(String(c ?? '').trim())) && r.some((c) => HEAD[1][1].test(String(c ?? '').trim())));
  if (hi < 0) return [];
  const H = rows[hi].map((c) => String(c ?? '').trim()), col = new Map<string, number>();
  for (const [k, re] of HEAD) { const i = H.findIndex((h, j) => re.test(h) && ![...col.values()].includes(j)); if (i >= 0) col.set(k, i); }
  const get = (r: string[], k: string) => { const i = col.get(k); return i == null ? '' : String(r[i] ?? '').trim(); };
  return rows.slice(hi + 1).filter((r) => get(r, 'name')).map((r, n) => {
    const s = sheetDate(get(r, 'start')), e = sheetDate(get(r, 'end')), g = get(r, 'grade'), note = get(r, 'note');
    return { id: `ct${Date.now().toString(36)}${n}`, name: get(r, 'name'), position: get(r, 'position') || '—', fund: fundOf(get(r, 'fund')), ...(g ? { grade: g } : {}), ...(s ? { start: s } : {}), ...(e ? { end: e } : {}), ...(note ? { note } : {}) };
  });
}

/* ---------- one list of the people of a country ---------- */
/** Who a name is, whatever the order or the accents: "YILMAZ, Ayse" and "Ayşe Yılmaz" are the same person. */
/** The posts that run with no end date: the head of the office and the head of operations. Any other post without an end date has its date missing. */
export const openPost = (m: Pick<CoreMember, 'position' | 'end'>) => !m.end && /\bhead\s+of\s+(?:the\s+)?(?:office|operations?)\b/i.test(m.position);
/** How a core team contract's end reads: its date, open-ended (head of office / operations), or missing. */
export const coreEnd = (m: Pick<CoreMember, 'position' | 'end'>, fmt: (d: string) => string) => m.end ? fmt(m.end) : openPost(m) ? 'open-ended' : 'end date missing';
export const personKeyOf = (name: string) => name.toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/\p{M}/gu, '').split(/[^a-z0-9]+/).filter(Boolean).sort().join(' ');
export interface ProjectRole { project: string; projectId: string; position: string; end: string; status: string; base?: string }
export interface CountryPerson { key: string; name: string; core?: CoreMember; roles: ProjectRole[]; ends: string; check?: string; /** with no end date: why — the office's own post runs on, SxB staff have no contract dates in the reports, otherwise the dates are missing */ noEnd?: 'open' | 'sxb' | 'missing' }
/**
 * Each person once: the core team member and the project contracts of the same name together, with what pays for them,
 * the nearest contract end, and a check when the two disagree (paid by the office yet on a project's staff list).
 */
export function countryPeople(core: CoreMember[], staff: { name: string; display: string; position: string; end: string; status: string; base?: string; project: { id: string; code: string; bh?: string } }[], label: (p: { id: string; code: string; bh?: string }) => string): CountryPerson[] {
  const by = new Map<string, CountryPerson>();
  for (const m of core) { const k = personKeyOf(m.name); by.set(k, { key: k, name: m.name, core: m, roles: [], ends: m.end ?? '' }); }
  for (const a of staff) {
    const k = personKeyOf(a.name), x = by.get(k) ?? { key: k, name: a.display || a.name, roles: [], ends: '' };
    x.roles.push({ project: label(a.project), projectId: a.project.id, position: a.position, end: a.end, status: a.status, ...(a.base ? { base: a.base } : {}) });
    by.set(k, x);
  }
  for (const x of by.values()) {
    const ends = [x.core?.end, ...x.roles.filter((r) => r.status === 'Active').map((r) => r.end)].filter(Boolean) as string[];
    x.ends = ends.sort()[0] ?? '';
    if (!x.ends) x.noEnd = x.core ? (openPost(x.core) ? 'open' : 'missing') : x.roles.some((r) => r.base === 'HQ') ? 'sxb' : 'missing';
    if (x.core && x.roles.length) {
      const on = x.roles.map((r) => r.projectId);
      if (x.core.fund !== 'project') x.check = `On the core team paid by the office, and on the staff list of ${[...new Set(x.roles.map((r) => r.project))].join(', ')}: check how the post is charged.`;
      else if (x.core.project && !on.includes(x.core.project)) x.check = 'Charged to another project than the one whose staff list names this person.';
    }
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}
