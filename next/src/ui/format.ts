const nf = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
export const full = (v: number) => '€' + nf.format(Math.round(v));
export function short(v: number) {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e9) return `${s}€${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}€${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `${s}€${(a / 1e3).toFixed(0)}K`;
  return `${s}€${a.toFixed(0)}`;
}
export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
export const signedPct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(0)} pp`;
const mf = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const df = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const month = (t: number | string) => mf.format(new Date(typeof t === 'string' ? t + 'T00:00:00Z' : t));
export const date = (s: string) => df.format(new Date(s + 'T00:00:00Z'));
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
