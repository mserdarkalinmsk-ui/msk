import type { BudgetLine, Project } from './types';
import type { WbLine, Workbook } from './workbook';

export const EXTRACTION = 'CoE system extraction';

/**
 * Lines of a raw system extraction in the standard report shape: every line of the approved budget (or of the
 * latest full report) with its amount and description, spent and spent + committed summed from the entries.
 */
export function extractionLines(wb: Pick<Workbook, 'lines' | 'totals'>, p: Project): BudgetLine[] {
  const full = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.lines?.length && r.snapshot.format !== 'CoE system extraction').sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.snapshot!.lines;
  const base = p.approvedBudget?.lines?.length ? p.approvedBudget.lines : full ?? [];
  const leafs = base.filter((l) => !base.some((x) => x !== l && x.code.startsWith(l.code + '.')));
  const got = new Map(wb.lines.map((l) => [l.code, l]));
  const ad = wb.totals.admin; if (ad) got.set('10', { code: '10', description: '', unit: '', level: 1, leaf: true, budget: { units: null, rate: null, cost: null }, actual: { units: null, rate: null, cost: ad.actual }, sc: ad.sc });
  const out: BudgetLine[] = leafs.map((b) => {
    // Entries posted on a parent code of a broken-down line stay on their own row below.
    const e = got.get(b.code); got.delete(b.code);
    const actual = e?.actual.cost ?? 0, sc = e?.sc ?? actual;
    return { code: b.code, description: b.description, unit: b.unit, approved: b.approved ?? 0, approvedUnits: b.approvedUnits ?? null, unitRate: b.unitRate ?? null, actual: b.code === '10' && !e ? 0 : actual, spentCommitted: b.code === '10' && !e ? 0 : sc, committed: Math.max(0, sc - actual), reportedUnits: e?.actual.units ?? null, reportedUnitRate: null } as BudgetLine;
  });
  for (const [code, e] of got) out.push({ code, description: `Line ${code} (not in the approved budget)`, approved: 0, actual: e.actual.cost ?? 0, spentCommitted: e.sc ?? 0, committed: Math.max(0, (e.sc ?? 0) - (e.actual.cost ?? 0)), reportedUnits: e.actual.units ?? null } as BudgetLine);
  return out.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}


/**
 * The extraction shown as a full statement: every line of the approved budget (headings included) with its
 * budget, units and rate, and the amounts summed from the entries. Re-derived on every read, so a budget added
 * after the extraction fills in the descriptions and budgets.
 */
export function enrichExtraction<W extends Pick<Workbook, 'lines' | 'totals'>>(wb: W, p: Project): W {
  const base = p.approvedBudget?.lines ?? [];
  if (!base.length) return wb;
  const got = new Map(wb.lines.map((l) => [l.code, l]));
  // Entries posted on a code the budget breaks down (5.7 vs 5.7.1–5.7.3) become a "posted on the heading" child.
  const baseCodes = base.map((l) => l.code);
  for (const [c, e] of [...got]) if (baseCodes.some((o) => o.startsWith(c + '.'))) { got.delete(c); got.set(`${c}.0`, { ...e, code: `${c}.0`, description: `Posted on line ${c} (not broken down)` }); }
  // Heading rows (1.1, 1.1.1 …) of the budget come along so the statement shows their names.
  const leafCodes = [...new Set([...baseCodes, ...got.keys()])].filter((c) => c !== '10');
  const codes = [...new Set([...leafCodes, ...leafCodes.flatMap((c) => c.split('.').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('.')))])];
  const isLeaf = (c: string) => !codes.some((o) => o !== c && o.startsWith(c + '.'));
  const lines: WbLine[] = codes.map((code) => {
    const b = base.find((l) => l.code === code), e = got.get(code);
    return { code, description: b?.description || e?.description || p.approvedBudget?.names?.[code] || '', unit: b?.unit ?? '', level: code.split('.').length, leaf: isLeaf(code),
      budget: { units: b?.approvedUnits ?? null, rate: b?.unitRate ?? null, cost: b?.approved ?? null }, actual: e?.actual ?? { units: null, rate: null, cost: 0 }, sc: e?.sc ?? 0 };
  }).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const leafs = lines.filter((l) => l.leaf), sum = (f: (l: WbLine) => number) => leafs.reduce((a, l) => a + f(l), 0);
  const direct = { budget: sum((l) => l.budget.cost ?? 0), actual: sum((l) => l.actual.cost ?? 0), sc: sum((l) => l.sc ?? 0) };
  const ab = base.find((l) => l.code === '10')?.approved ?? p.approvedBudget?.admin ?? 0, ad = wb.totals.admin;
  const admin = { budget: ab, actual: ad?.actual ?? 0, sc: ad?.sc ?? 0 };
  return { ...wb, lines, totals: { direct, admin, eligible: { budget: direct.budget + admin.budget, actual: direct.actual + admin.actual, sc: direct.sc + admin.sc } } };
}
