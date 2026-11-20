/**
 * Writing a generated document into the user's own Word file (letterhead): the header, footer, fonts, margins and
 * styles of that file are kept; the generated text goes where the file says {{content}} (or after its own text), and
 * {{date}}, {{project}} … are filled in wherever they stand — body, header or footer. Pure text work on the XML parts.
 */
const escX = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const unescX = (s: string) => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()]);

/** Innermost paragraphs: <w:p …>…</w:p> with no other paragraph inside (a text box holds its own). */
const PARA = /<w:p(?:\s[^>]*)?>(?:(?!<w:p[\s>])[\s\S])*?<\/w:p>/g;
const TEXT = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const FIELD = /\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g;
export const CONTENT = 'content';

const textOf = (p: string) => [...p.matchAll(TEXT)].map((m) => unescX(m[1])).join('');

/**
 * Fills the {{fields}} of one paragraph. Word often splits a field over several runs ("{{da" + "te}}"): the value
 * goes into the run where the field starts and the rest of the field is removed from the following runs, so the
 * formatting of everything around it stays as it was. Unknown fields are left as typed.
 */
function fillParagraph(p: string, vars: Record<string, string>): string {
  const T = [...p.matchAll(TEXT)]; if (!T.length) return p;
  const texts = T.map((m) => unescX(m[1])), full = texts.join('');
  if (!full.includes('{{')) return p;
  const starts: number[] = []; let o = 0; for (const t of texts) { starts.push(o); o += t.length; }
  const out = texts.slice(); let touched = false;
  // Right to left: a change never moves the part of a run that is still to be read.
  for (const m of [...full.matchAll(FIELD)].reverse()) {
    const key = m[1].toLowerCase(); if (!(key in vars) || key === CONTENT) continue;
    const s = m.index!, e = s + m[0].length; let first = true; touched = true;
    for (let i = 0; i < texts.length; i++) {
      const a = starts[i], b = a + texts[i].length; if (b <= s || a >= e) continue;
      out[i] = out[i].slice(0, Math.max(s, a) - a) + (first ? vars[key] : '') + out[i].slice(Math.min(e, b) - a); first = false;
    }
  }
  if (!touched) return p;
  let i = 0;
  // A value of several lines (an address block) breaks the line inside the run.
  return p.replace(TEXT, () => `<w:t xml:space="preserve">${out[i++].split('\n').map(escX).join('</w:t><w:br/><w:t xml:space="preserve">')}</w:t>`);
}
/** Fills the fields of a whole part (document, header or footer). */
export const fillFields = (xml: string, vars: Record<string, string>) => (xml.includes('{{') || /\{<\/w:t>/.test(xml) ? xml.replace(PARA, (p) => fillParagraph(p, vars)) : xml);

/** The fields a part names, lower case, in order of appearance (to show the user what the file asks for). */
export function fieldsIn(xml: string): string[] {
  const out: string[] = [];
  for (const p of xml.match(PARA) ?? []) for (const m of textOf(p).matchAll(FIELD)) { const k = m[1].toLowerCase(); if (!out.includes(k)) out.push(k); }
  return out;
}

/**
 * Puts the generated body into the document part: in place of the paragraph that says {{content}}; without one,
 * after the file's own text and before its page settings.
 */
export function mergeBody(documentXml: string, body: string): string {
  let done = false;
  const out = documentXml.replace(PARA, (p) => { if (done || !/\{\{\s*content\s*\}\}/i.test(textOf(p))) return p; done = true; return body; });
  if (done) return out;
  const end = out.lastIndexOf('</w:body>'); if (end < 0) throw new Error('This file has no document body');
  // The last section settings of the body are its direct child and come last.
  const sect = out.lastIndexOf('<w:sectPr', end), at = sect >= 0 && !out.slice(sect, end).includes('</w:p>') ? sect : end;
  return out.slice(0, at) + body + out.slice(at);
}

/** Style definitions the generated body uses; one is added only when the file does not define that style itself. */
export const BODY_STYLES: Record<string, string> = {
  Title: '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>',
  Heading1: '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="27"/></w:rPr></w:style>',
  Heading2: '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>',
  Heading3: '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:i/></w:rPr></w:style>',
  Grid: '<w:style w:type="table" w:styleId="Grid"><w:name w:val="Table Grid"/></w:style>',
};
export function ensureStyles(stylesXml: string): string {
  const add = Object.entries(BODY_STYLES).filter(([id]) => !new RegExp(`w:styleId="${id}"`).test(stylesXml)).map(([, x]) => x).join('');
  const end = stylesXml.lastIndexOf('</w:styles>');
  return add && end >= 0 ? stylesXml.slice(0, end) + add + stylesXml.slice(end) : stylesXml;
}

/** What a Word file offers as a template: whether it marks the place of the text, and the fields it names. */
export interface TemplateInfo { content: boolean; fields: string[]; headers: number; footers: number }
export function inspectTemplate(parts: Map<string, string>): TemplateInfo {
  const doc = parts.get('word/document.xml'); if (!doc || !doc.includes('<w:body')) throw new Error('This is not a Word document (.docx)');
  const hf = [...parts.keys()].filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n));
  const all = [doc, ...hf.map((n) => parts.get(n)!)].flatMap(fieldsIn);
  return { content: all.includes(CONTENT), fields: [...new Set(all)].filter((f) => f !== CONTENT), headers: hf.filter((n) => n.includes('header')).length, footers: hf.filter((n) => n.includes('footer')).length };
}

/** The fields the app can fill, with what each one is. */
export const FIELDS: [string, string][] = [
  ['content', 'where the text of the letter or document goes'],
  ['date', 'today, 12.11.2026'], ['date_long', 'today, 12 November 2026'], ['title', 'title of the document'],
  ['project', 'project name'], ['code', 'project code'], ['bh', 'budget head'], ['agreement', 'agreement / contract number'],
  ['organisation', 'organisation name (Appearance)'], ['addressee', 'address block of the notification letters'], ['signature', 'signature block'],
];

/**
 * The parts of the template with the generated body merged in and the fields filled: document, headers, footers and
 * styles are rewritten, every other part (images, fonts, theme, settings) is passed through untouched.
 */
export function applyTemplate(parts: Map<string, Uint8Array>, body: string, vars: Record<string, string>, core?: { title: string; description?: string }): Map<string, Uint8Array> {
  const dec = new TextDecoder(), enc = new TextEncoder(), out = new Map(parts);
  const text = (n: string) => { const b = parts.get(n); return b ? dec.decode(b) : undefined; };
  const doc = text('word/document.xml'); if (!doc) throw new Error('This is not a Word document (.docx)');
  out.set('word/document.xml', enc.encode(fillFields(mergeBody(doc, body), vars)));
  for (const n of parts.keys()) if (/^word\/(header|footer)\d*\.xml$/.test(n)) out.set(n, enc.encode(fillFields(text(n)!, vars)));
  const st = text('word/styles.xml'); if (st) out.set('word/styles.xml', enc.encode(ensureStyles(st)));
  // A template file (.dotx) becomes an ordinary document.
  const ct = text('[Content_Types].xml'); if (ct && ct.includes('template.main+xml')) out.set('[Content_Types].xml', enc.encode(ct.replace('wordprocessingml.template.main+xml', 'wordprocessingml.document.main+xml')));
  const cp = text('docProps/core.xml');
  if (core && cp && cp.includes('xmlns:dc=')) {
    const clean = cp.replace(/<dc:title>[\s\S]*?<\/dc:title>|<dc:title\/>|<dc:description>[\s\S]*?<\/dc:description>|<dc:description\/>/g, '');
    const at = clean.indexOf('>', clean.indexOf('<cp:coreProperties')) + 1;
    if (at > 0) out.set('docProps/core.xml', enc.encode(clean.slice(0, at) + `<dc:title>${escX(core.title)}</dc:title>${core.description ? `<dc:description>${escX(core.description)}</dc:description>` : ''}` + clean.slice(at)));
  }
  return out;
}
