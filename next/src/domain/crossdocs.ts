import { HEADINGS, latestReport, n } from './calc';
import { ADMIN_LINE } from './terms';
import type { Project } from './types';

/**
 * The same figure as each document gives it: the contract, the approved budget (DoA / budget annex), the project card and
 * the latest report. A row agrees when every document that has the figure gives the same value; a heading that differs
 * between the approved budget and the report is explained when the recorded budget changes (notified or addendum) add
 * up to the difference.
 */
export type Source = 'contract' | 'approved' | 'card' | 'report';
export const SOURCES: Record<Source, string> = { contract: 'Contract', approved: 'Approved budget', card: 'Project card', report: 'Latest report' };
export interface CrossRow { key: string; label: string; values: Partial<Record<Source, number | string>>; ok: boolean; money: boolean; note?: string; /** only one document gives the figure: nothing to compare */ only?: boolean }
export interface CrossDocs { rows: CrossRow[]; sources: Source[]; names: Partial<Record<Source, string>>; bad: number }

const eur = (v: number) => `€${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const head = (code: string) => code.split('.')[0];

export function crossDocs(p: Project): CrossDocs {
  const c = (p.contract ?? {}) as { total?: number; start?: string; end?: string; number?: string; bh?: string; jp?: string };
  const ab = p.approvedBudget, r = latestReport(p), wb = r?.snapshot?.workbook, RL = r?.snapshot?.lines ?? [];
  const T = wb?.totals;
  const rows: CrossRow[] = [];
  const add = (key: string, label: string, values: CrossRow['values'], money = true, note?: string) => {
    const v = Object.fromEntries(Object.entries(values).filter(([, x]) => x != null && x !== '' && !(typeof x === 'number' && !Number.isFinite(x)))) as CrossRow['values'];
    const xs = Object.values(v); if (xs.length < 2 && key !== 'total') { if (xs.length) rows.push({ key, label, values: v, ok: true, money, only: true }); return; }
    if (xs.length < 2) { rows.push({ key, label, values: v, ok: true, money, only: true }); return; }
    const ok = money ? xs.every((x) => Math.abs(Number(x) - Number(xs[0])) <= 1) : xs.every((x) => String(x).replace(/^0+/, '') === String(xs[0]).replace(/^0+/, ''));
    rows.push({ key, label, values: v, ok, money, note });
  };
  const reportTotal = T?.eligible?.budget ?? (RL.length ? RL.reduce((a, l) => a + n(l.approved), 0) : undefined);
  add('total', 'Total eligible costs', { contract: n(c.total) || undefined, approved: ab?.total, card: p.budget || undefined, report: reportTotal });
  add('direct', 'Direct costs', { approved: ab?.direct, report: T?.direct?.budget ?? (RL.length ? RL.filter((l) => l.code !== ADMIN_LINE && l.code !== '8').reduce((a, l) => a + n(l.approved), 0) : undefined) });
  add('admin', 'Administrative costs', { approved: ab?.admin || undefined, report: T?.admin?.budget ?? RL.find((l) => l.code === ADMIN_LINE)?.approved ?? undefined });
  // Headings 1–6: approved budget against the budget column of the report, with the recorded changes.
  const changes = (p.budgetChanges ?? []).filter((x) => x.status !== 'planned');
  for (const h of ['1', '2', '3', '4', '5', '6']) {
    const a = ab ? ab.lines.filter((l) => head(l.code) === h && l.code !== ADMIN_LINE).reduce((s, l) => s + n(l.approved), 0) : undefined;
    const b = RL.length ? RL.filter((l) => head(l.code) === h).reduce((s, l) => s + n(l.approved), 0) : undefined;
    if (!a && !b) continue;
    const net = changes.reduce((s, x) => s + (head(x.to) === h ? x.amount : 0) - (head(x.from) === h ? x.amount : 0), 0);
    const diff = a != null && b != null ? b - a : 0, explained = Math.abs(diff) > 1 && Math.abs(diff - net) <= 1;
    const row = { key: `h${h}`, label: `${h}. ${HEADINGS[h] ?? ''}`.trim(), values: { approved: a, report: b } as CrossRow['values'], ok: Math.abs(diff) <= 1 || explained, money: true,
      note: explained ? `${eur(diff)} explained by the recorded budget changes` : Math.abs(diff) > 1 ? `${diff > 0 ? '+' : '−'}${eur(Math.abs(diff))} in the report${net ? `; recorded changes account for ${eur(net)}` : ' — no budget change recorded'}` : undefined };
    if (a == null || b == null) Object.assign(row, { ok: true, only: true });
    rows.push(row);
  }
  add('start', 'Start date', { contract: c.start, card: p.datesTbc ? undefined : p.start }, false);
  add('end', 'End date', { contract: c.end, card: p.datesTbc ? undefined : p.end }, false);
  add('contract', 'Contract number', { contract: c.number, card: p.contractNo, report: wb?.meta?.contract }, false);
  add('bh', 'Budget head (BH)', { contract: c.bh, card: p.bh, report: wb?.meta?.bh }, false);
  add('jp', 'Joint programme (JP)', { contract: c.jp, card: p.jp, report: wb?.meta?.jp }, false);
  const sources = (Object.keys(SOURCES) as Source[]).filter((s) => rows.some((x) => x.values[s] != null));
  const names: CrossDocs['names'] = { approved: ab?.source, report: r ? `${r.name}${r.fileName ? ` (${r.fileName})` : ''}` : undefined };
  return { rows, sources, names, bad: rows.filter((x) => !x.ok).length };
}
