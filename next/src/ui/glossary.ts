/* What the app's words mean, shown on hover wherever they head a column or a figure. One place for every screen. */
export const GLOSSARY: Record<string, string> = {
  'spent': 'Paid: invoices and direct postings charged to the project so far.',
  'committed': 'Ordered but not yet paid: the open balance of purchase orders.',
  'spent + committed': 'Spent plus what is still open on purchase orders: the money no longer free.',
  's+c': 'Spent plus committed: paid plus still open on purchase orders.',
  'still open': 'Ordered but not yet paid on the purchase order.',
  'open balance': 'Ordered but not yet paid on the purchase order.',
  'uncommitted balance': 'Budget left after spent and committed: what can still be planned.',
  'remaining': 'Budget left after spent and committed.',
  'approved': 'The amount of the approved budget (the latest one signed).',
  'budget': 'The approved budget of the project.',
  'pace vs time': 'Share of the budget spent minus the share of the project time gone. Negative: spending is behind time.',
  'elapsed': 'Share of the project duration already gone.',
  'burn rate': 'Average spending per month over the recent months.',
  'utilisation': 'Spent + committed as a share of the budget.',
  'fte': 'Full-time equivalent: 1 = a full-time post, 0.5 = half time.',
  'units': 'The quantity charged to the line (days, months, persons…). Units show once something is spent.',
  'unit rate': 'The approved price of one unit on the line.',
  'needed to end': 'Months of the post still to pay until the project ends, at the share the line funds.',
  'months gap': 'Units left on the line minus months needed to the end. Negative: the line runs out before the end.',
  'forecast': 'Expected spending to the end of the project, from the plan and the current pace.',
  'flexibility': 'How far a heading may move from the approved budget without an addendum (usually 15% or 25%).',
  'ceiling': 'The maximum amount of the contract: orders above it need a new procurement or an amendment.',
  'renewable until': 'The last date the contract can be extended to (“may not be renewed beyond”).',
  'orders': 'Purchase orders (POs) placed with the provider.',
  'pos': 'Purchase orders.',
  'po': 'Purchase order: the commitment made with a provider on a budget line.',
  'line': 'Budget line code of the approved budget.',
  'kind': 'What the order buys: event management, consultants, interpretation, grants…',
  'share': 'Part of the total shown in the same table.',
  'sxb staff': 'Staff seconded by the Secretariat (HQ): the reports carry no contract dates for them.',
  'open-ended': 'A post with no end date: never warned.',
  'core team': 'The office’s own staff, outside the projects.',
  'contingency': 'Reserve kept in the budget for the unforeseen; used only with approval.',
  'direct costs': 'All budget lines before the administrative costs.',
  'administrative costs': 'Indirect costs, a fixed share of the direct costs (often 7%).',
};
const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/[▲▼↑↓⇅:*]/g, '').trim().toLowerCase();

/** Headings and figure labels whose words are in the glossary get their meaning on hover (and a dotted underline). */
export function glossaryPass(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('th, .hero .label, .ev-sum span, .en-k span, .kpi .label, dt').forEach((e) => {
    if (e.title || e.hasAttribute('data-gl')) return;
    const t = GLOSSARY[norm(e.textContent ?? '')]; if (!t) return;
    e.title = t; e.setAttribute('data-gl', '');
  });
}
