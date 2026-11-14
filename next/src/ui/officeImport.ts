import { get } from '../data/store';
import { isOfficeWorkbook, readOffice, type OfficeReport } from '../domain/office';
import { readXlsx } from './xlsx';

/** Reads a file as an office budget workbook, or null when it is not one. Raw exports borrow line budgets from the latest earlier report. */
export async function readOfficeFile(f: File): Promise<OfficeReport | null> {
  if (!/\.xls[xm]$/i.test(f.name)) return null;
  const wb = await readXlsx(await f.arrayBuffer()).catch(() => null);
  if (!wb || !isOfficeWorkbook(wb)) return null;
  const first = readOffice(wb, f.name);
  if (first.hasPlan) return first;
  const prev = (get().ledger.offices ?? []).filter((o) => o.ccm === first.ccm).flatMap((o) => o.reports).filter((r) => r.hasPlan && r.year === first.year).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return prev ? readOffice(wb, f.name, prev) : first;
}
