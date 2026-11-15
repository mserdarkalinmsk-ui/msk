import { latestReport, money, parseDate } from './calc';
import { decisions, type Decision } from './decisions';
import { health } from './health';
import { rules } from './rules';
import { selfCheck } from './selfcheck';
import type { Project } from './types';

/**
 * Monthly close: every project in one row — is its data clean, what changed since the last close, what needs a
 * decision — and the record of the close itself (the figures as they stood), so the next month starts from it.
 */
export type CloseStatus = 'clean' | 'check' | 'blocked';
export interface CloseFigures { pid: string; code: string; budget: number; spent: number; sc: number; status: CloseStatus; report?: string; reportDate?: string; /** the report that carried these figures: locked while the month is closed */ reportId?: string }
export interface CloseRecord { month: string; at: string; rows: CloseFigures[]; note?: string; /** when the admin reopened the month: its reports can be changed again and the figures are no longer watched */ reopened?: string }
export interface CloseRow {
  p: Project; status: CloseStatus; reasons: string[]; report?: { id?: string; name: string; date: string; fresh: boolean };
  budget: number; spent: number; sc: number; since?: { spent: number; sc: number; label: string }; decisions: Decision[];
}

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
/** A report counts for the month when its period ends within the last 75 days (quarterly reports included; see Rules & thresholds). */
const FRESH = () => rules().freshDays * 864e5;

export function closeRows(P: Project[], today: Date, last?: CloseRecord): CloseRow[] {
  const live = P.filter((p) => !p.datesTbc && parseDate(p.end).getTime() >= today.getTime() - 92 * 864e5);
  const D = decisions(live, today);
  return live.map((p) => {
    const m = money(p), h = health(p, today), self = selfCheck([p]), r = latestReport(p);
    const reasons = [...self.map((x) => `${x.figure} reads ${x.a.v.toFixed(2)} on ${x.a.label} and ${x.b.v.toFixed(2)} on ${x.b.label}`), ...h.findings.filter((f) => f.level === 'bad').map((f) => f.text)];
    const warn = h.findings.filter((f) => f.level === 'warn').map((f) => f.text);
    const fresh = !!r && today.getTime() - parseDate(r.date).getTime() <= FRESH();
    if (!r) warn.unshift('No financial report loaded');
    else if (!fresh) warn.unshift(`Latest report is from ${r.date} — load this month's extraction`);
    const status: CloseStatus = reasons.length ? 'blocked' : warn.length ? 'check' : 'clean';
    const prev = last?.rows.find((x) => x.pid === p.id);
    return { p, status, reasons: [...reasons, ...warn], report: r ? { id: r.id, name: r.name, date: r.date, fresh } : undefined, budget: m.budget, spent: m.spent, sc: m.exposure,
      since: prev ? { spent: m.spent - prev.spent, sc: m.exposure - prev.sc, label: `since the ${last!.month} close` } : undefined,
      decisions: D.filter((d) => d.p === p) };
  }).sort((a, b) => ['blocked', 'check', 'clean'].indexOf(a.status) - ['blocked', 'check', 'clean'].indexOf(b.status) || b.decisions.length - a.decisions.length || lab(a.p).localeCompare(lab(b.p)));
}

export function closeRecord(rows: CloseRow[], today: Date, note?: string): CloseRecord {
  return { month: today.toISOString().slice(0, 7), at: new Date().toISOString(), note,
    rows: rows.map((r) => ({ pid: r.p.id, code: lab(r.p), budget: r.budget, spent: r.spent, sc: r.sc, status: r.status, report: r.report?.name, reportDate: r.report?.date, reportId: r.report?.id })) };
}

/** Portfolio decisions not tied to a project (e.g. "n projects with data to fix"). */
export const generalDecisions = (P: Project[], today: Date) => decisions(P.filter((p) => !p.datesTbc), today).filter((d) => !d.p);

/* ---------- period lock ---------- */
const carried = (x: CloseFigures, r: { id: string; name: string; date: string }) => (x.reportId ? x.reportId === r.id : !!x.report && x.report === r.name && x.reportDate === r.date);
/**
 * A closed month locks the report its figures came from: the close that holds this report (not reopened), if any.
 * Changing or deleting such a report changes what was closed, so the app asks for the admin first.
 */
export function lockOf(closes: CloseRecord[] | undefined, pid: string, r: { id: string; name: string; date: string }): CloseRecord | undefined {
  return (closes ?? []).find((c) => !c.reopened && c.rows.some((x) => x.pid === pid && carried(x, r)));
}

export interface CloseDrift { month: string; pid: string; code: string; what: 'Budget' | 'Spent' | 'Spent + committed' | 'Report'; closed: number; now: number; /** the report of the close is no longer on file */ removed?: boolean }
/**
 * Figures that no longer read what was closed although no newer report came in: the report of the close was edited,
 * replaced or removed, or the budget was changed. A project whose latest report is newer than its close is not drift —
 * that is the month's normal movement.
 */
export function closeDrift(P: Project[], closes: CloseRecord[] | undefined): CloseDrift[] {
  const out: CloseDrift[] = [], seen = new Set<string>();
  for (const c of closes ?? []) {
    for (const x of c.rows) {
      if (seen.has(x.pid)) continue; seen.add(x.pid); // only the newest close of each project is watched
      if (c.reopened || !x.report) continue;
      const p = P.find((q) => q.id === x.pid); if (!p) continue;
      const on = (p.reportingPeriods ?? []).find((r) => carried(x, r));
      if (!on) { out.push({ month: c.month, pid: x.pid, code: x.code, what: 'Report', closed: x.spent, now: money(p).spent, removed: true }); continue; }
      const r = latestReport(p); if (!r || !carried(x, r)) continue;
      const m = money(p);
      for (const [what, a, b] of [['Budget', x.budget, m.budget], ['Spent', x.spent, m.spent], ['Spent + committed', x.sc, m.exposure]] as const) if (Math.abs(a - b) > 0.5) out.push({ month: c.month, pid: x.pid, code: x.code, what, closed: a, now: b });
    }
  }
  return out;
}
