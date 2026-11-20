import { describe, expect, it } from 'vitest';
import { applyTemplate, ensureStyles, fieldsIn, fillFields, inspectTemplate, mergeBody } from './docxTemplate';

const r = (t: string, fmt = '') => `<w:r>${fmt ? `<w:rPr>${fmt}</w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const p = (...runs: string[]) => `<w:p><w:pPr><w:jc w:val="left"/></w:pPr>${runs.join('')}</w:p>`;
const doc = (body: string) => `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`;
const V = { date: '12.11.2026', project: 'Roma & Co <Phase 2>', bh: '9413', addressee: 'Line one\nLine two' };

describe('Word template', () => {
  it('fills a field typed in one run and keeps the formatting around it', () => {
    const out = fillFields(doc(p(r('Ankara, '), r('{{date}}', '<w:b/>'), r(' — ref.'))), V);
    expect(out).toContain('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">12.11.2026</w:t>');
    expect(out).toContain('>Ankara, <'); expect(out).toContain('> — ref.<'); expect(out).not.toContain('{{');
  });
  it('fills a field Word has split over several runs', () => {
    const out = fillFields(doc(p(r('Date: {{da'), r('te', '<w:i/>'), r('}} / BH {{ bh }}.'))), V);
    expect(out.replace(/<[^>]+>/g, '')).toContain('Date: 12.11.2026 / BH 9413.');
  });
  it('escapes values and keeps the lines of an address block', () => {
    const out = fillFields(doc(p(r('{{project}}')) + p(r('{{addressee}}'))), V);
    expect(out).toContain('Roma &amp; Co &lt;Phase 2&gt;');
    expect(out).toContain('Line one</w:t><w:br/><w:t xml:space="preserve">Line two');
  });
  it('leaves unknown fields and text without fields untouched', () => {
    const d = doc(p(r('Dear {{name}},')) + p(r('No fields here.')));
    expect(fillFields(d, V)).toBe(d);
    expect(fieldsIn(d)).toEqual(['name']);
  });
  it('puts the text where {{content}} stands, else after the text of the file', () => {
    const body = '<w:p><w:r><w:t>BODY</w:t></w:r></w:p>';
    const a = mergeBody(doc(p(r('Top')) + p(r('{{con'), r('tent}}')) + p(r('Bottom'))), body);
    expect(a.replace(/<[^>]+>/g, '')).toContain('TopBODYBottom'); expect(a).not.toContain('tent}}');
    const b = mergeBody(doc(p(r('Top'))), body);
    expect(b.indexOf('BODY')).toBeGreaterThan(b.indexOf('Top')); expect(b.indexOf('BODY')).toBeLessThan(b.indexOf('<w:sectPr'));
    // page settings inside a paragraph (a section break) are not the end of the body
    const c = mergeBody(`<w:document><w:body>${p(r('One'))}<w:p><w:pPr><w:sectPr/></w:pPr></w:p>${p(r('Two'))}</w:body></w:document>`, body);
    expect(c.indexOf('BODY')).toBeGreaterThan(c.indexOf('Two'));
  });
  it('adds only the styles the file does not have', () => {
    const own = '<w:styles><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>';
    const out = ensureStyles(own);
    expect(out.match(/w:styleId="Heading1"/g)).toHaveLength(1);
    for (const id of ['Title', 'Heading2', 'Heading3', 'Grid']) expect(out).toContain(`w:styleId="${id}"`);
    expect(ensureStyles(out)).toBe(out);
  });
  it('writes a whole document: header fields filled, pictures passed through, properties stamped', () => {
    const enc = new TextEncoder(), dec = new TextDecoder(), png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const parts = new Map<string, Uint8Array>([
      ['[Content_Types].xml', enc.encode('<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml"/></Types>')],
      ['word/document.xml', enc.encode(doc(p(r('{{addressee}}')) + p(r('{{content}}'))))],
      ['word/header1.xml', enc.encode(`<w:hdr>${p(r('BH {{bh}} · {{date}}'))}</w:hdr>`)],
      ['word/styles.xml', enc.encode('<w:styles></w:styles>')],
      ['word/media/image1.png', png],
      ['docProps/core.xml', enc.encode('<cp:coreProperties xmlns:cp="a" xmlns:dc="b"><dc:title>Old</dc:title></cp:coreProperties>')],
    ]);
    const info = inspectTemplate(new Map([...parts].filter(([n]) => /\.xml$/.test(n)).map(([n, b]) => [n, dec.decode(b)])));
    expect(info).toEqual({ content: true, fields: ['addressee', 'bh', 'date'], headers: 1, footers: 0 });
    const out = applyTemplate(parts, '<w:p><w:r><w:t>LETTER</w:t></w:r></w:p>', V, { title: 'Notification No. 3', description: 'figures from report X' });
    expect(dec.decode(out.get('word/document.xml')!)).toContain('LETTER');
    expect(dec.decode(out.get('word/header1.xml')!)).toContain('BH 9413 · 12.11.2026');
    expect(out.get('word/media/image1.png')).toBe(png);
    expect(dec.decode(out.get('[Content_Types].xml')!)).toContain('document.main+xml');
    expect(dec.decode(out.get('docProps/core.xml')!)).toBe('<cp:coreProperties xmlns:cp="a" xmlns:dc="b"><dc:title>Notification No. 3</dc:title><dc:description>figures from report X</dc:description></cp:coreProperties>');
    expect(() => inspectTemplate(new Map([['word/other.xml', '<x/>']]))).toThrow();
  });
});
