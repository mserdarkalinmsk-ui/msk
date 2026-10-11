/**
 * Minimal .xlsx reader: unzips with the platform DecompressionStream and reads
 * the first (or named) worksheet as a grid of strings. Handles shared strings,
 * inline strings, numbers, booleans, and sparse cells.
 */
const td = new TextDecoder();

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const out = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const b = new Uint8Array(buf), v = new DataView(buf);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a valid .xlsx (zip) file');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupt zip directory');
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = td.decode(b.subarray(p + 46, p + 46 + nlen));
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = b.subarray(start, start + csize);
    if (/\.(xml|rels)$/.test(name)) files.set(name, method === 8 ? await inflate(raw) : method === 0 ? raw : new Uint8Array());
    p += 46 + nlen + xlen + clen;
  }
  return files;
}

const unesc = (s: string) => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()]);
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g)].map((m) => unesc(m[1] ?? '')).join('');

function colIndex(ref: string) { let n = 0; for (const c of ref.replace(/\d+$/, '')) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; }

export interface Workbook { sheets: string[]; read: (name?: string) => string[][] }

export async function readXlsx(buf: ArrayBuffer): Promise<Workbook> {
  const F = await unzip(buf);
  const get = (n: string) => (F.has(n) ? td.decode(F.get(n)) : '');
  const shared = [...get('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const wb = get('xl/workbook.xml'), rels = get('xl/_rels/workbook.xml.rels');
  if (!wb) throw new Error('No workbook found in file');
  const sheets = [...wb.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    name: unesc(m[0].match(/name="([^"]*)"/)?.[1] ?? ''),
    rid: m[0].match(/r:id="([^"]*)"/)?.[1] ?? '',
  }));
  const target = (rid: string) => {
    const t = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*>`))?.[0].match(/Target="([^"]*)"/)?.[1] ?? '';
    return t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
  };
  return {
    sheets: sheets.map((s) => s.name),
    read(name) {
      const s = sheets.find((x) => x.name === name) ?? sheets[0];
      if (!s) return [];
      const xml = get(target(s.rid));
      const rows: string[][] = [];
      for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
        const ri = +(r[0].match(/\br="(\d+)"/)?.[1] ?? rows.length + 1) - 1;
        const row: string[] = [];
        for (const c of (r[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const attrs = c[1], body = c[2] ?? '';
          const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
          const ci = ref ? colIndex(ref) : row.length;
          const t = attrs.match(/\bt="(\w+)"/)?.[1];
          const val = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
          let out = '';
          if (t === 's') out = shared[+val!] ?? '';
          else if (t === 'inlineStr') out = texts(body);
          else if (t === 'b') out = val === '1' ? 'TRUE' : 'FALSE';
          else if (val != null) out = unesc(val);
          row[ci] = out;
        }
        rows[ri] = Array.from(row, (x) => x ?? '');
      }
      return Array.from(rows, (x) => x ?? []).filter((r) => r.some((x) => x.trim()));
    },
  };
}

/** Excel serial date (1900 system) → YYYY-MM-DD. */
export const excelDate = (n: number) => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000).toISOString().slice(0, 10);
