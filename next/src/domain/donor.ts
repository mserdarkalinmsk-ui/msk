import type { Ledger, ReportingPeriod } from './types';

/** Staff reporting lines (1.1.1.x local staff, 1.2.1.x HQ staff): their purchase orders and postings name the person. */
const staffLine = (code: string | undefined) => /^1\.[12]\.1(\.|$)/.test(code ?? '');

/** A report without the people in it: staff records, and the names in the staff lines' POs, postings and movements. */
function donorReport(r: ReportingPeriod): ReportingPeriod {
  if (!r.snapshot) return r;
  const wb = r.snapshot.workbook;
  return { ...r, snapshot: { ...r.snapshot, staffRecords: undefined, staffGroups: undefined, ...(wb ? { workbook: {
    ...wb,
    pos: (wb.pos ?? []).map((x) => (staffLine(x.line) ? { ...x, description: 'Staff contract', supplier: '' } : x)),
    ...(wb.entries ? { entries: wb.entries.map((x) => (staffLine(x.line) ? { ...x, description: 'Staff cost', detail: '', supplier: '' } : x)) } : {}),
    movements: (wb.movements ?? []).map((x) => (staffLine(x.article) ? { ...x, description: 'Staff cost' } : x)),
  } } : {}) } };
}

/** The donor version: staff names and contracts, office budgets, change history and the trash are left out. */
export function donorLedger(L: Ledger): Ledger {
  return { countries: L.countries, projects: L.projects.map(({ staffOverrides: _s, ...p }) => { void _s; return { ...p, reportingPeriods: p.reportingPeriods?.map(donorReport) }; }), audit: [] };
}
