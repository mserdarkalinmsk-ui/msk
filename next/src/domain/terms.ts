/**
 * The shared vocabulary: codes, formats and names used by every screen, export and check.
 * Change a term here and the screens, Word/Excel exports and the deck follow.
 */

/** Budget line codes with a fixed meaning in CoE/EU budgets. */
export const ADMIN_LINE = '10'; // administrative (indirect) costs, 7% of direct costs
export const CONTINGENCY_LINE = '8';
export const ADMIN_RATE = 0.07;

/** How a stored report was read. */
export const FORMAT = { workbook: 'CoE workbook', extraction: 'CoE system extraction', imported: 'Imported' } as const;

/** Report types offered when a report is registered. */
export const REPORT_TYPES = ['Latest Approved Budget', 'Interim Financial Report', 'Quarterly Financial Report', 'Yearly / Annual Report', 'Final Report', 'System extraction'] as const;

/** Office budget funds. */
export const FUNDS = { ob: 'Ordinary Budget', ls: 'LS & Pagoda' } as const;
