import { MON } from '../domain/dt';
const nf2 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Exact amounts everywhere carry their cents (€5,403,333.01); `short` stays for headline figures and charts. */
// A value that rounds to zero is shown without a sign (never “−€0.00”).
export const full = (v: number) => (v <= -0.005 ? '−€' : '€') + nf2.format(Math.abs(v));
export function short(v: number) {
  const a = Math.abs(v), s = v < 0 && a >= 0.5 ? '−' : '';
  if (a >= 1e9) return `${s}€${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}€${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `${s}€${(a / 1e3).toFixed(0)}K`;
  return `${s}€${a.toFixed(0)}`;
}
export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
export const signedPct = (v: number) => { const r = Math.round(v * 100); return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)} pp`; };
// One way of writing a date everywhere ("30 Sep 2026", "Sep 2026"): the browser's own short months differ ("Sept").
export const month = (t: number | string) => { const d = new Date(typeof t === 'string' ? t + 'T00:00:00Z' : t); return isNaN(d.getTime()) ? String(t) : `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const date = (s: string) => { const d = new Date(s + 'T00:00:00Z'); return isNaN(d.getTime()) ? s : `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const period = (p: { start: string; end: string; datesTbc?: boolean }) => (p.datesTbc ? 'dates to confirm' : `${month(p.start)} → ${month(p.end)}`);
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const cents = full;
