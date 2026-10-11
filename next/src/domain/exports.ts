import { deadlines, lineExposure, lines, money, n, elapsed } from './calc';
import { alerts, changes, outcome } from './insights';
import { roster } from './staff';
import { staffCosts, staffLines } from './staffreport';
import type { Ledger, Project } from './types';
import type { SheetSpec } from '../ui/xlsxwrite';

const r2 = (x: number) => Math.round(x * 100) / 100;

function linesSheet(ps: Project[]): SheetSpec {
  return { name: 'Budget lines', money: [3, 4, 5, 6, 7], rows: [['Project', 'Line', 'Description', 'Approved', 'Actual', 'Committed', 'Spent + committed', 'Balance', 'Used %'],
    ...ps.flatMap((p) => lines(p).map((l) => { const ex = lineExposure(l); return [p.code, l.code, l.description ?? '', r2(n(l.approved)), r2(n(l.actual)), r2(ex - n(l.actual)), r2(ex), r2(n(l.approved) - ex), n(l.approved) ? r2(ex / n(l.approved) * 100) : null]; }))] };
}
function staffSheets(ps: Project[], today: Date): SheetSpec[] {
  return [
    { name: 'Staff', money: [8, 9], rows: [['Project', 'Name', 'Position', 'Line', 'Base', 'FTE', 'Start', 'End', 'Spent', 'Committed', 'Status'],
      ...ps.flatMap((p) => staffCosts(p, today).map((c) => [p.code, c.person.display, c.person.position, c.person.code, c.person.base, c.person.fte, c.person.start, c.person.end, r2(c.spent), r2(c.committed), c.person.status]))] },
    { name: 'Staff lines', money: [4, 6], rows: [['Project', 'Line', 'Description', 'Budget months', 'Budget', 'Used months', 'Spent', 'Remaining months', 'Months to end', 'FTE on line', 'Gap (months)', 'People'],
      ...ps.flatMap((p) => staffLines(p, today).map((l) => [p.code, l.code, l.description, r2(l.budgetMonths), r2(l.budget), r2(l.usedMonths), r2(l.spent), r2(l.remainingMonths), r2(l.monthsToEnd), r2(l.fteOnLine), r2(l.gap), l.people.join(', ')]))] },
  ];
}

export function portfolioSheets(L: Ledger, ps: Project[], today: Date): SheetSpec[] {
  const cn = (id: string) => L.countries.find((c) => c.id === id)?.name ?? id;
  return [
    { name: 'Projects', money: [9, 10, 11, 12, 15], rows: [['Code', 'Name', 'Country', 'Sector', 'Funding', 'BH', 'PMM', 'Start', 'End', 'Budget', 'Spent', 'Committed', 'Remaining', 'Spent %', 'Time %', 'Forecast at end', 'Forecast use %'],
      ...ps.map((p) => { const m = money(p), o = outcome(p, today); return [p.code, p.name, cn(p.country), p.sector ?? '', p.funding ?? '', p.bh ?? '', p.pmm ?? '', p.start, p.end, r2(m.budget), r2(m.spent), r2(m.committed), r2(m.remaining), m.budget ? r2(m.spent / m.budget * 100) : null, r2(elapsed(p, today) * 100), r2(Math.min(o.projected, m.budget + o.overrun)), r2(o.utilisation * 100)]; })] },
    linesSheet(ps),
    ...staffSheets(ps, today),
    { name: 'Alerts', rows: [['Severity', 'Area', 'Project', 'Alert', 'Detail', 'Due'], ...alerts(ps, today).map((a) => [a.severity, a.kind, ps.find((p) => p.id === a.projectId)?.code ?? '', a.title, a.detail, a.due ?? ''])] },
    { name: 'Changes', money: [3, 4, 5], rows: [['Project', 'From', 'To', 'Spent before', 'Spent now', 'Change', 'Lines changed', 'Notes'], ...changes(ps).map((c) => [c.project.code, c.from ?? '', c.to ?? '', r2(c.spent[0]), r2(c.spent[1]), r2(c.spent[1] - c.spent[0]), c.lines, c.note.join('; ')])] },
    { name: 'Reporting calendar', rows: [['Project', 'Report', 'Period end', 'Due', 'Status'], ...ps.flatMap((p) => deadlines(p, today).map((d) => [p.code, d.kind, d.periodEnd, d.due, d.status]))] },
  ];
}

export function projectSheets(p: Project, today: Date): SheetSpec[] {
  const m = money(p), o = outcome(p, today);
  return [
    { name: 'Summary', money: [1], rows: [['Item', 'Value'], ['Code', p.code], ['Name', p.name], ['BH', p.bh ?? ''], ['PMM', p.pmm ?? ''], ['Start', p.start], ['End', p.end], ['Budget', r2(m.budget)], ['Spent', r2(m.spent)], ['Committed', r2(m.committed)], ['Remaining', r2(m.remaining)], ['Forecast at end', r2(o.projected)], ['Forecast use %', r2(o.utilisation * 100)], ['Needed per month', r2(o.needRate)]] },
    linesSheet([p]),
    ...staffSheets([p], today),
    { name: 'Risks', rows: [['Title', 'Category', 'Likelihood', 'Impact', 'Status', 'Owner', 'Mitigation'], ...(p.riskRegister ?? []).map((r) => [r.title, r.category ?? '', String(r.likelihood ?? ''), String(r.impact ?? ''), r.status ?? 'Open', r.owner ?? '', r.mitigation ?? ''])] },
    { name: 'Activities', rows: [['Code', 'Activity', 'Group', 'Months', 'Status'], ...(p.doa?.acts ?? []).map((a) => [a.code, a.name, a.group ?? '', [...(a.P ?? []), ...(a.E ?? []), ...(a.X ?? [])].join(' '), a.status ?? ''])] },
    { name: 'Staff roster', rows: [['Name', 'Position', 'Line', 'Status', 'Start', 'End'], ...roster(p, today).map((a) => [a.display, a.position, a.code, a.status, a.start, a.end])] },
  ];
}
