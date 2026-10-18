import type { Project } from './types';
import { parseDate } from './calc';

/**
 * Staff are derived from financial-report workbooks:
 *  - "Purchase Orders" sheet: one row per contract, reporting line 1.x.1.y,
 *    description "Surname, Given - … from dd/mm/yyyy to dd/mm/yyyy … 50 %".
 *  - GL sheet: payroll postings on 1.x.1.y lines (observations, no contract dates).
 *  - Group headings such as "1.1 Local staff" / "1.2 HQ Strasbourg" decide the base.
 * Manual corrections live in project.staffOverrides and always win.
 */

export type Base = 'Local' | 'HQ' | 'Unassigned';
export interface StaffRecord {
  name?: string; code: string; position: string; fte?: number | null; start?: string; end?: string;
  po?: string; actual?: number | null; exposure?: number | null; review?: boolean; description?: string;
  sourceSheet?: string; sourceRow?: number; recordKind?: 'Contract' | 'Payroll observation'; payrollPeriod?: string;
  base?: Base; baseSource?: string;
}
export interface StaffGroup { label: string; sheet: string; row: number }
export interface StaffOverride { start?: string; end?: string; fte?: number | null; leaveDate?: string; note?: string; verified?: boolean; updatedAt?: string }
export interface Sheet { name: string; R: string[][] }

export const n2 = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '');

const POSITIONS: Record<string, string> = {
  '1': 'Senior project manager', '2': 'Project manager', '3': 'Senior project officer', '4': 'Project officer',
  '5': 'Linguistic assistant', '6': 'Financial assistant', '7': 'Project assistant',
};
export const positionFor = (code: string) => (/^1\.[12]\.1\.\d+$/.test(code) ? POSITIONS[code.split('.')[3]] : undefined) ?? 'Staff position';

/** "31/12/2026" or "31.12.2026" → "2026-12-31" ('' if invalid). */
export function dmy(s: string): string {
  const m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/); if (!m) return '';
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1 ? d.toISOString().slice(0, 10) : '';
}
const num = (v: string | undefined) => { if (v == null || v === '') return null; const x = Number(String(v).replace(/[\s€]/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '')); return Number.isFinite(x) ? x : null; };

export function staffGroups(sheets: Sheet[]): Record<string, StaffGroup> {
  const g: Record<string, StaffGroup> = {};
  for (const sh of sheets) sh.R.forEach((r, i) => {
    const text = r.filter(Boolean).join(' ').trim();
    const m = text.match(/^(1\.[12](?:\.1)?)\.?\s+(.+)/);
    if (m && /\b(local|HQ|Strasbourg|SxB|international)\b/i.test(m[2])) g[m[1]] = { label: m[2].trim(), sheet: sh.name, row: i + 1 };
  });
  return g;
}

export function classify(code: string, groups: Record<string, StaffGroup> = {}): { base: Base; baseSource: string } {
  const prefix = code.split('.').slice(0, 3).join('.');
  const g = groups[prefix] ?? groups[prefix.split('.').slice(0, 2).join('.')];
  if (g && /\b(HQ|Strasbourg|SxB)\b/i.test(g.label)) return { base: 'HQ', baseSource: `${g.sheet} row ${g.row}: ${g.label}` };
  if (g && /\blocal\b/i.test(g.label)) return { base: 'Local', baseSource: `${g.sheet} row ${g.row}: ${g.label}` };
  if (prefix === '1.1.1') return { base: 'Local', baseSource: 'Reporting line 1.1.1 — local team' };
  if (prefix === '1.2.1') return { base: 'HQ', baseSource: 'Reporting line 1.2.1 — project management HQ' };
  return { base: 'Unassigned', baseSource: 'No recognised staff reporting group' };
}

function findHeader(sheets: Sheet[], must: string[]) {
  for (const sh of sheets) {
    const at = sh.R.findIndex((r) => must.every((k) => r.some((x) => n2(x) === k)));
    if (at >= 0) { const H = sh.R[at].map(n2); return { sh, at, ix: (k: string) => H.indexOf(k) }; }
  }
  return null;
}

/** Extracts staff contract and payroll records from all sheets of a report workbook. */
export function extractStaff(sheets: Sheet[]): { records: StaffRecord[]; groups: Record<string, StaffGroup> } {
  const groups = staffGroups(sheets), out: StaffRecord[] = [];
  const po = findHeader(sheets, ['reportingline', 'descriptionpo']);
  if (po) {
    const { sh, at, ix } = po, ci = ix('reportingline'), di = ix('descriptionpo'), pi = ix('ponumber'), ai = ix('spentineur'), si = ix('spentandcommittedineur');
    for (let i = at + 1; i < sh.R.length; i++) {
      const r = sh.R[i], code = String(r[ci] ?? '').trim(), desc = String(r[di] ?? '').trim();
      if (!/^1\.\d+\.1\.\d+$/.test(code)) continue;
      const base = { code, position: positionFor(code), po: pi >= 0 ? String(r[pi] ?? '') : '', sourceRow: i + 1, sourceSheet: sh.name, description: desc, recordKind: 'Contract' as const,
        actual: ai >= 0 ? num(r[ai]) : null, exposure: si >= 0 ? num(r[si]) : null };
      const m = desc.match(/^([^,]+,\s*[^-]+?)\s*-\s*(.*)$/);
      if (!m) { out.push({ ...base, review: true }); continue; }
      const dates = desc.match(/from\s+(\d{1,2}[/.]\d{1,2}[/.]20\d\d)\s+to\s+(\d{1,2}[/.]\d{1,2}[/.]20\d\d)/i);
      const pct = desc.match(/(\d+(?:[.,]\d+)?)\s*%/);
      out.push({ ...base, name: m[1].trim(), fte: pct ? Number(pct[1].replace(',', '.')) / 100 : null,
        start: dates ? dmy(dates[1]) : '', end: dates ? dmy(dates[2]) : '', review: !dates || !pct });
    }
  }
  const gl = findHeader(sheets, ['reportingline', 'glnumber']);
  if (gl) {
    const { sh, at, ix } = gl, ci = ix('reportingline'), li = ix('linedescription'), di = ix('description'), gi = ix('glnumber'), ai = ix('spent'), pi = ix('period');
    for (let i = at + 1; i < sh.R.length; i++) {
      const r = sh.R[i], code = String(r[ci] ?? '').trim();
      if (!/^1\.\d+\.1\.\d+$/.test(code)) continue;
      const text = String((li >= 0 && r[li]) || (di >= 0 && r[di]) || '');
      const m = text.match(/([\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*)*,\s*[\p{L}][\p{L}'’.-]*(?:\s+(?!(?:de|vers|from|to)\b)[\p{L}][\p{L}'’.-]*)*)(?=\s+(?:de|vers|from|to|\d)|\s*[-–:;]|$)/iu);
      if (!m) continue;
      out.push({ name: m[1].trim(), code, position: positionFor(code), po: `GL ${gi >= 0 ? r[gi] : ''}`, actual: ai >= 0 ? num(r[ai]) : null,
        payrollPeriod: pi >= 0 ? String(r[pi] ?? '') : '', sourceRow: i + 1, sourceSheet: sh.name, review: true, recordKind: 'Payroll observation' });
    }
  }
  return { records: out.map((x) => ({ ...x, ...classify(x.code, groups) })), groups };
}

/* ---------------- roster ---------------- */
export type Status = 'Active' | 'Upcoming' | 'Ended' | 'Dates missing';
export interface Person {
  key: string; name: string; display: string; project: Project; code: string; position: string; base: Base; baseSource: string;
  fte: number | null; start: string; end: string; status: Status; contracts: StaffRecord[]; review: boolean; override?: StaffOverride; po: string;
}

/** "Doe, Jane" → "Jane Doe". */
export const displayName = (s: string) => { const p = s.split(','); return p.length === 2 ? `${p[1].trim()} ${p[0].trim()}` : s; };
export const personKey = (name: string, code: string) => `${n2(name)}|${code}`;

type StaffProject = Project & { staffOverrides?: Record<string, StaffOverride> };

/** One entry per person and reporting line, merged over all reports (later reports win). */
export function roster(p: StaffProject, today: Date): Person[] {
  const map = new Map<string, Person>();
  const reports = [...(p.reportingPeriods ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  for (const r of reports) for (const x of ((r.snapshot as { staffRecords?: StaffRecord[] } | undefined)?.staffRecords ?? [])) {
    if (!x.name) continue;
    const key = personKey(x.name, x.code);
    let a = map.get(key);
    if (!a) {
      a = { key, name: x.name, display: displayName(x.name), project: p, code: x.code, position: x.position || positionFor(x.code), base: x.base ?? classify(x.code).base, baseSource: x.baseSource ?? '',
        fte: null, start: '', end: '', status: 'Dates missing', contracts: [], review: false, po: '' };
      map.set(key, a);
    }
    const same = a.contracts.findIndex((c) => c.po && c.po === x.po && c.recordKind === x.recordKind);
    if (same >= 0) a.contracts[same] = x; else a.contracts.push(x);
  }
  const t = today.toISOString().slice(0, 10);
  return [...map.values()].map((a) => {
    const C = a.contracts.filter((c) => c.recordKind !== 'Payroll observation' && c.start && c.end).sort((x, y) => x.start!.localeCompare(y.start!));
    const ov = p.staffOverrides?.[a.key];
    const current = C.filter((c) => c.start! <= t && c.end! >= t);
    const pick = current.at(-1) ?? C.filter((c) => c.start! > t)[0] ?? C.at(-1);
    let start = pick?.start ?? '', end = (current.length ? current.map((c) => c.end!).sort().at(-1) : pick?.end) ?? '';
    let fte = pick?.fte ?? null;
    if (ov?.verified) { start = ov.start || start; end = ov.end || end; fte = ov.fte ?? fte; }
    if (ov?.leaveDate && (!end || ov.leaveDate < end)) end = ov.leaveDate;
    const status: Status = !start || !end ? 'Dates missing' : end < t ? 'Ended' : start > t ? 'Upcoming' : 'Active';
    const review = !ov?.verified && (a.contracts.some((c) => c.review) || status === 'Dates missing');
    return { ...a, start, end, fte, status, override: ov, review, po: pick?.po ?? a.contracts.at(-1)?.po ?? '' };
  }).sort((x, y) => x.display.localeCompare(y.display));
}

export const daysUntil = (iso: string, today: Date) => Math.ceil((parseDate(iso).getTime() - today.getTime()) / 86_400_000);

/** People with a contract ending within `days` (and not already ended), soonest first. */
export function renewals(people: Person[], today: Date, days = 120) {
  return people.filter((a) => a.status === 'Active' && a.end && daysUntil(a.end, today) <= days).sort((a, b) => a.end.localeCompare(b.end));
}

/** Head-count and FTE covered by recorded contract dates at each month end. */
export function coverage(people: Person[], from: Date, months: number) {
  const out: { t: number; Local: number; HQ: number; Unassigned: number; fte: number }[] = [];
  for (let i = 0; i < months; i++) {
    const t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i + 1, 0), iso = new Date(t).toISOString().slice(0, 10);
    const on = people.filter((a) => a.start && a.end && a.start <= iso && a.end >= iso);
    out.push({ t, Local: on.filter((a) => a.base === 'Local').length, HQ: on.filter((a) => a.base === 'HQ').length, Unassigned: on.filter((a) => a.base === 'Unassigned').length, fte: on.reduce((s, a) => s + (a.fte ?? 0), 0) });
  }
  return out;
}

/** People working on the projects today (contracts not ended, not yet to start), by base. Undated contracts count. */
export function staffCount(P: StaffProject[], today: Date): { total: number; hq: number; local: number } {
  const seen = new Set<string>(); let hq = 0, local = 0;
  for (const p of P) for (const x of roster(p, today)) {
    if (x.status === 'Ended' || x.status === 'Upcoming' || seen.has(x.key)) continue;
    seen.add(x.key); if (x.base === 'HQ') hq++; else if (x.base === 'Local') local++;
  }
  return { total: seen.size, hq, local };
}
export const staffSplit = (s: { hq: number; local: number }) => [s.hq && `${s.hq} HQ`, s.local && `${s.local} local`].filter(Boolean).join(' · ');
