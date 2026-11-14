import type { Project } from './types';

export type Programme = 'JP' | 'VC';

/** Joint Programme (EU–CoE) or Voluntary Contribution: chosen on the project, else read from the funding source. */
export function programmeOf(p: Pick<Project, 'programme' | 'funding'>): Programme {
  if (p.programme) return p.programme;
  return /\bvcs?\b|voluntary/i.test(p.funding ?? '') ? 'VC' : 'JP';
}

/**
 * Heading flexibility: how far a heading may move from the agreement before an addendum is needed.
 * The contract's own figure wins; otherwise 25% for Joint Programmes and 15% for Voluntary Contributions.
 */
export function flexOf(p: Project): number {
  const own = Number((p as { flexPct?: number }).flexPct) || Number((p.contract as { flexPct?: number } | undefined)?.flexPct);
  return (own || (programmeOf(p) === 'VC' ? 15 : 25)) / 100;
}

/** From here on a heading is "near" the addendum threshold (20% of 25%, 12% of 15%). */
export const nearOf = (flex: number) => flex * 0.8;
/** 0.25 → "25", 0.125 → "12.5" */
export const pctOf = (x: number) => String(+(x * 100).toFixed(1));
