import { toBudgetLines, summarize, type Workbook } from './workbook';
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
    if (E && Math.abs(E.budget - match.budget) > 1) problems.push(`Workbook budget ${Math.round(E.budget).toLocaleString('en-GB')} differs from project budget ${Math.round(match.budget).toLocaleString('en-GB')}`);
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
  const existing = (project.reportingPeriods ?? []).find((r) => r.date === date && r.snapshot?.workbook);
  const report: ReportingPeriod = {
    id: existing?.id ?? 'r' + Math.random().toString(36).slice(2, 9), name: `Interim report to ${date}`, type: 'Interim Financial Report', date, fileName, registeredAt: new Date().toISOString(),
    snapshot: { format: 'CoE workbook', lines: toBudgetLines(wb), staffRecords: wb.staff, staffGroups: wb.staffGroups, workbook: summarize(wb, fileName) },
  };
  for (const c of wb.checks) if (c.level === 'error') problems.push(c.text);
  return { fileName, wb, match, matchedBy, project, report, replaces: existing?.id, guessed, problems };
}

/** Applies plans to a copy of the ledger: new projects are added, matched ones updated, the report upserted. */
export function applyPlans(L: Ledger, plans: AutoPlan[]): Ledger {
  const N: Ledger = JSON.parse(JSON.stringify(L));
  for (const pl of plans) {
    let p = N.projects.find((x) => x.id === pl.project.id);
    if (!p) { p = JSON.parse(JSON.stringify(pl.project)) as Project; N.projects.push(p); }
    else Object.assign(p, { bh: pl.project.bh, contractNo: pl.project.contractNo, jp: pl.project.jp });
    const R = p.reportingPeriods ?? (p.reportingPeriods = []);
    const i = R.findIndex((r) => r.id === pl.report.id);
    if (i >= 0) R[i] = pl.report; else R.push(pl.report);
    R.sort((a, b) => a.date.localeCompare(b.date));
  }
  return N;
}
