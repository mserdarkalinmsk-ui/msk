import { snapshotOf } from './intake';
import type { Workbook } from './workbook';
import { extractionLines } from './extraction';
export { extractionLines };
import { latestReport, lines, money } from './calc';
import { normalizeSector, type Ledger, type Project, type ReportingPeriod, type Sector } from './types';

/**
 * Turns a parsed financial-report workbook into a project update without manual entry:
 * match an existing project (budget head, then contract, then title), otherwise draft a
 * new project from the workbook. Anything guessed is listed in `guessed` for review.
 */
export interface AutoPlan {
  fileName: string; wb: Workbook; match?: Project; matchedBy?: 'budget head' | 'contract' | 'title';
  project: Project; report: ReportingPeriod; replaces?: string; guessed: string[]; problems: string[];
}

const words = (s: string) => new Set(s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').split(/[^a-z0-9ıçğöşü]+/).filter((w) => w.length > 3));

export function guessSector(text: string): Sector {
  const t = text.toLowerCase();
  if (/justice|judic|court|judge|prosecut|rule of law|legal|penitentiar|prison|police|corruption|econom.*crime|cybercrime/.test(t)) return 'Rule of Law';
  if (/democra|elect|youth|parliament|local government|participat|civil society|media|governance/.test(t)) return 'Democracy';
  return 'Human Rights';
}

export function guessCountry(text: string, L: Ledger): string | undefined {
  const t = text.toLowerCase().replace(/türkiye|turkey/g, 'türkiye');
  return L.countries.find((c) => t.includes(c.name.toLowerCase().replace('turkey', 'türkiye')))?.id;
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'project';

export function plan(wb: Workbook, fileName: string, L: Ledger, taken = new Set<string>()): AutoPlan {
  const m = wb.meta, guessed: string[] = [], problems: string[] = [];
  let match: Project | undefined, matchedBy: AutoPlan['matchedBy'];
  if (m.bh) { match = L.projects.find((p) => p.bh === m.bh); if (match) matchedBy = 'budget head'; }
  if (!match && m.contract) { match = L.projects.find((p) => p.contractNo === m.contract); if (match) matchedBy = 'contract'; }
  if (!match && m.title) {
    const W = words(m.title);
    const best = L.projects.map((p) => ({ p, s: [...words(p.name)].filter((w) => W.has(w)).length })).sort((a, b) => b.s - a.s)[0];
    if (best && best.s >= 3 && !best.p.bh) { match = best.p; matchedBy = 'title'; guessed.push(`matched to ${best.p.code} by title words`); }
  }
  const E = wb.totals.eligible;
  const date = m.periodTo || m.asAt || m.situationDate || new Date().toISOString().slice(0, 10);
  let project: Project;
  if (match) {
    project = { ...match, bh: match.bh || m.bh, contractNo: match.contractNo || m.contract, jp: match.jp || m.jp };
    // The workbook's total eligible budget (all years, incl. 7% admin) is authoritative for the project budget.
    if (E && E.budget > 0 && Math.abs(E.budget - match.budget) > 1 && !match.approvedBudget) {
      guessed.push(`budget updated ${Math.round(match.budget).toLocaleString('en-GB')} → ${Math.round(E.budget).toLocaleString('en-GB')} (total eligible, all years)`);
      project.budget = Math.round(E.budget * 100) / 100;
    }
  } else {
    const country = guessCountry(m.title ?? '', L);
    if (!country) problems.push('Country not found in the title — choose it after import');
    else guessed.push('country from title');
    const sector = normalizeSector(undefined) ?? guessSector(m.title ?? '');
    guessed.push(`sector “${sector}” from title words`);
    const end = m.plannedTo || m.periodTo || date;
    guessed.push('end date = end of the forecast period (confirm against the contract)');
    let code = (m.jp ? `JP${m.jp}` : m.bh ? `BH${m.bh}` : slug(m.title ?? fileName)).toUpperCase();
    for (let i = 2; L.projects.some((p) => p.code === code) || taken.has(code); i++) code = code.replace(/-\d+$/, '') + '-' + i;
    taken.add(code);
    project = {
      id: 'p' + Math.random().toString(36).slice(2, 9), code, name: m.title || fileName.replace(/\.[^.]+$/, ''), country: country ?? L.countries[0]?.id ?? '',
      sector, funding: 'Joint Programme', start: m.periodFrom || date, end, budget: E ? Math.round(E.budget * 100) / 100 : 0, status: 'Active',
      bh: m.bh, contractNo: m.contract, jp: m.jp, reportingPeriods: [], riskRegister: [],
    };
  }
  const { report, replaces: existing } = reportFrom(wb, fileName, project);
  for (const c of wb.checks) if (c.level === 'error') problems.push(c.text);
  return { fileName, wb, match, matchedBy, project, report, replaces: existing, guessed, problems };
}

/** Applies plans to a copy of the ledger: new projects are added, matched ones updated, the report upserted. */
export function applyPlans(L: Ledger, plans: AutoPlan[]): Ledger {
  const N: Ledger = JSON.parse(JSON.stringify(L));
  for (const pl of plans) {
    let p = N.projects.find((x) => x.id === pl.project.id);
    if (!p) { p = JSON.parse(JSON.stringify(pl.project)) as Project; N.projects.push(p); }
    else Object.assign(p, { bh: pl.project.bh, contractNo: pl.project.contractNo, jp: pl.project.jp, budget: pl.project.budget });
    const R = p.reportingPeriods ?? (p.reportingPeriods = []);
    const i = R.findIndex((r) => r.id === pl.report.id);
    if (i >= 0) R[i] = pl.report; else R.push(pl.report);
    R.sort((a, b) => a.date.localeCompare(b.date));
  }
  return N;
}

export interface DiffRow { label: string; before: string; after: string; changed: boolean }

/** Before → after view of what an import changes on the project (shown for review before applying). */
export function planDiff(L: Ledger, pl: AutoPlan): DiffRow[] {
  const before = pl.match;
  const after = applyPlans(L, [pl]).projects.find((p) => p.id === pl.project.id)!;
  const eur = (x: number) => `€${Math.round(x).toLocaleString('en-GB')}`;
  const staff = (p?: Project) => new Set((p?.reportingPeriods ?? []).flatMap((r) => (r.snapshot?.staffRecords ?? []).map((s) => s.name)).filter(Boolean)).size;
  const last = (p?: Project) => latestReport(p ?? ({} as Project))?.date ?? '—';
  const mb = before ? money(before) : null, ma = money(after);
  const R: [string, string, string][] = [
    ['Budget', mb ? eur(mb.budget) : '—', eur(ma.budget)],
    ['Spent', mb ? eur(mb.spent) : '—', eur(ma.spent)],
    ['Committed', mb ? eur(mb.committed) : '—', eur(ma.committed)],
    ['Budget lines', String(before ? lines(before).length : 0), String(lines(after).length)],
    ['Staff found', String(staff(before)), String(staff(after))],
    ['Latest report', before ? last(before) : '—', last(after)],
    ['Reports on file', String(before?.reportingPeriods?.length ?? 0), String(after.reportingPeriods?.length ?? 0)],
  ];
  return R.map(([label, b, a]) => ({ label, before: b, after: a, changed: b !== a }));
}

/** Report date of a workbook: end of the reporting period, else the situation date. */
export const reportDate = (wb: Workbook) => wb.meta.periodTo || wb.meta.asAt || wb.meta.situationDate || '';

/** A reporting period built from a financial report workbook; a report with the same date is replaced. */
export function reportFrom(wb: Workbook, fileName: string, p: Project): { report: ReportingPeriod; replaces?: string } {
  const date = reportDate(wb) || new Date().toISOString().slice(0, 10);
  const existing = (p.reportingPeriods ?? []).find((r) => r.date === date && r.snapshot?.workbook);
  return {
    replaces: existing?.id,
    report: {
      id: existing?.id ?? 'r' + Math.random().toString(36).slice(2, 9), name: `Interim report to ${date}`, type: 'Interim Financial Report', date, fileName, registeredAt: new Date().toISOString(),
      ...(wb.meta.extraction ? { name: `System extraction to ${date}`, type: 'System extraction' } : {}),
      snapshot: snapshotOf(wb, p, fileName),
    },
  };
}

/** Identifier conflicts between a workbook and the project it is being added to. */
export function idConflicts(wb: Workbook, p: Project): string[] {
  const m = wb.meta, out: string[] = [];
  if (p.bh && m.bh && p.bh !== m.bh) out.push(`BH ${m.bh} ≠ ${p.bh}`);
  if (p.contractNo && m.contract && p.contractNo !== m.contract) out.push(`contract ${m.contract} ≠ ${p.contractNo}`);
  if (p.jp && m.jp && p.jp !== m.jp) out.push(`JP ${m.jp} ≠ ${p.jp}`);
  return out;
}
