import type { Alert } from './insights';
import type { Severity } from './calc';

/**
 * Alerts as a work list: an alert is open until someone handles it or puts it off. A handled alert stays out of
 * the way while its condition lasts and comes back on its own when it gets more serious; a snoozed one comes back
 * on its date. Every decision is kept in the log with its note.
 */
export interface AlertMark { state: 'done' | 'snoozed'; at: string; /** snoozed until this day (YYYY-MM-DD), not included */ until?: string; note?: string; /** how serious it was when it was marked */ severity: Severity; title: string; project?: string }
export interface AlertLogEntry { at: string; key: string; action: 'done' | 'snoozed' | 'reopened'; title: string; project?: string; note?: string; until?: string }
export type AlertStatus = 'open' | 'done' | 'snoozed';
export type Marks = Record<string, AlertMark> | undefined;

const RANK: Record<Severity, number> = { critical: 0, serious: 1, warning: 2 };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function alertStatus(a: Alert, marks: Marks, today: Date): AlertStatus {
  const m = marks?.[a.key]; if (!m) return 'open';
  if (m.state === 'snoozed') return m.until && m.until > iso(today) ? 'snoozed' : 'open';
  // Handled, but it has become more serious since: it needs another look.
  return RANK[a.severity] < RANK[m.severity] ? 'open' : 'done';
}
/** Why an alert that was handled or snoozed is open again. */
export function backReason(a: Alert, marks: Marks, today: Date): string | undefined {
  const m = marks?.[a.key]; if (!m || alertStatus(a, marks, today) !== 'open') return undefined;
  return m.state === 'snoozed' ? `back from snooze${m.note ? ` — ${m.note}` : ''}` : `more serious than when it was handled (${m.severity} → ${a.severity})`;
}
export function splitAlerts(A: Alert[], marks: Marks, today: Date): Record<AlertStatus, Alert[]> {
  const out: Record<AlertStatus, Alert[]> = { open: [], done: [], snoozed: [] };
  for (const a of A) out[alertStatus(a, marks, today)].push(a);
  return out;
}
export const openAlerts = (A: Alert[], marks: Marks, today: Date) => (marks && Object.keys(marks).length ? A.filter((a) => alertStatus(a, marks, today) === 'open') : A);
/** A day `days` from today, as the snooze date. */
export const snoozeDay = (today: Date, days: number) => iso(new Date(today.getTime() + days * 864e5));
/** Marks older than a year whose alert is gone are dropped, so the list does not grow for ever. */
export function pruneMarks(marks: NonNullable<Marks>, live: Set<string>, today: Date): NonNullable<Marks> {
  const cut = new Date(today.getTime() - 365 * 864e5).toISOString();
  return Object.fromEntries(Object.entries(marks).filter(([k, m]) => live.has(k) || m.at > cut));
}
