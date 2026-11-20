/** A date as every screen writes it (14 Oct 2026); anything that is not an ISO date passes through unchanged. */
/** Short month names as every screen and file writes them ("Sep", never the browser's "Sept"). */
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 2026-09-30 (or a Date) → "30 Sep 2026". */
export const dayMonYear = (d: Date) => `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const dmy = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? dayMonYear(new Date(s.slice(0, 10) + 'T00:00:00Z')) : s ?? '');
