import type { Severity } from './calc';

/** A contract with a provider (a framework contract or a tender's award), as the user entered it: ceiling, dates, reference. */
export interface Contract { cap?: number; start?: string; end?: string; ref?: string; name?: string; /** country it was entered for, when its provider has no order there yet */ country?: string; /** an office contract: the office budget line it is paid from, and what it is (rent, security…) */ line?: string; kind?: string }
export interface ContractDue { key: string; country?: string; line?: string; kind?: string; name: string; ref?: string; start?: string; end: string; days: number; severity: Severity | 'ok' | 'ended'; cap?: number; used: number }

const day = 864e5;
/** Days from today to the end date (negative once ended). */
export const daysTo = (end: string, today: Date) => Math.round((Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10)) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / day);

/**
 * When a contract needs a decision: 90 days before its end a warning, 60 days serious, 30 days and the last month
 * critical; for 30 days after the end it stays critical (orders may still be placed on it), then it is shown as ended.
 */
export function contractSeverity(days: number): ContractDue['severity'] {
  if (days < -30) return 'ended';
  if (days <= 30) return 'critical';
  if (days <= 60) return 'serious';
  if (days <= 90) return 'warning';
  return 'ok';
}

/** Every contract with an end date, soonest first; `use` gives what was ordered from the provider (by its key). */
export function contractsDue(C: Record<string, Contract>, today: Date, use: (key: string) => { name?: string; used: number } = () => ({ used: 0 })): ContractDue[] {
  return Object.entries(C).filter(([, c]) => c.end).map(([key, c]) => {
    const u = use(key), days = daysTo(c.end!, today);
    return { key, country: c.country, line: c.line, kind: c.kind, name: c.name || u.name || key, ref: c.ref, start: c.start, end: c.end!, days, severity: contractSeverity(days), cap: c.cap, used: u.used };
  }).sort((a, b) => a.end.localeCompare(b.end));
}
/** The ones that need a decision now (warning, serious, critical). */
export const contractAlerts = (D: ContractDue[]) => D.filter((d) => d.severity !== 'ok' && d.severity !== 'ended');

/** What the user is told about a contract's end: in days, coloured by how close it is. */
export const SEV_BADGE: Record<ContractDue['severity'], string> = { critical: 'critical', serious: 'serious', warning: 'warning', ok: 'good', ended: 'neutral' };
export const dueText = (d: ContractDue) => d.days < 0 ? `ended ${-d.days} d ago` : d.days === 0 ? 'ends today' : `${d.days} d left`;
