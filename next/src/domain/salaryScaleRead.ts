/**
 * Reads a country's monthly basic salary scale (grade by step) out of an uploaded document: a PDF, Word or Excel copy
 * of the CCR annex, so a newer scale (the adopted one after the proposal, next year's) replaces the one kept in the app.
 * Pages are given as rows of cells; the page that names the country (or the only page with a scale) is read.
 */
export interface ScaleRow { g: string; s: number[]; step: number[] }
export interface SalaryScale { source: string; file?: string; at?: string; asOf?: string; proposal?: boolean; currency: string; rows: ScaleRow[] }
export interface ScalePage { text: string; lines: string[][] }

const GRADE = /^\s*(L[TI]\s*\d\s*[-–]\s*L[TI]\s*\d|L[TI]\s*\d|[ABCL]\s?\d)(?=\s|$)/i;
/** Amounts as the CCR writes them (530,026.63 · 530 026,63 · 530026.63), each with two decimals. */
const AMOUNT = /(?<![\d.,])\d+(?:[   .,']\d{3})*[.,]\d{2}(?!\d)/g;
const num = (t: string) => { const d = t.replace(/[^\d.,]/g, ''), i = Math.max(d.lastIndexOf('.'), d.lastIndexOf(',')); return Number(`${d.slice(0, i).replace(/[.,]/g, '')}.${d.slice(i + 1)}`); };

function amounts(cells: string[]): number[] {
  const out: number[] = [];
  for (const c of cells) {
    const t = c.trim();
    if (/^-?\d+(?:\.\d+)?$/.test(t)) { if (+t >= 1) out.push(+t); continue; } // a number cell of a workbook
    for (const m of t.matchAll(AMOUNT)) out.push(num(m[0]));
  }
  return out;
}
const steady = (s: number[], step: number[]) => s.length > 1 && s.every((v, i) => i === 0 || Math.abs(v - s[i - 1] - (step.length > 1 && i >= 6 ? step[1] : step[0])) < 0.02);

/** One row of a scale: the grade, its steps and the step value(s) written after them (A grades: two, the second from step 7). */
export function scaleRow(cells: string[]): ScaleRow | null {
  const line = cells.map((c) => String(c ?? '')).filter((c) => c.trim());
  if (!line.length) return null;
  const m = GRADE.exec(line[0]); if (!m) return null;
  const rest = [line[0].slice(m[0].length), ...line.slice(1)];
  const N = amounts(rest); if (N.length < 3) return null;
  for (const k of [2, 1]) { const s = N.slice(0, -k), step = N.slice(-k); if (s.length >= 2 && steady(s, step)) return { g: m[1].replace(/\s+/g, ' ').replace(/^([ABCL]) ?(\d)$/i, '$1 $2').toUpperCase(), s, step }; }
  return { g: m[1].replace(/\s+/g, ' ').toUpperCase(), s: N, step: [] };
}

const AS_OF = /(?:as (?:of|at)|at|from)\s+(?:(\d{1,2})[./](\d{1,2})[./](20\d\d)|(\d{1,2})(?:st)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d\d))/i;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** The scale of `country` among the pages of a document; null when none can be read (a scale pasted as a picture has no text). */
export function readScale(pages: ScalePage[], country: RegExp, currency: RegExp, file?: string): SalaryScale | { error: string } {
  const found = pages.map((p) => ({ p, rows: p.lines.map(scaleRow).filter((r): r is ScaleRow => !!r) })).filter((x) => x.rows.length >= 3);
  if (!found.length) return { error: 'No salary scale could be read in this file. If the scales in it are pictures (as in the Word copy of the CCR report), open it and save it as PDF, then load the PDF.' };
  const named = found.filter((x) => country.test(x.p.text)), byCur = found.filter((x) => currency.test(x.p.text));
  const pick = named.length === 1 ? named[0] : byCur.length === 1 ? byCur[0] : found.length === 1 ? found[0] : null;
  if (!pick) return { error: `${found.length} salary scales were found in this file and none can be told apart as this country's. Load the page of this country only.` };
  // a grade seen twice on a page (a header repeated) keeps its first reading
  const rows = pick.rows.filter((r, i, A) => A.findIndex((x) => x.g === r.g) === i);
  const d = AS_OF.exec(pick.p.text);
  const asOf = d ? (d[3] ? `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}` : `${d[6]}-${String(MONTHS.indexOf(d[5].toLowerCase()) + 1).padStart(2, '0')}-${d[4].padStart(2, '0')}`) : undefined;
  const ref = /CM\(\d{4}\)\d+/.exec(pages.map((p) => p.text).join(' '))?.[0];
  const proposal = /\bpropos(?:al|ed)\b/i.test(pick.p.text);
  return { source: [ref, file].filter(Boolean).join(' — ') || 'Loaded file', ...(file ? { file } : {}), ...(asOf ? { asOf } : {}), proposal, currency: currency.test(pick.p.text) ? 'TRY' : '', rows };
}
