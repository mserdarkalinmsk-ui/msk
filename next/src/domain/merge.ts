import type { Ledger, Project } from './types';

/** When a project was last fed: its newest report or document, else its dates. */
export function lastActivity(p: Project): string {
  const r = (p.reportingPeriods ?? []).map((x) => x.registeredAt ?? x.snapshot?.workbook?.importedAt ?? x.date);
  const d = (p.documents ?? []).map((x) => x.importedAt);
  return [...r, ...d, p.approvedBudget?.importedAt ?? ''].sort().at(-1) ?? '';
}
export interface MergeConflict { id: string; mine: Project; theirs: Project; newer: 'mine' | 'theirs'; diff: string[] }
export interface MergePlan { added: Project[]; same: number; conflicts: MergeConflict[]; countries: number; offices: number }

/** What merging a colleague's backup into the current data would do, project by project. */
export function planMerge(mine: Ledger, theirs: Ledger): MergePlan {
  const byId = new Map(mine.projects.map((p) => [p.id, p]));
  const added: Project[] = [], conflicts: MergeConflict[] = []; let same = 0;
  for (const t of theirs.projects ?? []) {
    const m = byId.get(t.id) ?? mine.projects.find((x) => x.bh && x.bh === t.bh);
    if (!m) { added.push(t); continue; }
    if (JSON.stringify(m) === JSON.stringify(t)) { same++; continue; }
    const diff: string[] = [];
    const nr = (p: Project) => (p.reportingPeriods ?? []).length, nd = (p: Project) => (p.documents ?? []).length;
    if (nr(m) !== nr(t)) diff.push(`reports ${nr(m)} → ${nr(t)}`);
    if (nd(m) !== nd(t)) diff.push(`documents ${nd(m)} → ${nd(t)}`);
    for (const k of ['name', 'start', 'end', 'budget', 'status'] as const) if (m[k] !== t[k]) diff.push(`${k} ${String(m[k] ?? '—')} → ${String(t[k] ?? '—')}`);
    if (!diff.length) diff.push('other details differ');
    conflicts.push({ id: m.id, mine: m, theirs: t, newer: lastActivity(t) > lastActivity(m) ? 'theirs' : 'mine', diff });
  }
  const countries = (theirs.countries ?? []).filter((c) => !mine.countries.some((x) => x.id === c.id)).length;
  const offices = (theirs.offices ?? []).filter((o) => !(mine.offices ?? []).some((x) => x.id === o.id)).length;
  return { added, same, conflicts, countries, offices };
}

/** Applies the plan: new projects, countries and offices are added; for each conflict the chosen side is kept. */
export function applyMerge(mine: Ledger, theirs: Ledger, plan: MergePlan, choice: Record<string, 'mine' | 'theirs'>): Ledger {
  const take = new Map(plan.conflicts.filter((c) => (choice[c.id] ?? c.newer) === 'theirs').map((c) => [c.id, c.theirs]));
  const offices = [...(mine.offices ?? [])];
  for (const o of theirs.offices ?? []) {
    const i = offices.findIndex((x) => x.id === o.id);
    if (i < 0) offices.push(o); else if ((o.reports?.length ?? 0) > (offices[i].reports?.length ?? 0)) offices[i] = o;
  }
  return {
    ...mine,
    countries: [...mine.countries, ...(theirs.countries ?? []).filter((c) => !mine.countries.some((x) => x.id === c.id))],
    projects: [...mine.projects.map((p) => take.get(p.id) ?? p), ...plan.added],
    offices,
    // Settings made by hand: the current data wins where both have one.
    poKinds: { ...(theirs.poKinds ?? {}), ...(mine.poKinds ?? {}) },
    frameworks: { ...(theirs.frameworks ?? {}), ...(mine.frameworks ?? {}) },
    checklist: { ...(theirs.checklist ?? {}), ...(mine.checklist ?? {}) },
    audit: [...(mine.audit ?? []), ...(theirs.audit ?? [])].sort((a, b) => b.at.localeCompare(a.at)).filter((x, i, a) => i === 0 || x.at !== a[i - 1].at || x.message !== a[i - 1].message).slice(0, 300),
  };
}
