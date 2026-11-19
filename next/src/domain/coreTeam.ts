import { contractSeverity, daysTo, type ContractDue } from './contracts';

/** A member of a programme office's own team (not on a project), entered by hand for the country's office. */
export interface CoreMember {
  id: string; name: string; position: string; grade?: string; start?: string; end?: string;
  /** what pays for the post: Ordinary Budget, LS & Pagoda, or a project (then `project` and its share) */
  fund?: 'ob' | 'ls' | 'project' | 'other';
  project?: string; share?: number; note?: string;
}
export const FUND_LABEL: Record<NonNullable<CoreMember['fund']>, string> = { ob: 'Ordinary Budget', ls: 'LS & Pagoda', project: 'Charged to a project', other: 'Other' };

export interface CoreDue { m: CoreMember; days: number | null; severity: ContractDue['severity'] | 'none' }
/** Each member with the time left on the contract, warned 90, 60 and 30 days before its end (as contracts with providers). */
export function coreDue(M: CoreMember[], today: Date): CoreDue[] {
  return M.map((m) => { if (!m.end) return { m, days: null, severity: 'none' as const }; const d = daysTo(m.end, today); return { m, days: d, severity: contractSeverity(d) }; })
    .sort((a, b) => (a.m.end ?? '9').localeCompare(b.m.end ?? '9') || a.m.name.localeCompare(b.m.name));
}
/** On the team today: started (or no start given) and not ended. */
export const onTeam = (m: CoreMember, today: Date) => (!m.start || daysTo(m.start, today) <= 0) && (!m.end || daysTo(m.end, today) >= 0);
