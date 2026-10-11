import type { DocFindings } from './documents';
import type { Project } from './types';

export interface DocChoices { notes?: boolean; approved: boolean; contract: boolean; dates: boolean; budget: boolean; plan: boolean; risks: boolean; indicators: boolean }

/** Merges document findings into a copy of the project. */
export function applyFindings(p: Project, F: DocFindings, c: DocChoices, docs: { name: string; kind: string; summary: string[] }[]): Project {
  const q: Project = JSON.parse(JSON.stringify(p));
  const k = F.contract;
  if (c.contract && Object.keys(k).length) {
    q.contract = { ...(q.contract ?? {}), ...Object.fromEntries(Object.entries({ number: k.number, title: k.title, total: k.total, euMax: k.euMax, start: k.start, end: k.end, months: k.months, repMonths: k.repMonths, progDays: k.progDays, finalMonths: k.finalMonths, flexPct: k.flexPct, contingencyPct: k.contingencyPct, prefin: k.prefinancing, share: k.euShare != null ? { eu: k.euShare } : undefined }).filter(([, v]) => v != null)) };
    if (k.number) q.contractNo = k.number;
  }
  if (c.dates) { if (k.start) q.start = k.start; if (k.end) q.end = k.end; if (k.start && k.end) delete q.datesTbc; }
  if (c.approved && F.budget) { q.approvedBudget = { ...F.budget, importedAt: new Date().toISOString() }; q.budget = Math.round(F.budget.total * 100) / 100; }
  else if (c.budget && k.total && !q.approvedBudget) q.budget = k.total;
  if (c.contract) { if (k.jp && !q.jp) q.jp = k.jp; if (k.bh && !q.bh) q.bh = k.bh; }
  if (c.plan && F.acts.length) q.doa = { start: k.start ?? q.doa?.start ?? q.start, months: k.months ?? F.planMonths ?? q.doa?.months ?? 36, acts: F.acts.map((a) => ({ ...a, status: q.doa?.acts.find((x) => x.code === a.code)?.status ?? '' })) };
  if (c.risks && F.risks.length) {
    const R = q.riskRegister ?? (q.riskRegister = []);
    for (const r of F.risks) { const i = R.findIndex((x) => x.title.toLowerCase() === r.title.toLowerCase()); if (i >= 0) R[i] = { ...R[i], ...r, id: R[i].id, status: R[i].status }; else R.push(r); }
  }
  // progress entered by hand survives a re-import of the logframe
  if (c.risks && F.assumptions?.length) q.assumptions = F.assumptions;
  if (c.indicators && F.indicators.length) q.indicators = F.indicators.map((x) => { const o = q.indicators?.find((y) => y.indicator === x.indicator); return o?.current ? { ...x, current: o.current, asOf: o.asOf } : x; });
  if (c.notes !== false && F.notes && Object.keys(F.notes).length) q.budgetNotes = { ...(q.budgetNotes ?? {}), ...F.notes };
  q.documents = [...(q.documents ?? []).filter((d) => !docs.some((x) => x.name === d.name)), ...docs.map((d) => ({ ...d, importedAt: new Date().toISOString() }))];
  // Once documents are on file the project is no longer in set-up: keep the known dates (contract dates win when found).
  if (q.datesTbc && q.start && q.end) delete q.datesTbc;
  return q;
}

/** Combines findings from several documents; later documents fill gaps, larger tables win. */
export function mergeFindings(all: DocFindings[]): DocFindings {
  const out: DocFindings = { contract: {}, acts: [], risks: [], indicators: [], summary: [] };
  for (const f of all) {
    for (const [key, v] of Object.entries(f.contract)) if ((out.contract as Record<string, unknown>)[key] == null) (out.contract as Record<string, unknown>)[key] = v;
    if (f.acts.length > out.acts.length) { out.acts = f.acts; out.planMonths = f.planMonths; }
    if (f.assumptions && f.assumptions.length > (out.assumptions?.length ?? 0)) out.assumptions = f.assumptions;
    for (const r of f.risks) if (!out.risks.some((x) => x.title.toLowerCase() === r.title.toLowerCase())) out.risks.push(r);
    if (f.indicators.length > out.indicators.length) out.indicators = f.indicators;
    if (f.notes) out.notes = { ...(out.notes ?? {}), ...f.notes };
    if (f.budget && (!out.budget || f.budget.lines.length > out.budget.lines.length)) out.budget = f.budget;
  }
  return out;
}
