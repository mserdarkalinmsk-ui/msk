/**
 * Reads the terms of a contract (an Act of Engagement, a framework contract) out of its text: the reference, the
 * provider, the end ("concluded until"), the last date it may be renewed to ("may not be renewed beyond"), the total
 * and its currency. A scanned copy has no text: nothing is read and the user types the terms.
 */
export interface ContractTerms { ref?: string; provider?: string; start?: string; end?: string; renewBy?: string; total?: number; fee?: number; cur?: string }

const DATE = String.raw`(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d\d)`;
const MONTH = 'January|February|March|April|May|June|July|August|September|October|November|December';
/** A date written either way: 31/12/2026 or 31 December 2026. */
const ANYDATE = String.raw`(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d\d|\d{1,2}(?:st|nd|rd|th)?\s+(?:${MONTH})\s+20\d\d)`;
const isoAny = (t?: string) => { if (!t) return undefined; const a = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d\d)/.exec(t); if (a) return `${a[3]}-${a[2].padStart(2, '0')}-${a[1].padStart(2, '0')}`;
  const b = new RegExp(String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH})\s+(20\d\d)`, 'i').exec(t); return b ? `${b[3]}-${String(MONTH.split('|').findIndex((m) => m.toLowerCase() === b[2].toLowerCase()) + 1).padStart(2, '0')}-${b[1].padStart(2, '0')}` : undefined; };
/** A date as a scan reads it: a slash may come out as 1, l, I or | or drop out ("310112027" for 31/01/2027). */
const SCAN_DATE = /(?<!\d)(\d{2})(?:[\/.\-]|[1lI|](?=\d{2}[\/.\-1lI|]20\d\d))?(\d{2})[\/.\-1lI|](20\d\d)(?!\d)/;
/** The date written next to a label: after it, or (a scan of a two-column table) just before it. */
function dateNear(T: string, label: RegExp): string | undefined {
  const m = label.exec(T); if (!m) return undefined;
  const after = SCAN_DATE.exec(T.slice(m.index + m[0].length, m.index + m[0].length + 40));
  const before = [...T.slice(Math.max(0, m.index - 90), m.index).matchAll(new RegExp(SCAN_DATE, 'g'))].at(-1);
  const d = after ?? before; if (!d) return undefined;
  const [dd, mm] = [+d[1], +d[2]]; return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 ? `${d[3]}-${d[2]}-${d[1]}` : undefined;
}
const iso = (m: RegExpExecArray | null, i = 1) => m ? `${m[i + 2]}-${m[i + 1].padStart(2, '0')}-${m[i].padStart(2, '0')}` : undefined;
/** 1.133.553,63 · 1,133,553.63 · 1 133 553,63 → 1133553.63 */
export function money(s: string): number | undefined {
  const t = s.replace(/[\s  ]/g, ''), i = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  const v = i >= 0 && t.length - i - 1 === 2 ? Number(`${t.slice(0, i).replace(/[.,]/g, '')}.${t.slice(i + 1)}`) : Number(t.replace(/[.,]/g, ''));
  return Number.isFinite(v) && v > 0 ? v : undefined;
}
const AMT = String.raw`(?<![\d.,])(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?|\d+[.,]\d{2})`;
const CUR = (s: string) => /TRY|TL|₺|lira/i.test(s) ? 'TRY' : /USD|\$/i.test(s) ? 'USD' : 'EUR';

export function contractTerms(text: string): ContractTerms {
  const T = text.replace(/[►▶▸]/g, ' ').replace(/\s+/g, ' ');
  const out: ContractTerms = {};
  // the reference: its most frequent reading over the pages (a scan reads it differently on some of them)
  const refs = [...T.matchAll(/Contract\s*(?:No\.?|number|n°)[\s,.:>»$|]*([A-Z$8][A-Z0-9]{0,5}[\s-]?[0-9O]{2,5}\s*\/\s*20\d\d|[A-Z0-9][A-Z0-9\/\-.]{3,})/gi)]
    .map((m) => m[1].replace(/\s+/g, '').replace(/^\$/, 'S').replace(/^([A-Z]{1,6}?)([0-9O]+)(?=\/)/, (_, a: string, b: string) => a + b.replace(/O/g, '0')));
  const good = refs.filter((x) => /^[A-Z]{1,6}\d{2,5}\/20\d\d$/.test(x)), pool = good.length ? good : refs;
  if (pool.length) out.ref = [...pool.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0][0];
  const prov = /Name\s+and\s+address\d?\s*:?\s*(.+?)(?:\s+(?:[A-ZÇĞİÖŞÜa-zçğıöşü.]+\s+)?(?:Mah\.|Mahallesi|Cad\.|Caddesi|Sok\.|Sokak|Bul\.|Bulvarı|No\s*:|Street|Avenue|Road|\d{5}\b)|\s+Consortium|\s+Representative)/.exec(T);
  // the name ends in its legal form (LTD. ŞTİ., A.Ş., INC…); the label may sit between the lines of the address
  // the label as a scan may cut it: "Name and = … address"
  const at = T.search(/Name\s+and\s+address|Name\s+and\b/);
  if (at >= 0) {
    const W = T.slice(Math.max(0, at - 250), at + 400), mid = Math.min(250, at);
    const LEGAL = /[A-ZÇĞİÖŞÜ0-9][A-ZÇĞİÖŞÜ0-9&'’.,\- ]{2,120}?\b(?:LTD\.?\s*ŞT[İIi]\.?|LTD\.?\s*ST[Ii]\.?|LTD\.?|LIMITED(?:\s+COMPANY)?|A\.\s?Ş\.?|A\.\s?S\.|AŞ|INC\.?|LLC|GMBH|SARL|SRL|COMPANY|ŞT[İI]\.?)(?=\s|$|[,;])/g;
    const hits = [...W.matchAll(LEGAL)].map((m) => ({ s: m[0].replace(/^.*\b(?:address\d?|person|Name)\s+/i, '').trim(), d: Math.abs(m.index! - mid) }));
    const best = hits.sort((a, b) => a.d - b.d)[0];
    if (best) out.provider = best.s;
  }
  if (!out.provider && prov) out.provider = prov[1].trim().replace(/[,;]$/, '');
  // no label read (a scan of the provider table): the company named most often on the first pages, other than the Council
  if (!out.provider) {
    const L2 = /[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9&'’.,\- ]{4,120}?\b(?:LTD\.?\s*ŞT[İIi]\.?|LTD\.?\s*ST[Ii]\.?|LTD\.?|LIMITED(?:\s+COMPANY)?|A\.\s?Ş\.?|A\.\s?S\.|INC\.?|LLC|GMBH|SARL|SRL)(?=\s|$|[,;])/g;
    const H = [...T.slice(0, 3000).matchAll(L2)].map((m) => m[0].replace(/^[^A-Z]*|^(?:[A-Z]{1,3}\)?\s+)/, '').trim()).filter((x) => !/COUNCIL|EUROPE/i.test(x));
    const n = new Map<string, number>(); for (const x of H) n.set(x, (n.get(x) ?? 0) + 1);
    const top = [...n].sort((a, b) => b[1] - a[1])[0]; if (top) out.provider = top[0];
  }
  // a lease, an amendment or a rider names the other party as the Lessor (or the Contractor / Provider)
  const party = /(?:\band\s+)?([A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü.'’\- ]{2,80}?)\s*\(hereinafter(?:\s+referred\s+to\s+as)?\s+["“”]?(?:the\s+)?["“”]?(?:Lessor|Contractor|Service Provider|Provider|Supplier)\b/.exec(T);
  if (party) out.provider = party[1].split(/\s+and\s+/i).pop()!.replace(/^(?:and|Represented by)\s+/i, '').trim();
  // a period written in words: "starting from 1 December 2023 until 31 December 2023", "from … to …"
  // the duration of the contract itself, not a sub-period of a rent revision
  const per = new RegExp(String.raw`(?:extended|fixed\s+period|duration|term\s+of)[^.]{0,60}?(?:starting\s+)?from\s+${ANYDATE}\s+(?:until|to|till|through)\s+${ANYDATE}`, 'i').exec(T);
  if (per) { out.start ??= isoAny(per[1]); out.end ??= isoAny(per[2]); }
  const eff = new RegExp(String.raw`with\s+effect\s+from\s+${ANYDATE}`, 'i').exec(T); if (eff) out.start ??= isoAny(eff[1]);
  const end = dateNear(T, /concluded\s+until\s*:?/i); if (end) out.end = end;
  const ren = dateNear(T, /(?:may\s+not\s+be\s+renewed\s+beyond|renewed\s+(?:until|up\s+to))\s*:?/i); if (ren) out.renewBy = ren;
  const start = new RegExp(String.raw`(?:takes\s+effect|starts?|commenc\w+)\s+(?:on|from|as\s+from)\s+${DATE}`, 'i').exec(T); if (start) out.start = iso(start);
  // the total: "TOTAL … 1.133.553,63 TRY" (the first amount after the word, with its currency)
  // several totals (purchase, monthly fees, all services): the largest is the contract's total
  // a monthly rent is not a total
  const tots = [...T.matchAll(new RegExp(String.raw`TOTAL(.{0,80}?)${AMT}\s*(TRY|TL|EUR|€|USD|\$)(\s+monthly\s+rent)?`, 'gi'))].filter((m) => !m[4] && !/monthly\s+rent/i.test(m[1])).map((m) => ({ v: money(m[2]), c: m[3] })).filter((x) => x.v) as { v: number; c: string }[];
  const tot = tots.sort((a, b) => b.v - a.v)[0]; if (tot) { out.total = tot.v; out.cur = CUR(tot.c); }
  // a single fee per month ("… per month … 8.000,00 TRY") only when the contract names one
  // a monthly fee, not the total of the monthly fees
  const fee = new RegExp(String.raw`(?<!total\s+for\s+)(?:monthly\s+fee|fee\s+per\s+month).{0,40}?${AMT}\s*(TRY|TL|EUR|€|USD|\$)`, 'i').exec(T);
  if (fee) { const v = money(fee[1]); if (v) { out.fee = v; out.cur ??= CUR(fee[2]); } }
  // a rent: "316,125 TRY monthly rent", "monthly rent of 8.000,00 TRY" — the last one written is the one in force
  const rents = [...T.matchAll(new RegExp(String.raw`${AMT}\s*(TRY|TL|EUR|€|USD|\$)\s+monthly\s+rent|monthly\s+rent\s+(?:of\s+)?${AMT}\s*(TRY|TL|EUR|€|USD|\$)`, 'gi'))];
  const r = rents.at(-1); if (!out.fee && r) { const v = money(r[1] ?? r[3]); if (v) { out.fee = v; out.cur ??= CUR(r[2] ?? r[4]); } }
  return out;
}
