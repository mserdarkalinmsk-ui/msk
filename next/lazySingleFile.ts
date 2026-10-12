import { gzipSync } from 'zlib';
import type { Plugin } from 'vite';

/**
 * One self-contained HTML file. The app's own code is inlined as usual; every lazily imported chunk (PDF reader,
 * PowerPoint writer, charts) is stored gzip-compressed in an inert <script type="application/gzip"> and only
 * decompressed and run the first time it is needed — the browser does not parse it on opening.
 */
const LOADER = `const __lzp={},__lzr={};window.__lzDone=(n,m)=>{document.querySelector('script[data-lz="'+n+'"]')?.remove();__lzr[n](m)};
function __lz(n){return __lzp[n]??=new Promise(async(res,rej)=>{try{__lzr[n]=res;const b=Uint8Array.from(atob(document.getElementById("lz:"+n).textContent.trim()),c=>c.charCodeAt(0));const t=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();const s=document.createElement("script");s.type="module";s.dataset.lz=n;s.textContent=t;s.onerror=rej;document.head.appendChild(s)}catch(e){rej(e)}})}
`;

export function lazySingleFile(): Plugin {
  return {
    name: 'lazy-single-file',
    enforce: 'post',
    config: () => ({ base: './', build: { assetsInlineLimit: () => true, cssCodeSplit: false, modulePreload: false } }),
    generateBundle(_, bundle) {
      const html = bundle['index.html'] as { source: string } | undefined; if (!html) return;
      const chunks = Object.values(bundle).filter((b): b is Extract<typeof b, { type: 'chunk' }> => b.type === 'chunk');
      const entry = chunks.find((c) => c.isEntry)!, lazy = chunks.filter((c) => !c.isEntry);
      const name = (f: string) => f.replace(/^assets\//, '');
      let code = entry.code;
      const data: string[] = [];
      for (const c of lazy) {
        const n = name(c.fileName);
        let body = c.code;
        const m = body.match(/export\s*\{([^}]*)\}\s*;?\s*$/);
        if (!m) throw new Error(`lazy-single-file: no export list at the end of ${n}`);
        const obj = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [a, b] = s.split(/\s+as\s+/); return `${JSON.stringify(b ?? a)}:${a}`; }).join(',');
        body = body.slice(0, m.index) + `window.__lzDone(${JSON.stringify(n)},{${obj}});`;
        if (/\bimport\s*\(?\s*["']\.\//.test(body) || /^import\s/m.test(body)) throw new Error(`lazy-single-file: ${n} imports other chunks`);
        data.push(`<script type="application/gzip" id="lz:${n}">${gzipSync(body, { level: 9 }).toString('base64')}</script>`);
        code = code.split(`import("./${n}")`).join(`__lz(${JSON.stringify(n)})`).split(`import('./${n}')`).join(`__lz(${JSON.stringify(n)})`);
        delete bundle[c.fileName];
      }
      if (/import\(\s*["']\.\//.test(code)) throw new Error('lazy-single-file: an import() was not rewritten');
      code = LOADER + code.split("__VITE_PRELOAD__").join("void 0");
      let src = html.source;
      src = src.replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, () => `<script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>`);
      for (const a of Object.values(bundle)) if (a.type === 'asset' && a.fileName.endsWith('.css')) {
        src = src.replace(new RegExp(`<link rel="stylesheet" crossorigin href="[^"]*${name(a.fileName).replace('.', '\\.')}">`), () => `<style>${a.source}</style>`);
        delete bundle[a.fileName];
      }
      src = src.replace('</body>', () => `${data.join('\n')}\n</body>`);
      html.source = src;
      delete bundle[entry.fileName];
    },
  };
}
