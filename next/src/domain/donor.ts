import type { Ledger, ReportingPeriod } from './types';

/** Staff reporting lines (1.1.1.x local staff, 1.2.1.x HQ staff): their purchase orders and postings name the person. */
const staffLine = (code: string | undefined) => /^1\.[12]\.1(\.|$)/.test(code ?? '');

/** A report without the people in it: staff records, and the names in the staff lines' POs, postings and movements. */
function donorReport(r: ReportingPeriod): ReportingPeriod {
  if (!r.snapshot) return r;
  const wb = r.snapshot.workbook;
  return { ...r, snapshot: { ...r.snapshot, staffRecords: undefined, staffGroups: undefined, ...(wb ? { workbook: {
    ...wb,
    // suppliers are named on no line: who the office buys from stays with the office
    pos: (wb.pos ?? []).map((x) => (staffLine(x.line) ? { ...x, description: 'Staff contract', supplier: '' } : { ...x, supplier: '' })),
    ...(wb.entries ? { entries: wb.entries.map((x) => (staffLine(x.line) ? { ...x, description: 'Staff cost', detail: '', supplier: '' } : { ...x, supplier: '' })) } : {}),
    movements: (wb.movements ?? []).map((x) => (staffLine(x.article) ? { ...x, description: 'Staff cost' } : x)),
  } } : {}) } };
}

/** The donor version: staff names and contracts, suppliers, the office's own notes, office budgets, core teams, contracts, change history and the trash are left out. */
export function donorLedger(L: Ledger): Ledger {
  return { countries: L.countries, projects: L.projects.map(({ staffOverrides: _s, ...p }) => { void _s; return {
    ...p, reportingPeriods: p.reportingPeriods?.map(donorReport),
    ...(p.closure ? { closure: { ...p.closure, notes: undefined } } : {}),
    ...(p.payments ? { payments: p.payments.map(({ note: _n, ...x }) => { void _n; return x; }) } : {}),
  }; }), audit: [] };
}
