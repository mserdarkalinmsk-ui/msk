/** Reference date for all time-based calculations. `?today=YYYY-MM-DD` pins it (used by tests). */
const q = new URLSearchParams(location.search).get('today');
export const TODAY = q && !isNaN(Date.parse(q)) ? new Date(q + 'T00:00:00Z') : new Date();
