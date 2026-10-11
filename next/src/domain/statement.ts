import { lines as linesOf } from './calc';
import type { Project } from './types';
import type { WbLine, WbTotals } from './workbook';

/** Sums the latest report lines of several projects by line code into one statement. */
export function portfolioStatement(P: Project[]) {
  const by = new Map<string, WbLine>();
  // A line that is a leaf in one project can be broken down in another (5.7 vs 5.7.1–5.7.3): keep it as a
  // "not broken down" child so its amount still counts in the sub-total and the totals.
  const all = P.map((p) => linesOf(p)), codes = new Set(all.flat().map((l) => l.code));
  const parentElsewhere = (c: string) => [...codes].some((o) => o !== c && o.startsWith(c + '.'));
  for (const PL of all) for (const l0 of PL) {
    const l = parentElsewhere(l0.code) ? { ...l0, code: `${l0.code}.0`, description: `${l0.description ?? ''} (not broken down)`.trim() } : l0;
    const w = by.get(l.code) ?? { code: l.code, description: l.description ?? '', unit: l.unit ?? '', level: l.code.split('.').length, leaf: true,
      budget: { units: 0, rate: null, cost: 0 }, actual: { units: 0, rate: null, cost: 0 }, sc: 0, planned: { units: null, rate: null, cost: 0 }, rounded: { units: null, rate: null, cost: 0 } };
    w.budget.cost! += l.approved ?? 0; w.budget.units! += l.approvedUnits ?? 0; w.actual.cost! += l.actual ?? 0; w.actual.units! += l.reportedUnits ?? 0;
    w.sc! += l.spentCommitted ?? (l.actual ?? 0) + (l.committed ?? 0); w.planned!.cost! += l.forecast ?? 0; w.rounded!.cost! += l.roundedBudget ?? l.proposedBudget ?? 0;
    by.set(l.code, w);
  }
  const L = [...by.values()].map((w) => ({ ...w, budget: { ...w.budget, rate: w.budget.units ? w.budget.cost! / w.budget.units : null, units: w.budget.units || null }, actual: { ...w.actual, rate: w.actual.units ? w.actual.cost! / w.actual.units : null, units: w.actual.units || null },
    planned: w.planned!.cost ? w.planned : undefined, rounded: w.rounded!.cost ? w.rounded : undefined }));
  for (const l of L) l.leaf = !L.some((o) => o !== l && o.code.startsWith(l.code + '.'));
  const adminL = L.find((l) => l.code === '10'), D = L.filter((l) => l.leaf && l.code !== '10');
  const t = (A: WbLine[]): WbTotals => ({ budget: A.reduce((s, l) => s + (l.budget.cost ?? 0), 0), actual: A.reduce((s, l) => s + (l.actual.cost ?? 0), 0), sc: A.reduce((s, l) => s + (l.sc ?? 0), 0),
    planned: A.reduce((s, l) => s + (l.planned?.cost ?? 0), 0) || undefined, rounded: A.reduce((s, l) => s + (l.rounded?.cost ?? 0), 0) || undefined });
  const direct = t(D), admin = adminL ? t([adminL]) : undefined;
  const eligible = admin ? { budget: direct.budget + admin.budget, actual: direct.actual + admin.actual, sc: direct.sc + admin.sc, planned: direct.planned != null ? direct.planned + (admin.planned ?? 0) : undefined, rounded: direct.rounded != null ? direct.rounded + (admin.rounded ?? 0) : undefined } : undefined;
  return { lines: L.filter((l) => l.code !== '10'), totals: { direct, admin, eligible } };
}

