/** A date as every screen writes it (14 Oct 2026); anything that is not an ISO date passes through unchanged. */
const df = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const dmy = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? df.format(new Date(s.slice(0, 10) + 'T00:00:00Z')) : s ?? '');
