export interface Country { id: string; name: string; region?: string; iso3?: string; /** Default CCM (cost centre) for projects in this country */ ccm?: string }

export interface BudgetLine {
  code: string; description?: string; approved?: number | null; actual?: number | null;
  spentCommitted?: number | null; committed?: number | null; forecast?: number | null;
  unit?: string; approvedUnits?: number | null; unitRate?: number | null; reportedUnits?: number | null; reportedUnitRate?: number | null;
  proposedBudget?: number | null; roundedBudget?: number | null;
}

export interface ReportingPeriod {
  id: string; name: string; type: string; date: string; fileName?: string; registeredAt?: string;
  snapshot?: { format?: string; lines: BudgetLine[]; staffRecords?: import('./staff').StaffRecord[]; staffGroups?: Record<string, import('./staff').StaffGroup>; workbook?: import('./workbook').WorkbookSummary };
}

export interface Activity { id: string; code: string; name: string; group?: string; P?: number[]; E?: number[]; X?: number[]; status?: string }
export interface Risk { id: string; title: string; category?: string; likelihood?: string | number; impact?: string | number; mitigation?: string; status?: string; owner?: string }

export interface Project {
  id: string; code: string; name: string; country: string; sector?: string; funding?: string;
  start: string; end: string; budget: number; spent?: number; committed?: number; fte?: number;
  successor?: string; status?: string;
  /** Start/end are placeholders until the DoA, contract or a confirmed edit sets them. */
  datesTbc?: boolean;
  /** Organisational identifiers from the master project list */
  mae?: string; pmm?: string; bh?: string; ccm?: string; pmmUrl?: string; contractNo?: string; jp?: string;
  staffOverrides?: Record<string, import('./staff').StaffOverride>;
  indicators?: import('./documents').Indicator[];
  documents?: { name: string; kind: string; importedAt: string; summary: string[] }[];
  reportingPeriods?: ReportingPeriod[];
  doa?: { start: string; months: number; acts: Activity[] };
  contract?: Record<string, unknown>;
  riskRegister?: Risk[];
  closure?: { done?: Record<string, boolean>; received?: number; euShare?: number; notes?: string };
  /** Assumptions from the DoA (risk analysis section). */
  assumptions?: string[];
  /** Approved budget baseline (DoA / budget annex). Sets the project budget until replaced by a newer approved budget. */
  approvedBudget?: import('./documents').ApprovedBudget;
  /** Clarification and justification per budget line (budget annex), keyed by line code. */
  budgetNotes?: Record<string, import('./documents').BudgetNote>;
}

export interface AuditEntry { at: string; message: string; project?: string }
export interface Ledger { countries: Country[]; projects: Project[]; /** programme offices' own running-cost budgets */ offices?: import('./office').Office[]; /** newest first */ audit?: AuditEntry[]; /** deleted items, newest first, restorable */ trash?: TrashItem[]; /** monthly checklist ticks: month (YYYY-MM) → task key → when ticked */ checklist?: Record<string, Record<string, string>>; /** organisation logo (data URL) and name, added by the user */ brand?: { logo?: string; name?: string; title?: string } }
export interface TrashItem { id: string; at: string; kind: 'project' | 'country' | 'report' | 'document' | 'risk' | 'office-report'; label: string; data: unknown; pid?: string; officeId?: string; projects?: Project[] }

export const SECTORS = ['Human Rights', 'Democracy', 'Rule of Law'] as const;
export type Sector = (typeof SECTORS)[number];

/** Maps free-text sector names (any case, common variants, Turkish) to the fixed list. */
export function normalizeSector(s: string | undefined): Sector | null {
  // Fold case and accents (incl. Turkish İ/ı) so "İnsan Hakları" matches "insan haklari".
  const t = (s ?? '').trim().replace(/[İI]/g, 'i').replace(/ı/g, 'i').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[\s_-]+/g, ' ');
  if (!t) return null;
  if (/^(human rights?|hr|insan haklari)$/.test(t)) return 'Human Rights';
  if (/^(democracy|democratic|demokrasi)$/.test(t)) return 'Democracy';
  if (/^(rule of law|rol|hukukun ustunlugu)$/.test(t)) return 'Rule of Law';
  return null;
}

/** Only plain http(s) links without embedded credentials are accepted. */
export function validUrl(v: string | undefined): string | null {
  const t = (v ?? '').trim(); if (!t) return null;
  try { const u = new URL(t); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
