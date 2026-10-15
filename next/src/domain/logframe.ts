import type { Indicator } from './documents';

/** Removes reading leftovers: leading ":" and indicator references such as "1.2.1 .1 :". */
export const tidy = (s = '') => s.replace(/\b\d+(?:\s?\.\s?\d+){2,}\s*:?/g, ' ').replace(/^\s*[:;,.-]+\s*/, '').replace(/\s+([:;,.])/g, '$1').replace(/\s{2,}/g, ' ').trim();
/** First number in a value ("60%", "200 judges", "0 study") or null. */
export const num = (s = '') => { const m = tidy(s).replace(/(\d),(\d{3})/g, '$1$2').match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; };
/** Progress from baseline to target, 0–1+ ; null when not numeric. */
export const progress = (x: Indicator) => { const b = num(x.baseline) ?? 0, t = num(x.target), c = num(x.current); return t == null || c == null || t === b ? null : (c - b) / (t - b); };
