import { rules } from './rules';
import type { Project } from './types';

export type Programme = 'JP' | 'VC';

/**
 * Joint Programme (EU–CoE) or Voluntary Contribution: chosen on the project, else read from the funding source —
 * "VC"/"voluntary" or a donor other than the EU (Sweden, Norway …) is a VC; the EU, or a JP number, is a JP.
 */
export function programmeOf(p: Pick<Project, 'programme' | 'funding'> & { jp?: string }): Programme {
  if (p.programme) return p.programme;
  const f = (p.funding ?? '').trim();
  if (/\bvcs?\b|voluntary/i.test(f)) return 'VC';
  if (/\beu\b|european union|joint programme|\bjp\b/i.test(f) || p.jp) return 'JP';
  return f ? 'VC' : 'JP';
}

/**
 * Heading flexibility: how far a heading may move from the agreement before an addendum is needed.
 * The contract's own figure wins; otherwise the house rule: 25% for Joint Programmes and 15% for Voluntary
 * Contributions unless changed in Rules & thresholds.
 */
export function flexOf(p: Project): number {
  const own = Number((p as { flexPct?: number }).flexPct) || Number((p.contract as { flexPct?: number } | undefined)?.flexPct);
  return (own || (programmeOf(p) === 'VC' ? rules().flexVC : rules().flexJP)) / 100;
}

/** From here on a heading is "near" the addendum threshold (20% of 25%, 12% of 15%). */
export const nearOf = (flex: number) => flex * (rules().nearShare / 100);
/** 0.25 → "25", 0.125 → "12.5" */
export const pctOf = (x: number) => String(+(x * 100).toFixed(1));
