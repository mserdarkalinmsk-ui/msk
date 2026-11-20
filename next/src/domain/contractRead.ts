/**
 * Reads the terms of a contract (an Act of Engagement, a framework contract) out of its text: the reference, the
 * provider, the end ("concluded until"), the last date it may be renewed to ("may not be renewed beyond"), the total
 * and its currency. A scanned copy has no text: nothing is read and the user types the terms.
 */
export interface ContractTerms { ref?: string; provider?: string; start?: string; end?: string; renewBy?: string; total?: number; fee?: number; cur?: string }

const DATE = String.raw`(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d\d)`;
const iso = (m: RegExpExecArray | null, i = 1) => m ? `${m[i + 2]}-${m[i + 1].padStart(2, '0')}-${m[i].padStart(2, '0')}` : undefined;
/** 1.133.553,63 · 1,133,553.63 · 1 133 553,63 → 1133553.63 */
export function money(s: string): number | undefined {
  const t = s.replace(/[\s  ]/g, ''), i = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  const v = i >= 0 && t.length - i - 1 === 2 ? Number(`${t.slice(0, i).replace(/[.,]/g, '')}.${t.slice(i + 1)}`) : Number(t.replace(/[.,]/g, ''));
  return Number.isFinite(v) && v > 0 ? v : undefined;
}
const AMT = String.raw`(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?|\d+[.,]\d{2})`;
const CUR = (s: string) => /TRY|TL|₺|lira/i.test(s) ? 'TRY' : /USD|\$/i.test(s) ? 'USD' : 'EUR';

export function contractTerms(text: string): ContractTerms {
  const T = text.replace(/[►▶▸]/g, ' ').replace(/\s+/g, ' ');
  const out: ContractTerms = {};
  const ref = /Contract\s*(?:No\.?|number|n°)\s*:?\s*([A-Z]{1,6}[\s-]?\d{2,5}\s*\/\s*20\d\d|[A-Z0-9][A-Z0-9\/\-.]{3,})/i.exec(T); if (ref) out.ref = ref[1].replace(/\s+/g, '');
  const prov = /Name\s+and\s+address\d?\s*:?\s*(.+?)(?:\s+(?:[A-ZÇĞİÖŞÜa-zçğıöşü.]+\s+)?(?:Mah\.|Mahallesi|Cad\.|Caddesi|Sok\.|Sokak|Bul\.|Bulvarı|No\s*:|Street|Avenue|Road|\d{5}\b)|\s+Consortium|\s+Representative)/.exec(T);
  // the name ends in its legal form (LTD. ŞTİ., A.Ş., INC…); the label may sit between the lines of the address
  const at = T.search(/Name\s+and\s+address/i);
  if (at >= 0) {
    const W = T.slice(Math.max(0, at - 250), at + 400), mid = Math.min(250, at);
    const LEGAL = /[A-ZÇĞİÖŞÜ0-9][A-ZÇĞİÖŞÜ0-9&'’.,\- ]{2,120}?\b(?:LTD\.?\s*ŞT[İI]\.?|LTD\.?\s*STI\.?|LTD\.?|LIMITED(?:\s+COMPANY)?|A\.\s?Ş\.?|A\.\s?S\.|AŞ|INC\.?|LLC|GMBH|SARL|SRL|COMPANY|ŞT[İI]\.?)(?=\s|$|[,;])/g;
    const hits = [...W.matchAll(LEGAL)].map((m) => ({ s: m[0].replace(/^.*\b(?:address\d?|person|Name)\s+/i, '').trim(), d: Math.abs(m.index! - mid) }));
    const best = hits.sort((a, b) => a.d - b.d)[0];
    if (best) out.provider = best.s;
  }
  if (!out.provider && prov) out.provider = prov[1].trim().replace(/[,;]$/, '');
  const end = new RegExp(String.raw`concluded\s+until\s*:?\s*${DATE}`, 'i').exec(T); if (end) out.end = iso(end);
  const ren = new RegExp(String.raw`(?:may\s+not\s+be\s+renewed\s+beyond|renewed\s+(?:until|up\s+to))\s*:?\s*${DATE}`, 'i').exec(T); if (ren) out.renewBy = iso(ren);
  const start = new RegExp(String.raw`(?:takes\s+effect|starts?|commenc\w+)\s+(?:on|from|as\s+from)\s+${DATE}`, 'i').exec(T); if (start) out.start = iso(start);
  // the total: "TOTAL … 1.133.553,63 TRY" (the first amount after the word, with its currency)
  const tot = new RegExp(String.raw`TOTAL.{0,80}?${AMT}\s*(TRY|TL|EUR|€|USD|\$)`, 'i').exec(T);
  if (tot) { const v = money(tot[1]); if (v) { out.total = v; out.cur = CUR(tot[2]); } }
  // a single fee per month ("… per month … 8.000,00 TRY") only when the contract names one
  const fee = new RegExp(String.raw`(?:monthly\s+fee|fee\s+per\s+month).{0,40}?${AMT}\s*(TRY|TL|EUR|€|USD|\$)`, 'i').exec(T);
  if (fee) { const v = money(fee[1]); if (v) { out.fee = v; out.cur ??= CUR(fee[2]); } }
  return out;
}
