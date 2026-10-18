import { byPeriodThenImport, latestReport, lineExposure, lines, n } from './calc';
import type { Project } from './types';
import type { SheetSpec } from '../ui/xlsxwrite';

/**
 * Audit pack of one project: every budget line of the latest report with the purchase orders behind it, the
 * difference between the line and its POs (entries without a PO, GL postings), the reports and the documents on file.
 */
export function auditSheets(p: Project, today: Date): SheetSpec[] {
  const L = lines(p), rep = latestReport(p);
  const wb = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.workbook).sort(byPeriodThenImport).at(-1)?.snapshot?.workbook;
  const pos = wb?.pos ?? [];
  const forLine = (code: string) => pos.filter((x) => x.line === code || x.line.startsWith(code + '.'));
  const leaf = L.filter((l) => !L.some((o) => o !== l && o.code.startsWith(l.code + '.')));
  const T = { approved: leaf.reduce((a, l) => a + n(l.approved), 0), actual: leaf.reduce((a, l) => a + n(l.actual), 0), sc: leaf.reduce((a, l) => a + lineExposure(l), 0) };
  const c = p.contract ?? {};
  return [
    { name: 'Summary', money: [1], rows: [
      ['Audit pack', `${p.code} — ${p.name}`], ['Budget head (BH)', p.bh ?? ''], ['Contract', String((c as { number?: string }).number ?? '')],
      ['Period', `${p.start} to ${p.end}`], ['Report used', rep ? `${rep.name} (${rep.date})${rep.fileName ? ` — ${rep.fileName}` : ''}` : 'none'],
      ['Purchase orders from', wb?.fileName ?? (pos.length ? 'report workbook' : 'no Purchase Orders sheet loaded')],
      ['Approved budget (lines)', T.approved], ['Spent', T.actual], ['Spent + committed', T.sc], ['Remaining', T.approved - T.sc],
      ['Prepared', today.toISOString().slice(0, 10)],
      [], ['How to read', 'Lines: each budget line with the total of its purchase orders; "Not covered by POs" is spent + committed without a PO (invoices without PO, GL postings, salaries) — check these entries in the system.'],
    ] },
    { name: 'Lines', money: [5, 6, 7, 8, 9, 11, 12], rows: [
      ['Line', 'Description', 'Unit', 'Units', 'Unit rate', 'Approved', 'Spent', 'Committed', 'Spent + committed', 'Remaining', 'POs', 'PO spent + committed', 'Not covered by POs'],
      ...leaf.map((l) => { const P = forLine(l.code), ps = P.reduce((a, x) => a + (x.sc || x.amount), 0), sc = lineExposure(l);
        return [l.code, l.description ?? '', l.unit ?? '', l.approvedUnits ?? '', l.unitRate ?? '', n(l.approved), n(l.actual), Math.max(0, sc - n(l.actual)), sc, n(l.approved) - sc, P.length, ps, sc - ps]; }),
      ['Total', '', '', '', '', T.approved, T.actual, T.sc - T.actual, T.sc, T.approved - T.sc, pos.length, pos.reduce((a, x) => a + (x.sc || x.amount), 0), T.sc - pos.reduce((a, x) => a + (x.sc || x.amount), 0)],
    ] },
    { name: 'POs by line', money: [6, 7, 8, 9], rows: [
      ['Line', 'Line description', 'PO', 'Description', 'Supplier', 'Encumbered', 'PO amount', 'Paid', 'Open balance', 'Spent + committed', 'Status'],
      ...[...pos].sort((a, b) => a.line.localeCompare(b.line, undefined, { numeric: true }) || a.date.localeCompare(b.date)).map((x) => [x.line, L.find((l) => l.code === x.line)?.description ?? '', x.po, x.description || x.nature, x.supplier, x.date, x.amount, x.spent, x.balance, x.sc || x.amount, x.status]),
    ] },
    { name: 'Reports', rows: [['Report', 'Type', 'Period / date', 'File', 'Loaded'], ...[...(p.reportingPeriods ?? [])].sort(byPeriodThenImport).map((r) => [r.name, r.type, r.date, r.fileName ?? r.snapshot?.workbook?.fileName ?? '', (r.registeredAt ?? r.snapshot?.workbook?.importedAt ?? '').slice(0, 10)])] },
    { name: 'Documents', rows: [['Document', 'Kind', 'Loaded', 'Read'], ...(p.documents ?? []).map((d) => [d.name, d.kind, d.importedAt.slice(0, 10), d.summary.slice(0, 3).join(' · ')])] },
  ];
}
