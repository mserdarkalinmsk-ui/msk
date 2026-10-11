/**
 * Budget justification text often lists the calculation per output and activity, e.g.
 * "Output 1.2: A.1.2.2: (1 STC + 10 staff)*7 days = 119 days A.1.2.3: … Sub Total: 143".
 * This splits it into outputs → activity rows → subtotal and checks the arithmetic.
 */
export interface NoteRow { code: string; text: string; qty: number | null }
export interface NoteGroup { title: string; rows: NoteRow[]; subtotal: number | null; sum: number }
export interface Structured { intro: string; groups: NoteGroup[]; unit: string }

const qty = (s: string) => {
  const all = [...s.matchAll(/=\s*([\d.,]+)\s*([a-z]+)?/gi)];
  const m = all.at(-1);
  return m ? { n: parseFloat(m[1].replace(/,/g, '')), unit: (m[2] ?? '').toLowerCase() } : null;
};

export function structureNote(text: string): Structured | null {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!/\bOutput\s+\d|(?:^|\s)A\.\d+(?:\.\d+)+\s*:/.test(t)) return null;
  const parts = t.split(/(?=\bOutput\s+\d+(?:\.\d+)*\s*:)|(?=(?:^|\s)A\.\d+(?:\.\d+)+\s*:)|(?=\bSub[\s-]?Total\s*:)/i).map((x) => x.trim()).filter(Boolean);
  const groups: NoteGroup[] = []; let intro = ''; let unit = '';
  let g: NoteGroup | null = null;
  const ensure = () => (g ??= (groups.push({ title: '', rows: [], subtotal: null, sum: 0 }), groups.at(-1)!));
  for (const p of parts) {
    let m;
    if ((m = p.match(/^Output\s+(\d+(?:\.\d+)*)\s*:\s*(.*)$/i))) {
      g = { title: `Output ${m[1]}`, rows: [], subtotal: null, sum: 0 }; groups.push(g);
      if (m[2]) g.rows.push({ code: '', text: m[2], qty: qty(m[2])?.n ?? null });
    } else if ((m = p.match(/^A\.(\d+(?:\.\d+)+)\s*:\s*(.*)$/))) {
      const q = qty(m[2]); if (q?.unit && !unit) unit = q.unit;
      ensure().rows.push({ code: `A.${m[1]}`, text: m[2].replace(/^\(|\)$/g, '').trim(), qty: q?.n ?? null });
    } else if ((m = p.match(/^Sub[\s-]?Total\s*:\s*([\d.,]+)\s*(.*)$/i))) {
      ensure().subtotal = parseFloat(m[1].replace(/,/g, ''));
      if (m[2]) intro = intro ? `${intro} ${m[2]}` : m[2];
      g = null;
    } else if (g) g.rows.push({ code: '', text: p, qty: qty(p)?.n ?? null });
    else intro = intro ? `${intro} ${p}` : p;
  }
  for (const x of groups) x.sum = x.rows.reduce((s, r) => s + (r.qty ?? 0), 0);
  return groups.length ? { intro, groups, unit } : null;
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
