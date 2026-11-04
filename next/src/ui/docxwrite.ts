import { takeStamp } from './stamp';
import { saveFile } from './save';
import { pngData, zip } from './xlsxwrite';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const run = (t: string, b = false, sz?: number, color?: string) => t ? `<w:r><w:rPr>${b ? '<w:b/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}${sz ? `<w:sz w:val="${sz}"/>` : ''}</w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>` : '';
const para = (runs: string, style?: string, extra = '') => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>${runs}</w:p>`;

/** Inline content of an element as runs (bold kept, form fields read by their value, hidden/print-less parts skipped). */
function runs(el: Node, bold = false, sz?: number): string {
  if (el.nodeType === 3) return run((el.textContent ?? '').replace(/\s+/g, ' '), bold, sz);
  if (el.nodeType !== 1) return '';
  const e = el as HTMLElement;
  if (e.classList.contains('no-print') || e.classList.contains('print-only') || e.tagName === 'BUTTON') return '';
  if (e.tagName === 'TEXTAREA' || e.tagName === 'INPUT') return (e as HTMLTextAreaElement).value.split('\n').map((x) => run(x, bold, sz)).join('<w:r><w:br/></w:r>');
  if (e.tagName === 'SELECT') return run((e as HTMLSelectElement).selectedOptions[0]?.text ?? '', bold, sz);
  if (e.tagName === 'BR') return '<w:r><w:br/></w:r>';
  const b = bold || /^(B|STRONG|TH)$/.test(e.tagName);
  // Label + value pairs (<span>Budget</span><b>€1</b>) keep a space between them.
  return [...e.childNodes].map((c) => runs(c, b, sz) + (c.nodeType === 1 && c.nextSibling?.nodeType === 1 && /^(SPAN|SMALL|B|STRONG)$/.test((c as Element).tagName) ? run(' ', false, sz) : '')).join('');
}
const BLOCK = /^(H1|H2|H3|H4|P|UL|OL|TABLE|DIV|SECTION|ARTICLE|HEADER|FOOTER|LI|BLOCKQUOTE|TEXTAREA)$/;

function table(t: HTMLTableElement): string {
  const rows = [...t.rows];
  const n = Math.max(...rows.map((r) => r.cells.length), 1);
  // Column widths follow the longest text of each column (cells spanning columns left out), so amounts do not wrap.
  const len = Array.from({ length: n }, (_, i) => Math.min(42, Math.max(6, ...(rows.filter((r) => r.cells.length === n && r.parentElement?.tagName !== 'THEAD').length ? rows.filter((r) => r.cells.length === n && r.parentElement?.tagName !== 'THEAD') : rows.filter((r) => r.cells.length === n)).map((r) => (r.cells[i]?.textContent ?? '').trim().length + 1))));
  const tot = len.reduce((a, x) => a + x, 0), W = len.map((x) => Math.floor((9600 * x) / tot));
  return `<w:tbl><w:tblPr><w:tblStyle w:val="Grid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="single" w:sz="4" w:color="C9CED6"/>`).join('')}</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${W.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.map((r) => {
    const head = r.parentElement?.tagName === 'THEAD' || r.parentElement?.tagName === 'TFOOT';
    return `<w:tr>${head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${[...r.cells].map((c, k, C) => { const at = C.slice(0, k).reduce((a, x) => a + x.colSpan, 0), cw = W.slice(at, at + c.colSpan).reduce((a, x) => a + x, 0); return `<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/>${c.colSpan > 1 ? `<w:gridSpan w:val="${c.colSpan}"/>` : ''}${head ? '<w:shd w:val="clear" w:color="auto" w:fill="E8EEF6"/>' : ''}</w:tcPr>${para(runs(c, head, 17), undefined, `<w:spacing w:before="20" w:after="20"/>${/\br\b/.test(c.className) ? '<w:jc w:val="right"/>' : ''}`)}</w:tc>`; }).join('')}</w:tr>`;
  }).join('')}</w:tbl>${para('')}`;
}

function blocks(el: HTMLElement): string {
  let out = '', inline = '';
  const flush = () => { if (inline.replace(/<[^>]+>/g, '').trim()) out += para(inline); inline = ''; };
  for (const c of el.childNodes) {
    if (c.nodeType === 1) {
      const e = c as HTMLElement;
      if (e.classList.contains('no-print') || e.classList.contains('print-only')) continue;
      if (BLOCK.test(e.tagName)) {
        flush();
        if (e.tagName === 'TABLE') out += table(e as HTMLTableElement);
        else if (/^H[1-4]$/.test(e.tagName)) out += para(runs(e), e.tagName === 'H1' ? 'Title' : `Heading${+e.tagName[1] - 1}`);
        else if (e.tagName === 'UL' || e.tagName === 'OL') out += [...e.children].map((li, i) => para(run(e.tagName === 'OL' ? `${i + 1}. ` : '• ') + runs(li), undefined, '<w:ind w:left="360" w:hanging="240"/>')).join('');
        else if (e.tagName === 'P' || e.tagName === 'TEXTAREA') out += para(runs(e));
        else if (e.querySelector(':scope > :is(h1,h2,h3,h4,p,ul,ol,table,div,section,header,footer,blockquote,label)')) out += blocks(e);
        else out += para(runs(e));
        continue;
      }
      if (e.tagName === 'LABEL' && e.querySelector('textarea')) { flush(); out += para(runs(e)); continue; }
    }
    inline += runs(c);
  }
  flush();
  return out;
}

/** PNG data URLs (the logos the user added) as bytes with their size; anything else is skipped. */
const pngs = (urls: (string | undefined)[]) => urls.flatMap((u) => { const x = pngData(u); return x ? [{ bytes: x.png, w: x.w, h: x.h }] : []; });
const pic = (i: number, w: number, h: number) => {
  const cy = 540000, cx = Math.min(2400000, Math.round(cy * w / h)), y = Math.round(cx * h / w);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${y}"/><wp:docPr id="${i + 1}" name="Logo ${i + 1}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${i + 1}" name="logo${i + 1}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rLogo${i + 1}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${y}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
};
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';

/** Saves an element (e.g. the report studio document) as an editable Word document; `logos` (PNG data URLs) go in the page header, first left, second right. */
export function downloadDocx(name: string, el: HTMLElement, title: string, logos: (string | undefined)[] = []) {
  const stamp = takeStamp();
  const body = blocks(el), L = pngs(logos);
  const header = L.length ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}><w:p><w:pPr>${L.length === 1 ? '<w:jc w:val="center"/>' : '<w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs>'}</w:pPr>${L.map((x, i) => (i ? '<w:r><w:tab/></w:r>' : '') + pic(i, x.w, x.h)).join('')}</w:p></w:hdr>` : '';
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="1F2937"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="0"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:color="C9CED6"/></w:pBdr></w:pPr><w:rPr><w:b/><w:sz w:val="27"/><w:color w:val="1D4E89"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:i/></w:rPr></w:style>
<w:style w:type="table" w:styleId="Grid"><w:name w:val="Table Grid"/></w:style></w:styles>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr>${header ? '<w:headerReference w:type="default" r:id="rHdr"/>' : ''}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const bytes = zip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>${header ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${header ? '<Relationship Id="rHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : ''}</Relationships>` },
    ...(header ? [{ name: 'word/header1.xml', data: header }, { name: 'word/_rels/header1.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${L.map((_, i) => `<Relationship Id="rLogo${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo${i + 1}.png"/>`).join('')}</Relationships>` }, ...L.map((x, i) => ({ name: `word/media/logo${i + 1}.png`, data: x.bytes }))] : []),
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title>${stamp ? `<dc:description>${esc(stamp)}</dc:description>` : ''}</cp:coreProperties>` },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/document.xml', data: doc },
  ]);
  return saveFile(name, new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
}
