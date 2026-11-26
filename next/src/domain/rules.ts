/**
 * The house rules the checks follow — heading flexibility, when spending counts as behind or ahead of time, when a
 * line counts as over its budget, how old a report may be — kept in one place and editable (Rules & thresholds),
 * so a new donor or a changed instruction needs a setting, not a new version of the app.
 */
export interface Rules {
  /** heading flexibility before an addendum, Joint Programmes (%) */ flexJP: number;
  /** heading flexibility before an addendum, Voluntary Contributions (%) */ flexVC: number;
  /** a heading is "near" the addendum from this share of the flexibility (%) */ nearShare: number;
  /** spending is behind schedule from this many points below time elapsed */ paceBehind: number;
  /** … and seriously behind from this many */ paceFarBehind: number;
  /** spending is ahead of schedule from this many points above time elapsed */ paceAhead: number;
  /** a budget line is flagged from this much above its approved amount (%) */ lineOver: number;
  /** … and critical from this much (%) */ lineCritical: number;
  /** "no recent financial report" after this many days */ staleDays: number;
  /** a report counts for the month's close when its date is at most this many days old */ freshDays: number;
  /** staff contracts ending within this many days raise an alert */ renewalDays: number;
  /** a project ending within this many days raises an alert */ endingDays: number;
}
export const DEFAULT_RULES: Rules = { flexJP: 25, flexVC: 15, nearShare: 80, paceBehind: 15, paceFarBehind: 30, paceAhead: 10, lineOver: 10, lineCritical: 25, staleDays: 180, freshDays: 75, renewalDays: 90, endingDays: 120 };

export interface RuleField { key: keyof Rules; group: string; label: string; help: string; unit: '%' | 'points' | 'days'; min: number; max: number }
export const RULE_FIELDS: RuleField[] = [
  { key: 'flexJP', group: 'Heading flexibility', label: 'Joint Programmes (EU–CoE)', help: 'How far a budget heading may move from the agreement before an addendum is needed. A contract’s own figure, set on the project, still wins.', unit: '%', min: 1, max: 100 },
  { key: 'flexVC', group: 'Heading flexibility', label: 'Voluntary Contributions', help: 'The same limit for projects funded by a voluntary contribution.', unit: '%', min: 1, max: 100 },
  { key: 'nearShare', group: 'Heading flexibility', label: '“Near addendum” from', help: 'Share of the flexibility from which a heading is shown as near the limit (80% of 25% = 20%).', unit: '%', min: 10, max: 100 },
  { key: 'paceBehind', group: 'Pace against time', label: 'Behind schedule from', help: 'Points by which the share of the budget spent is below the share of time elapsed.', unit: 'points', min: 1, max: 90 },
  { key: 'paceFarBehind', group: 'Pace against time', label: 'Seriously behind from', help: 'From here the alert is serious rather than a warning.', unit: 'points', min: 1, max: 95 },
  { key: 'paceAhead', group: 'Pace against time', label: 'Ahead of schedule from', help: 'Points by which spending is above time elapsed.', unit: 'points', min: 1, max: 90 },
  { key: 'lineOver', group: 'Budget lines', label: 'Line over its budget from', help: 'Spent + committed above the approved amount of a line by this much raises an alert.', unit: '%', min: 0, max: 100 },
  { key: 'lineCritical', group: 'Budget lines', label: 'Critical from', help: 'From here the alert on the line is critical.', unit: '%', min: 0, max: 200 },
  { key: 'staleDays', group: 'Reporting and dates', label: 'No recent report after', help: 'A project whose latest figures are older than this is flagged.', unit: 'days', min: 30, max: 730 },
  { key: 'freshDays', group: 'Reporting and dates', label: 'Report counts for the monthly close up to', help: 'An older report marks the project “to check” in the monthly close.', unit: 'days', min: 15, max: 370 },
  { key: 'renewalDays', group: 'Reporting and dates', label: 'Staff contract ending within', help: 'Contracts ending inside this window appear in the alerts.', unit: 'days', min: 7, max: 365 },
  { key: 'endingDays', group: 'Reporting and dates', label: 'Project ending within', help: 'Projects ending inside this window appear in the alerts.', unit: 'days', min: 14, max: 730 },
];

let cur: Rules = DEFAULT_RULES;
/** The rules in force. */
export const rules = (): Rules => cur;
/** Reads stored rules: unknown keys are dropped, values outside their range fall back to the default. */
export function cleanRules(x?: Partial<Rules> | null): Rules {
  const out = { ...DEFAULT_RULES };
  for (const f of RULE_FIELDS) { const v = Number(x?.[f.key]); if (x?.[f.key] != null && Number.isFinite(v) && v >= f.min && v <= f.max) out[f.key] = v; }
  // An order that makes no sense is put right rather than refused: "seriously" can never start before "behind".
  if (out.paceFarBehind < out.paceBehind) out.paceFarBehind = out.paceBehind;
  if (out.lineCritical < out.lineOver) out.lineCritical = out.lineOver;
  return out;
}
export function setRules(x?: Partial<Rules> | null) { cur = cleanRules(x); }
/** Only what differs from the defaults is stored, so a later change of a default reaches everyone who did not set it. */
export function customRules(r: Rules): Partial<Rules> | undefined {
  const out: Partial<Rules> = {}; for (const f of RULE_FIELDS) if (r[f.key] !== DEFAULT_RULES[f.key]) out[f.key] = r[f.key];
  return Object.keys(out).length ? out : undefined;
}

export type PaceBand = 'far-behind' | 'behind' | 'ok' | 'ahead';
/** Where a pace gap (share spent − share of time elapsed) stands against the thresholds. */
export function paceBand(gap: number): PaceBand {
  return gap < -cur.paceFarBehind / 100 ? 'far-behind' : gap < -cur.paceBehind / 100 ? 'behind' : gap > cur.paceAhead / 100 ? 'ahead' : 'ok';
}
export const paceWord = (gap: number) => ({ 'far-behind': 'behind schedule', behind: 'behind schedule', ahead: 'ahead of schedule', ok: 'on track' })[paceBand(gap)];
/** Alert tone of a pace gap: being ahead (money runs out early) and far behind are serious. */
export const paceTone = (gap: number): 'serious' | 'warning' | 'good' => { const b = paceBand(gap); return b === 'far-behind' || b === 'ahead' ? 'serious' : b === 'behind' ? 'warning' : 'good'; };
