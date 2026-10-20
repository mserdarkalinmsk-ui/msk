import { latestReport, money, parseDate } from './calc';
import { decisions, type Decision } from './decisions';
import { health } from './health';
import { selfCheck } from './selfcheck';
import type { Project } from './types';

/**
 * Monthly close: every project in one row — is its data clean, what changed since the last close, what needs a
 * decision — and the record of the close itself (the figures as they stood), so the next month starts from it.
 */
export type CloseStatus = 'clean' | 'check' | 'blocked';
export interface CloseFigures { pid: string; code: string; budget: number; spent: number; sc: number; status: CloseStatus; report?: string; reportDate?: string }
export interface CloseRecord { month: string; at: string; rows: CloseFigures[]; note?: string }
export interface CloseRow {
  p: Project; status: CloseStatus; reasons: string[]; report?: { name: string; date: string; fresh: boolean };
  budget: number; spent: number; sc: number; since?: { spent: number; sc: number; label: string }; decisions: Decision[];
}

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
/** A report counts for the month when its period ends within the last 75 days (quarterly reports included). */
const FRESH = 75 * 864e5;

export function closeRows(P: Project[], today: Date, last?: CloseRecord): CloseRow[] {
  const live = P.filter((p) => !p.datesTbc && parseDate(p.end).getTime() >= today.getTime() - 92 * 864e5);
  const D = decisions(live, today);
  return live.map((p) => {
    const m = money(p), h = health(p, today), self = selfCheck([p]), r = latestReport(p);
    const reasons = [...self.map((x) => `${x.figure} reads ${x.a.v.toFixed(2)} on ${x.a.label} and ${x.b.v.toFixed(2)} on ${x.b.label}`), ...h.findings.filter((f) => f.level === 'bad').map((f) => f.text)];
    const warn = h.findings.filter((f) => f.level === 'warn').map((f) => f.text);
    const fresh = !!r && today.getTime() - parseDate(r.date).getTime() <= FRESH;
    if (!r) warn.unshift('No financial report loaded');
    else if (!fresh) warn.unshift(`Latest report is from ${r.date} — load this month's extraction`);
    const status: CloseStatus = reasons.length ? 'blocked' : warn.length ? 'check' : 'clean';
    const prev = last?.rows.find((x) => x.pid === p.id);
    return { p, status, reasons: [...reasons, ...warn], report: r ? { name: r.name, date: r.date, fresh } : undefined, budget: m.budget, spent: m.spent, sc: m.exposure,
      since: prev ? { spent: m.spent - prev.spent, sc: m.exposure - prev.sc, label: `since the ${last!.month} close` } : undefined,
      decisions: D.filter((d) => d.p === p) };
  }).sort((a, b) => ['blocked', 'check', 'clean'].indexOf(a.status) - ['blocked', 'check', 'clean'].indexOf(b.status) || b.decisions.length - a.decisions.length || lab(a.p).localeCompare(lab(b.p)));
}

export function closeRecord(rows: CloseRow[], today: Date, note?: string): CloseRecord {
  return { month: today.toISOString().slice(0, 7), at: new Date().toISOString(), note,
    rows: rows.map((r) => ({ pid: r.p.id, code: lab(r.p), budget: r.budget, spent: r.spent, sc: r.sc, status: r.status, report: r.report?.name, reportDate: r.report?.date })) };
}

/** Portfolio decisions not tied to a project (e.g. "n projects with data to fix"). */
export const generalDecisions = (P: Project[], today: Date) => decisions(P.filter((p) => !p.datesTbc), today).filter((d) => !d.p);
