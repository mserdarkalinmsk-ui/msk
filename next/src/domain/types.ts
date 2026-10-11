export interface Country { id: string; name: string; region?: string; iso3?: string }

export interface BudgetLine {
  code: string; description?: string; approved?: number | null; actual?: number | null;
  spentCommitted?: number | null; committed?: number | null; forecast?: number | null;
}

export interface ReportingPeriod {
  id: string; name: string; type: string; date: string; fileName?: string; registeredAt?: string;
  snapshot?: { format?: string; lines: BudgetLine[] };
}

export interface Activity { id: string; code: string; name: string; group?: string; P?: number[]; E?: number[]; status?: string }
export interface Risk { id: string; title: string; category?: string; likelihood?: string | number; impact?: string | number; mitigation?: string; status?: string; owner?: string }

export interface Project {
  id: string; code: string; name: string; country: string; sector?: string; funding?: string;
  start: string; end: string; budget: number; spent?: number; committed?: number; fte?: number;
  successor?: string; status?: string;
  reportingPeriods?: ReportingPeriod[];
  doa?: { start: string; months: number; acts: Activity[] };
  contract?: Record<string, unknown>;
  riskRegister?: Risk[];
}

export interface Ledger { countries: Country[]; projects: Project[] }
