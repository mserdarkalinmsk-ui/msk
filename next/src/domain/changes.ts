import { byPeriodThenImport, money } from './calc';
import { kindOf, supKey } from './providers';
import type { Ledger, Project } from './types';
import type { PO } from './workbook';

const posOf = (p: Project): PO[] => [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.workbook).sort(byPeriodThenImport).at(-1)?.snapshot?.workbook?.pos ?? [];
const poId = (x: PO) => `${x.po}|${x.line}`;
const open = (x: PO) => /open/i.test(x.status) && x.balance > 0.5;

export interface ProjectChange {
  p: Project; added: boolean; spent: number; sc: number; reports: string[]; documents: string[];
  newPOs: PO[]; closedPOs: PO[]; newSuppliers: string[]; dates?: string; budget?: [number, number];
}
export interface Changes { since: string; projects: ProjectChange[]; removed: Project[]; spent: number; sc: number; newPOs: number; newSuppliers: string[] }

/** What changed between an earlier state of the data (a restore point) and now, project by project. */
export function changesSince(old: Ledger, now: Ledger, since: string): Changes {
  const before = new Map(old.projects.map((p) => [p.id, p]));
  const allOldSup = new Set(old.projects.flatMap((p) => posOf(p).map((x) => supKey(x.supplier))));
  const projects: ProjectChange[] = [];
  for (const p of now.projects) {
    const o = before.get(p.id);
    const mN = money(p), mO = o ? money(o) : { spent: 0, committed: 0, budget: 0 };
    const rO = new Set((o?.reportingPeriods ?? []).map((r) => r.id)), dO = new Set((o?.documents ?? []).map((d) => d.name));
    const reports = (p.reportingPeriods ?? []).filter((r) => !rO.has(r.id)).map((r) => r.name);
    const documents = (p.documents ?? []).filter((d) => !dO.has(d.name)).map((d) => d.name);
    const pO = new Map((o ? posOf(o) : []).map((x) => [poId(x), x])), pN = posOf(p);
    const newPOs = pN.filter((x) => !pO.has(poId(x)));
    const closedPOs = pN.filter((x) => { const y = pO.get(poId(x)); return y && open(y) && !open(x); });
    // Salaries, per diems and petty cash are not suppliers.
    const real = (x: PO) => !['staff', 'perdiem', 'petty'].includes(kindOf(`${x.description} ${x.nature}`, x.line, '', x.supplier) ?? '');
    const newSuppliers = [...new Set(newPOs.filter((x) => x.supplier && real(x) && !allOldSup.has(supKey(x.supplier))).map((x) => x.supplier.trim()))];
    const c: ProjectChange = { p, added: !o, spent: mN.spent - mO.spent, sc: mN.spent + mN.committed - (mO.spent + mO.committed), reports, documents, newPOs, closedPOs, newSuppliers };
    if (o && (o.start !== p.start || o.end !== p.end)) c.dates = `${o.start} – ${o.end} → ${p.start} – ${p.end}`;
    if (o && Math.abs(mO.budget - mN.budget) > 1) c.budget = [mO.budget, mN.budget];
    if (c.added || Math.abs(c.spent) > 1 || Math.abs(c.sc) > 1 || reports.length || documents.length || newPOs.length || closedPOs.length || c.dates || c.budget) projects.push(c);
  }
  const ids = new Set(now.projects.map((p) => p.id));
  const sum = (f: (c: ProjectChange) => number) => projects.reduce((a, c) => a + f(c), 0);
  return { since, projects: projects.sort((a, b) => Math.abs(b.spent) - Math.abs(a.spent)), removed: old.projects.filter((p) => !ids.has(p.id)),
    spent: sum((c) => c.spent), sc: sum((c) => c.sc), newPOs: sum((c) => c.newPOs.length), newSuppliers: [...new Set(projects.flatMap((c) => c.newSuppliers))] };
}
