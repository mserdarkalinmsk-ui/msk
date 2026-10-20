import type { CloseRow } from '../domain/close';
import type { Decision } from '../domain/decisions';
import { projectSheets } from '../domain/exports';
import { setStamp } from './stamp';
import { saveFile } from './save';
import { workbook, zip, type SheetSpec } from './xlsxwrite';

const lab = (r: CloseRow) => (r.p.bh ? `BH ${r.p.bh}` : r.p.code);
const r2 = (v: number) => Math.round(v * 100) / 100;
const STATUS = { clean: 'Clean', check: 'To check', blocked: 'Blocked' } as const;

/** The close summary: every project, the decisions and the problems, as one workbook. */
export function closeSheets(rows: CloseRow[], general: Decision[], month: string): SheetSpec[] {
  return [
    { name: 'Close', money: [5, 6, 7, 8, 9], rows: [['Project', 'Name', 'Status', 'Report', 'Report date', 'Budget', 'Spent', 'Spent + committed', 'Spent since last close', 'S&C since last close', 'Decisions'],
      ...rows.map((r) => [lab(r), r.p.name, STATUS[r.status], r.report?.name ?? '', r.report?.date ?? '', r2(r.budget), r2(r.spent), r2(r.sc), r.since ? r2(r.since.spent) : '', r.since ? r2(r.since.sc) : '', r.decisions.map((d) => d.kind).join(', ')])] },
    { name: 'Decisions', rows: [['Kind', 'Project', 'Urgency', 'What to do'],
      ...rows.flatMap((r) => r.decisions.map((d) => [d.kind, lab(r), d.tone === 'bad' ? 'Now' : 'Soon', d.text])), ...general.map((d) => [d.kind, '', d.tone === 'bad' ? 'Now' : 'Soon', d.text])] },
    { name: 'Problems', rows: [['Project', 'Status', 'Problem'], ...rows.filter((r) => r.status !== 'clean').flatMap((r) => r.reasons.map((t) => [lab(r), STATUS[r.status], t]))] },
    { name: 'About', rows: [['Monthly close', month], ['Projects', rows.length], ['Clean', rows.filter((r) => r.status === 'clean').length], ['To check', rows.filter((r) => r.status === 'check').length], ['Blocked', rows.filter((r) => r.status === 'blocked').length],
      ['Note', 'Project workbooks are included for clean projects and for projects to check; blocked projects are listed under Problems until their data is fixed.']] },
  ];
}

/** One ZIP: the close summary and a workbook per project that is not blocked, each stamped with its source report. */
export async function downloadClosePack(rows: CloseRow[], general: Decision[], month: string, today: Date) {
  const files: { name: string; data: Uint8Array }[] = [];
  setStamp(`Monthly close ${month} · ${rows.length} projects · produced ${today.toISOString().slice(0, 10)}`);
  files.push({ name: `Close ${month}/Close summary ${month}.xlsx`, data: workbook(closeSheets(rows, general, month)) });
  for (const r of rows.filter((x) => x.status !== 'blocked')) {
    setStamp(`${r.p.code} · figures from ${r.report ? `${r.report.name} (${r.report.date})` : 'no report'} · close ${month} · produced ${today.toISOString().slice(0, 10)}`);
    files.push({ name: `Close ${month}/Projects/${lab(r).replace(/[\\/:*?"<>|]/g, '-')} ${r.status === 'check' ? '(to check) ' : ''}${month}.xlsx`, data: workbook(projectSheets(r.p, today)) });
  }
  await saveFile(`Monthly close ${month}.zip`, new Blob([zip(files) as BlobPart], { type: 'application/zip' }));
}
