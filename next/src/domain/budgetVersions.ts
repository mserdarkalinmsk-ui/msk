import type { ApprovedBudget } from './documents';
import { n2 } from './staff';
import { ADMIN_LINE } from './terms';
import type { BudgetLine } from './types';

/**
 * Budget revisions laid side by side in one workbook (CFCU / EU templates): the original budget, then a table per
 * notification or addendum ("Notification No:4", "Notification Budget", "Addendum Budget"), each with its own
 * "Budget All Years" block and year blocks. Every all-years block is read as a version, the year blocks are left out,
 * identical consecutive versions are kept once. The last version is the budget in force.
 */
export interface BudgetVersion { label: string; kind: 'original' | 'notification' | 'addendum' | 'revision'; no?: number; budget: ApprovedBudget; /** its lines do not add up to its own direct-cost row */ gap?: number }
export interface HeadingChange { code: string; label: string; from: number; to: number; pct: number }
export interface VersionStep { from: string; to: string; lines: { code: string; description: string; from: number; to: number }[]; headings: HeadingChange[] }

const num = (s: unknown): number | null => {
  const t = String(s ?? '').replace(/[\s€]/g, ''); if (!t || t === '-') return null;
  const v = Number(/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(t) ? t : t.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};
const HEAD: Record<string, string> = { '1': 'Human resources', '2': 'Travel', '3': 'Equipment and supplies', '4': 'Local office', '5': 'Other costs, services', '6': 'Other' };

function kindOf(label: string): Pick<BudgetVersion, 'kind' | 'no'> {
  const m = label.match(/(notification|addendum|amendment|rider)\s*(?:no\.?|n°|nr\.?|number|#)?\s*[:.]?\s*(\d{1,2})(?![\d.])/i);
  if (/addendum|amendment|rider/i.test(label)) return { kind: 'addendum', no: m ? +m[2] : undefined };
  if (/notification/i.test(label)) return { kind: 'notification', no: m ? +m[2] : undefined };
  if (/revis/i.test(label)) return { kind: 'revision' };
  return { kind: 'original' };
}
const nice = (label: string) => { const k = kindOf(label); return k.kind === 'original' ? 'Original budget' : k.kind === 'revision' ? 'Revised budget' : `${k.kind === 'addendum' ? 'Addendum' : 'Notification'}${k.no ? ` No. ${k.no}` : ''}`; };

/** Versions found in one sheet (rows of cells as text). */
function sheetVersions(R: string[][], fileName: string): BudgetVersion[] {
  const hi = R.findIndex((r) => r.some((c) => ['costs', 'description'].includes(n2(c))) && r.some((c) => n2(c).startsWith('ofunits')));
  if (hi < 1) return [];
  const H = R[hi], descCols = H.map((c, i) => (['costs', 'description'].includes(n2(c)) ? i : -1)).filter((i) => i >= 0);
  const unitsCols = H.map((c, i) => (n2(c).startsWith('ofunits') ? i : -1)).filter((i) => i >= 0);
  const above = (i: number) => String(R[hi - 1]?.[i] ?? '').trim() || String(R[hi - 2]?.[i] ?? '').trim();
  const fileKind = kindOf(fileName.replace(/[_-]+/g, ' '));
  const out: BudgetVersion[] = [], tables = new Set<number>();
  for (const u of unitsCols) {
    const label = above(u - 1) || above(u);
    if (/year\s*\d|^y\d/i.test(label) || /variation/i.test(label)) continue;
    const d = Math.max(...descCols.filter((c) => c < u)); if (!Number.isFinite(d)) continue;
    const tableLabel = above(d), first = !tables.has(d);
    // "Budget All Years" is named after its table; a second one in the same table is the revision made in this file.
    const generic = /budget\s*all\s*years|^total/i.test(label) || !label;
    let name = generic ? (first ? nice(tableLabel) : fileKind.kind !== 'original' ? nice(fileName.replace(/[_-]+/g, ' ')) : 'Revised budget') : nice(label);
    if (name === 'Original budget' && out.length && generic && !first) name = 'Revised budget';
    const lines: BudgetLine[] = [], names: Record<string, string> = {};
    let direct = 0, admin = 0, contingency = 0, total = 0;
    for (let i = hi + 1; i < R.length; i++) {
      // A line added in a revision may be written only in the first table's description column.
      const t = [d, ...descCols].map((c) => String(R[i][c] ?? '').replace(/\s+/g, ' ').trim()).find((x) => x && x !== 'None') ?? ''; if (!t) continue;
      const cost = num(R[i][u + 2]);
      if (/^(7|8|9|10|11)\.\s/.test(t) || /^sub-?total|^total/i.test(t)) {
        if (/indirect|administrative/i.test(t)) admin = cost ?? admin;
        else if (/contingency/i.test(t)) contingency = cost ?? contingency;
        else if (/total eligible costs/i.test(t)) total = cost ?? total;
        else if (/^7\.|sub-?total direct/i.test(t)) direct = cost ?? direct;
        continue;
      }
      const m = t.match(/^(\d{1,2}(?:\.\d{1,2}){0,4})\.?\s+(.+)$/); if (!m) continue;
      names[m[1]] = m[2];
      if (!m[1].includes('.')) continue;
      lines.push({ code: m[1], description: m[2], unit: String(R[i][u - 1] ?? '').trim() || undefined, approvedUnits: num(R[i][u]), unitRate: num(R[i][u + 1]), approved: cost ?? 0 });
    }
    const leaves = lines.filter((l) => !lines.some((o) => o !== l && o.code.startsWith(l.code + '.')) && (l.approved || l.approvedUnits));
    if (leaves.length < 3) continue;
    const sum = leaves.reduce((a, l) => a + (l.approved ?? 0), 0);
    if (!direct) direct = sum;
    if (!total) total = direct + admin + contingency;
    const all = [...leaves, ...(contingency ? [{ code: '8', description: 'Contingency reserve', approved: contingency }] : []), ...(admin ? [{ code: ADMIN_LINE, description: 'Administrative costs', unit: '7%', approved: admin }] : [])];
    const gap = Math.abs(sum - direct) > 1 ? direct - sum : undefined;
    const v = { label: name, gap, ...kindOf(name), budget: { lines: all, names, direct, admin, contingency, total, source: `${fileName} · ${name}`, linesSum: sum } } as BudgetVersion;
    tables.add(d); out.push(v);
  }
  // Identical consecutive versions (a table repeated for the record) are kept once.
  const key = (v: BudgetVersion) => v.budget.lines.map((l) => `${l.code}:${Math.round((l.approved ?? 0) * 100)}`).join('|');
  // A copy whose lines do not add up (a working table left in the file) is dropped unless it is the last one.
  const kept = out.filter((v, i) => v.gap == null || i === out.length - 1);
  return kept.filter((v, i) => !i || key(v) !== key(kept[i - 1]));
}

/** All versions of the workbook, from the sheet that holds the most of them. */
export function budgetVersions(sheets: string[][][], fileName: string): BudgetVersion[] {
  return sheets.map((R) => sheetVersions(R, fileName)).sort((a, b) => b.length - a.length)[0] ?? [];
}

/** What changed from each version to the next: lines and headings (with the share of the heading in the first version). */
export function versionSteps(V: BudgetVersion[]): VersionStep[] {
  const head = (b: ApprovedBudget, h: string) => b.lines.filter((l) => l.code.split('.')[0] === h && l.code.includes('.')).reduce((a, l) => a + (l.approved ?? 0), 0);
  return V.slice(1).map((v, i) => {
    const a = V[i].budget, b = v.budget, codes = [...new Set([...a.lines, ...b.lines].map((l) => l.code))].filter((c) => c.includes('.'));
    const lines = codes.map((code) => { const x = a.lines.find((l) => l.code === code), y = b.lines.find((l) => l.code === code);
      return { code, description: y?.description ?? x?.description ?? '', from: x?.approved ?? 0, to: y?.approved ?? 0 }; }).filter((l) => Math.abs(l.to - l.from) > 0.5)
      .sort((p, q) => p.code.localeCompare(q.code, undefined, { numeric: true }));
    const headings = Object.keys(HEAD).map((h) => { const f = head(a, h), t = head(b, h); return { code: h, label: HEAD[h], from: f, to: t, pct: f ? (t - f) / f : t ? 1 : 0 }; }).filter((h) => h.from || h.to);
    return { from: V[i].label, to: v.label, lines, headings };
  });
}

/** Headings of the version in force against the first version (the contract): the share each one moved. */
export function againstOriginal(V: BudgetVersion[]): HeadingChange[] {
  if (V.length < 2) return [];
  return versionSteps([V[0], V[V.length - 1]])[0].headings;
}
