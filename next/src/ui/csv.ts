/** RFC-4180 CSV parser; detects ; or , delimiter from the header line. */
export function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const d = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = []; let row: string[] = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

/** Parses "1.234.567,89", "1,234,567.89", "1.000.000", "€ 1 234" → number; null when not numeric. */
export function parseAmount(s: string): number | null {
  let t = s.replace(/[€$£\s\u00a0']/g, '');
  if (!t) return null;
  const neg = /^\(.*\)$/.test(t) || t.startsWith('-') || t.startsWith('−');
  t = t.replace(/^[(\-−]|\)$/g, '');
  const dots = (t.match(/\./g) ?? []).length, commas = (t.match(/,/g) ?? []).length;
  if (dots && commas) {
    const dec = t.lastIndexOf('.') > t.lastIndexOf(',') ? '.' : ',';
    t = t.split(dec === '.' ? ',' : '.').join('').replace(',', '.');
  } else if (dots + commas) {
    const sep = dots ? '.' : ',', count = dots || commas;
    // Repeated separator, or a single one followed by exactly 3 digits, is a thousands separator.
    t = count > 1 || new RegExp(`\\${sep}\\d{3}$`).test(t) ? t.split(sep).join('') : t.replace(sep, '.');
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t);
  return neg ? -v : v;
}

/** Accepts YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY → YYYY-MM-DD or null. */
export function parseDay(s: string): string | null {
  s = s.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}
