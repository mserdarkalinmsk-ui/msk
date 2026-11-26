import { fixBudgetAdmin, fixContract } from './documents';
import { EXTRACTION, extractionLines, isExtraction } from './extraction';
import type { Project } from './types';
import { fixExtractionUnits, fixLevy, fixTypedUnits, relineEntries } from './workbook';

/**
 * A project as every screen reads it: stored data from earlier versions corrected (7% admin read as contingency,
 * invoices of split POs on one line, a tranche levy taken as admin costs) and system extractions laid on the
 * current approved budget. Run on load, on save and on shared copies, so all screens start from the same figures.
 */
export function normalizeProject(p00: Project): Project {
  // A snapshot saved without its lines list (older or partial data) is a report without lines.
  const p0 = p00.reportingPeriods?.some((r) => r?.snapshot && !Array.isArray(r.snapshot.lines))
    ? { ...p00, reportingPeriods: p00.reportingPeriods.map((r) => (r?.snapshot && !Array.isArray(r.snapshot.lines) ? { ...r, snapshot: { ...r.snapshot, lines: [] } } : r)) } : p00;
  const p1 = fixContract(fixBudgetAdmin(p0));
  // Invoices of a PO split over several lines go to the line each names (older imports put them all on one).
  const p = p1.reportingPeriods?.some((r) => r.snapshot?.workbook?.entries?.length) ? { ...p1, reportingPeriods: p1.reportingPeriods.map((r) => { const w = r.snapshot?.workbook; if (!w?.entries?.length) return r; const w2 = fixExtractionUnits(fixTypedUnits(fixLevy(relineEntries(w)))); return w2 === w ? r : { ...r, snapshot: { ...r.snapshot!, workbook: w2 } }; }) } : p1;
  if (!p.reportingPeriods?.some((r) => isExtraction(r.snapshot))) return p;
  return { ...p, reportingPeriods: p.reportingPeriods.map((r) => (isExtraction(r.snapshot) ? { ...r, snapshot: { ...r.snapshot!, format: EXTRACTION, lines: extractionLines(r.snapshot!.workbook!, p) } } : r)) };
}
