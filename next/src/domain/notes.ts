/**
 * Budget justification text often lists the calculation per output and activity, e.g.
 * "Output 1.2: A.1.2.2: (1 STC + 10 staff)*7 days = 119 days A.1.2.3: … Sub Total: 143".
 * This splits it into outputs → activity rows → subtotal and checks the arithmetic.
 */
export interface NoteRow { code: string; text: string; qty: number | null }
export interface NoteGroup { title: string; rows: NoteRow[]; subtotal: number | null; sum: number }
export interface Structured { intro: string; groups: NoteGroup[]; unit: string }

/** "145.200" / "1,908,319" / "12.5" → number (thousand separators of either style). */
export const parseNum = (x: string) => {
  const s = x.replace(/[.,]$/, '');
  if (/^\d{1,3}([.,])\d{3}(\1\d{3})*$/.test(s)) return parseFloat(s.replace(/[.,]/g, ''));
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return parseFloat(s.replace(/,/g, ''));
};

const qty = (s: string) => {
  const m = [...s.matchAll(/=\s*([\d][\d.,]*)\s*([a-z]+)?/gi)].at(-1) ?? [...s.matchAll(/:\s*([\d][\d.,]*)\s*(eur|euro|days)\b/gi)].at(-1);
  return m ? { n: parseNum(m[1]), unit: (m[2] ?? '').toLowerCase() } : null;
};

/** PDF text often loses the "ti" ligature (shown as Θ or a private-use glyph): "interpreta Θ on" → "interpretation". */
// Escapes stay in the pattern text so the bundle never holds a literal U+FFFD.
const LIG = new RegExp('\\s?[\\u0398\\u019F\\u2296\\u29B5\\uFFFD\\uE000-\\uF8FF]\\s?', 'g');
export const tidyText = (t: string) => t.replace(LIG, 'ti').replace(/\s+/g, ' ').trim();

const ACT = String.raw`-?\s*A\.?\s?(\d+(?:\.\d+)+)\s*:?`;

export function structureNote(text: string): Structured | null {
  const t = tidyText(text);
  if (!/\bOutput\s+\d/.test(t) && !new RegExp(`(?:^|\\s)${ACT}\\s`).test(t)) return null;
  const parts = t.split(new RegExp(String.raw`(?=\bOutput\s+\d+(?:\.\d+)*\s*:)|(?=(?:^|\s)-?\s*A\.?\s?\d+(?:\.\d+)+\s*:?\s)|(?=\bSub[\s-]?Total\s*:)|(?=\s-\s?[A-Z][^:\-]{2,60}:\s*\d)`, 'i')).map((x) => x.trim().replace(/\s*-$/, '')).filter(Boolean);
  const groups: NoteGroup[] = []; let intro = ''; let unit = '';
  let g: NoteGroup | null = null;
  const ensure = () => (g ??= (groups.push({ title: '', rows: [], subtotal: null, sum: 0 }), groups.at(-1)!));
  const act = new RegExp(`^${ACT}\\s*(.*)$`);
  for (const p of parts) {
    let m;
    if ((m = p.match(/^Output\s+(\d+(?:\.\d+)*)\s*:\s*(.*)$/i))) {
      g = { title: `Output ${m[1]}`, rows: [], subtotal: null, sum: 0 }; groups.push(g);
      if (m[2]) g.rows.push({ code: '', text: m[2], qty: qty(m[2])?.n ?? null });
    } else if ((m = p.match(act))) {
      const q = qty(m[2]); if (q?.unit && !unit) unit = q.unit;
      ensure().rows.push({ code: `A.${m[1]}`, text: m[2].replace(/^\(|\)$/g, '').replace(/\s*-$/, '').trim(), qty: q?.n ?? null });
    } else if ((m = p.match(/^Sub[\s-]?Total\s*:\s*([\d][\d.,]*)\s*(EUR|euro|days)?\s*(.*)$/i))) {
      ensure().subtotal = parseNum(m[1]);
      if (m[2] && !unit) unit = m[2].toLowerCase();
      g = null;
      // Text after a subtotal usually names the next group ("Medium Scale Events").
      if (m[3]) { const title = m[3].replace(/\s*-\s*$/, ''); if (title.length < 80) { g = { title, rows: [], subtotal: null, sum: 0 }; groups.push(g); } else intro = intro ? `${intro} ${title}` : title; }
    } else if ((m = p.match(/^-\s?([A-Z][^:]{2,60}:\s*\d.*)$/))) {
      const q = qty(m[1]); ensure().rows.push({ code: '', text: m[1], qty: q?.n ?? null });
    } else if (!groups.length && p.length < 80) { g = { title: p, rows: [], subtotal: null, sum: 0 }; groups.push(g); }
    else if (g) g.rows.push({ code: '', text: p, qty: qty(p)?.n ?? null });
    else intro = intro ? `${intro} ${p}` : p;
  }
  for (const x of groups) x.sum = x.rows.reduce((s, r) => s + (r.qty ?? 0), 0);
  return groups.some((x) => x.rows.length) ? { intro, groups, unit } : null;
}

/** Prose as bullets: "Costs related to a, b, c and d." → intro + items; " - " or ";" separated lists → items. */
export function bulletNote(text: string): { intro: string; items: string[] } | null {
  const t = tidyText(text);
  const semi = t.split(/\s*;\s+|\s+-\s+(?=[A-Z])/).filter(Boolean);
  if (semi.length >= 3) return { intro: '', items: semi.map((x) => x.replace(/[.;]$/, '')) };
  const m = t.match(/^(.{3,60}?\b(?:related to|include[sd]?|including|such as|for|cover(?:s|ing)?)\s*:?)\s+(.+)$/i);
  const body = m ? m[2] : t;
  const items = body.replace(/\.$/, '').split(/,\s+/).map((x) => x.trim()).filter(Boolean);
  if (items.length >= 4 && items.every((x) => x.length < 120)) return { intro: m ? m[1] : '', items };
  return null;
}

/** Joins wrapped PDF lines: re-attaches words hyphenated at a line end, keeps real hyphens ("short-term"). */
export function joinLines(lines: string[]): string {
  let out = '';
  for (const l of lines.map((x) => x.trim()).filter(Boolean)) {
    if (/[A-Za-zÀ-ÿ]-$/.test(out) && /^[a-zà-ÿ]/.test(l)) out = /^(term|level|based|related|making|time|scale|up|going|wide)\b/.test(l) ? out + l : out.slice(0, -1) + l;
    else out = out ? `${out} ${l}` : l;
  }
  return out.replace(/\s+([,.;:)])/g, '$1').replace(/\(\s+/g, '(').replace(/\s{2,}/g, ' ');
}
