import { unzip, readXlsx } from './xlsx';
import { notesFromLayout, type BudgetNote, type Doc, type Geometry, type NoteColumns } from '../domain/documents';
import * as geoModule from './pdfgeom';
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped port of the previous app's layout readers
const geo = geoModule as any;

const td = new TextDecoder();
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
const runs = (xml: string) => unesc([...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)].map((m) => m[1] ?? ' ').join(''));

/** .docx → paragraphs (outside tables) + tables (cell text). */
export async function readDocx(buf: ArrayBuffer, name: string): Promise<Doc> {
  const F = await unzip(buf);
  const xml = F.get('word/document.xml'); if (!xml) throw new Error('Not a Word document');
  let body = td.decode(xml);
  const tables: string[][][] = [];
  // innermost-first table extraction keeps nested tables from swallowing rows
  for (let guard = 0; guard < 500; guard++) {
    const m = body.match(/<w:tbl>(?:(?!<w:tbl>)[\s\S])*?<\/w:tbl>/); if (!m) break;
    tables.push([...m[0].matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map((tr) => [...tr[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((tc) => runs(tc[0]).trim())));
    body = body.replace(m[0], '');
  }
  const paragraphs = [...body.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map((p) => runs(p[0]).trim()).filter(Boolean);
  return { name, kind: 'docx', paragraphs, tables };
}

/** PDF → lines; text items on one baseline are split into cells by large horizontal gaps. */
export async function readPdf(buf: ArrayBuffer, name: string): Promise<Doc> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  await import('pdfjs-dist/legacy/build/pdf.worker.mjs'); // runs the parser on the main thread (no separate worker file offline)
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: false }).promise;
  const paragraphs: string[] = [], tables: string[][][] = [];
  let table: string[][] = [];
  const G: Geometry = { acts: [], months: 0, indicators: [], risks: [] };
  const layouts: unknown[] = []; let template: unknown = null;
  const notes: Record<string, BudgetNote> = {}; let noteCols: NoteColumns | undefined;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    const pos = (tc.items as { str: string; transform: number[]; width: number; height: number }[]).map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height || Math.abs(i.transform[3]) }));
    const jn = notesFromLayout(pos, noteCols); Object.assign(notes, jn.notes); noteCols = jn.cols;
    // Layout readers from the previous app (need a canvas; skipped where none exists, e.g. in unit tests)
    if (typeof document !== 'undefined') try {
      const items = tc.items as unknown[];
      const layout = geo.pdfDisplayLayout(page, items); layout.page = n; layouts.push(layout);
      const text = paragraphs.join(' ') + ' ' + tables.flat(2).join(' ');
      const expected = +((text.match(/(?:proposed\s+)?duration\s+of\s+(?:the\s+)?(?:project|action)[\s:]*?(\d{1,3})\s*months/i) || [])[1] || 0);
      let plan = await geo.pdfPlanGeometry(page, items, n);
      if (!plan && layout.items.length) plan = await geo.pdfCalendarPlan(page, layout, n, template, expected);
      if (plan) {
        if (plan.template) { template = plan.template; G.start = plan.start; }
        if (plan.continuation && G.acts.length) { const prev = G.acts.at(-1)!; prev.name += ' ' + plan.continuation; prev.E = [...new Set([...(prev.E ?? []), ...plan.continuationMonths])].sort((a, b) => a - b); }
        G.acts.push(...plan.acts); G.months = Math.max(G.months, plan.months);
      }
      const lf = geo.pdfLogframeGeometry(items, n); G.indicators.push(...lf);
      const prevL = layouts.at(-2) as { logframeGrid?: unknown } | undefined;
      if (!lf.length && (layout.width > layout.height || prevL?.logframeGrid || layout.items.some((i: { str: string }) => /^(?:Intervention logic|Indicators|Indicatoes|Logframe level)$/i.test(i.str)))) layout.logframeGrid = await geo.pdfLogframeGrid(page, layout);
    } catch { /* layout reading is best effort; the text tables below still apply */ }
    const rows = new Map<number, { x: number; w: number; s: string }[]>();
    for (const it of tc.items as { str: string; transform: number[]; width: number }[]) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      rows.set(y, [...(rows.get(y) ?? []), { x: it.transform[4], w: it.width, s: it.str }]);
    }
    for (const [, items] of [...rows].sort((a, b) => b[0] - a[0])) {
      items.sort((a, b) => a.x - b.x);
      const cells: string[] = []; let end = -1e9;
      for (const it of items) { if (it.x - end > 14 || !cells.length) cells.push(it.s); else cells[cells.length - 1] += (it.x - end > 1.5 ? ' ' : '') + it.s; end = it.x + it.w; }
      if (cells.length > 1) table.push(cells.map((c) => c.trim()));
      else { if (table.length) tables.push(table); table = []; paragraphs.push(cells[0].trim()); }
    }
  }
  if (table.length) tables.push(table);
  if (layouts.length) try { G.indicators.push(...geo.pdfAnnexIndicators(layouts)); G.risks.push(...geo.pdfAnnexRisks(layouts)); } catch { /* best effort */ }
  await doc.destroy();
  return { name, kind: 'pdf', paragraphs, tables, ...(Object.keys(notes).length ? { notes } : {}), ...(G.acts.length || G.indicators.length || G.risks.length ? { geometry: G } : {}) };
}

export async function readDocument(f: File): Promise<Doc> {
  const buf = await f.arrayBuffer();
  if (/\.pdf$/i.test(f.name)) return readPdf(buf, f.name);
  if (/\.docx$/i.test(f.name)) return readDocx(buf, f.name);
  if (/\.xlsx$/i.test(f.name)) { const wb = await readXlsx(buf); return { name: f.name, kind: 'xlsx', paragraphs: [], tables: wb.sheets.map((s) => wb.read(s)) }; }
  if (/\.(doc|xls)$/i.test(f.name)) throw new Error(`${f.name}: old Office format — save as .docx / .xlsx`);
  return { name: f.name, kind: 'text', paragraphs: (await f.text()).split(/\r?\n/).filter(Boolean), tables: [] };
}
