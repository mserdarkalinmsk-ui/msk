import type { Severity } from './calc';

/** A contract with a provider (a framework contract or a tender's award), as the user entered it: ceiling, dates, reference. */
export interface Contract { cap?: number; start?: string; end?: string; ref?: string; name?: string; /** country it was entered for, when its provider has no order there yet */ country?: string; /** an office contract: the office budget line it is paid from, and what it is (rent, security…) */ line?: string; kind?: string; /** no end date (a direct debit, a standing service): shown, never warned */ openEnded?: boolean; /** the signed contract, attached by the user */ doc?: import('../ui/attach').Attachment; /** the date beyond which it may not be renewed ("may not be renewed beyond") */ renewBy?: string; /** how it is renewed: the step of each renewal ('month' | 'quarter' | 'year', or a number of months), renewal without a new signature, and the notice to give before the end (days) */ renewEvery?: string; autoRenew?: boolean; noticeDays?: number; /** the monthly fee by the date it applies from, oldest first (a rent revised by an amendment); `fee` is the one in force */ fees?: { from: string; fee: number }[]; /** the contract's documents in order: the original, then each rider, amendment or addendum, with what it changed */ history?: ContractStep[]; /** the fee per month and the total for the period, in `cur` (the contract's own currency) */ fee?: number; total?: number; cur?: string; /** the rows of its table of fees (car rental, fuel…), each a monthly fee in `cur` */ items?: { label: string; fee: number }[] }
/** One document in the life of a contract, with what it changed. */
export interface ContractStep { kind: 'original' | 'amendment' | 'rider' | 'addendum'; no?: number; /** the date it applies from */ effective?: string; /** when it was recorded */ at: string; ref?: string; changes: StepChange[]; doc?: import('../ui/attach').Attachment }
export interface StepChange { field: string; label: string; from?: string | number | boolean; to?: string | number | boolean }
export interface ContractDue { /** the last day to give notice decides the warning while it is ahead */ noticeBy?: string; openEnded?: boolean; key: string; country?: string; line?: string; kind?: string; name: string; ref?: string; start?: string; end: string; days: number; severity: Severity | 'ok' | 'ended'; /** the ceiling in euros, to compare with what was ordered (none when it is in another currency without a rate) */ cap?: number; /** the ceiling as written in the contract, in its currency */ capRaw?: number; capCur?: string; used: number }

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

/**
 * A contract's ceiling in euros, the currency of the orders it is compared with: as written when the contract is in
 * euros, through the rate its orders were booked at when it is in another currency, and none without such a rate.
 */
export const capEur = (c: Contract, rate?: number) => (!c.cap ? undefined : !c.cur || c.cur === 'EUR' ? c.cap : rate ? Math.round(c.cap / rate * 100) / 100 : undefined);

/** Every contract with an end date, soonest first; `use` gives what was ordered from the provider (by its key). */
export function contractsDue(C: Record<string, Contract>, today: Date, use: (key: string) => { name?: string; used: number } = () => ({ used: 0 })): ContractDue[] {
  return Object.entries(C).filter(([, c]) => c.end || c.openEnded).map(([key, c]) => {
    const u = use(key);
    if (!c.end) return { key, openEnded: true, country: c.country, line: c.line, kind: c.kind, name: c.name || u.name || key, ref: c.ref, start: c.start, end: '', days: Infinity, severity: 'ok' as const, cap: capEur(c), capRaw: c.cap, capCur: c.cur ?? 'EUR', used: u.used };
    // with a notice period the decision falls on the last day to give notice, while that day is still ahead
    const nb = c.noticeDays ? new Date(Date.parse(c.end) - c.noticeDays * day).toISOString().slice(0, 10) : '';
    const days = nb && daysTo(nb, today) >= 0 ? daysTo(nb, today) : daysTo(c.end, today);
    return { key, ...(nb && daysTo(nb, today) >= 0 ? { noticeBy: nb } : {}), country: c.country, line: c.line, kind: c.kind, name: c.name || u.name || key, ref: c.ref, start: c.start, end: c.end!, days, severity: contractSeverity(days), cap: capEur(c), capRaw: c.cap, capCur: c.cur ?? 'EUR', used: u.used };
  }).sort((a, b) => (a.end || '9').localeCompare(b.end || '9'));
}
/** The ones that need a decision now (warning, serious, critical). */
export const contractAlerts = (D: ContractDue[]) => D.filter((d) => d.severity !== 'ok' && d.severity !== 'ended');

/** What the user is told about a contract's end: in days, coloured by how close it is. */
export const SEV_BADGE: Record<ContractDue['severity'], string> = { critical: 'critical', serious: 'serious', warning: 'warning', ok: 'good', ended: 'neutral' };
export const dueText = (d: ContractDue) => d.openEnded ? 'open-ended' : d.noticeBy ? (d.days === 0 ? 'notice today' : `notice in ${d.days} d`) : d.days < 0 ? `ended ${-d.days} d ago` : d.days === 0 ? 'ends today' : `${d.days} d left`;

/** What was ordered on an office contract: the office report's orders on its budget line from its supplier (spent + still open). */
export function officeContractUse(entries: { line: string; supplier: string; spent: number; committed: number }[], line: string, supplier: (s: string) => boolean): number {
  return Math.round(entries.filter((e) => e.line === line && supplier(e.supplier)).reduce((a, e) => a + e.spent + e.committed, 0) * 100) / 100;
}
/** How close a contract is to its ceiling: 80% a warning, 90% serious, the ceiling reached critical. */
export function ceilingSeverity(used: number, cap?: number): 'critical' | 'serious' | 'warning' | null {
  if (!cap || cap <= 0) return null; const r = used / cap;
  return r >= 1 ? 'critical' : r >= 0.9 ? 'serious' : r >= 0.8 ? 'warning' : null;
}

/* ---------- riders, amendments and addenda ---------- */
const LABEL: Record<string, string> = { end: 'Ends', renewBy: 'Renewable until', fee: 'Monthly fee', total: 'Total for the period', cap: 'Ceiling', renewEvery: 'Renewed', noticeDays: 'Notice (days)', autoRenew: 'Renews automatically', ref: 'Reference' };
/** What a later document changes in a contract: each term it states that differs from the one in force. */
export function amendmentDiff(c: Contract, t: { end?: string; renewBy?: string; fee?: number; total?: number; renewEvery?: string; noticeDays?: number; autoRenew?: boolean }): StepChange[] {
  return (['end', 'renewBy', 'fee', 'total', 'renewEvery', 'noticeDays', 'autoRenew'] as const)
    .filter((k) => t[k] != null && t[k] !== '' && t[k] !== (c as Record<string, unknown>)[k])
    .map((k) => ({ field: k, label: LABEL[k], from: (c as Record<string, string | number | boolean | undefined>)[k], to: t[k] }));
}
/** The contract once a rider, amendment or addendum is applied: its terms updated, the fee schedule extended, the step kept. */
export function applyAmendment(c: Contract, t: { end?: string; renewBy?: string; fee?: number; total?: number; renewEvery?: string; noticeDays?: number; autoRenew?: boolean; cur?: string; fees?: { from: string; fee: number }[] },
  step: Omit<ContractStep, 'changes'>): Contract {
  const changes = amendmentDiff(c, t);
  const first: ContractStep[] = c.history?.length ? [] : [{ kind: 'original', at: step.at, ref: c.ref, effective: c.start, changes: [], ...(c.doc ? { doc: c.doc } : {}) }];
  // the fee schedule: the fees the document states from their dates on; earlier fees kept, later ones replaced
  const add = t.fees?.length ? t.fees : t.fee != null && step.effective ? [{ from: step.effective, fee: t.fee }] : [];
  const base = c.fees?.length ? c.fees : c.fee != null && c.start ? [{ from: c.start, fee: c.fee }] : [];
  const cut = add.length ? add.map((x) => x.from).sort()[0] : '';
  const fees = [...base.filter((x) => !cut || x.from < cut), ...add].sort((a, b) => a.from.localeCompare(b.from));
  const upd: Partial<Contract> = {}; for (const ch of changes) (upd as Record<string, unknown>)[ch.field] = ch.to;
  return { ...c, ...upd, ...(t.cur && (t.fee != null || t.total != null) ? { cur: t.cur } : {}), ...(fees.length ? { fees, fee: fees.at(-1)!.fee } : {}), history: [...(c.history ?? first), { ...step, changes }] };
}
/** The monthly fee in force on a day. */
export function feeOn(c: Contract, day: string): number | undefined {
  const F = c.fees?.filter((x) => x.from <= day); return F?.length ? F.at(-1)!.fee : c.fee;
}
