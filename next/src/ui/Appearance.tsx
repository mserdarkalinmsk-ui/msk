import { useState } from 'preact/hooks';
import { setBrand, useStore } from '../data/store';
import { FIELDS, type TemplateInfo } from '../domain/docxTemplate';
import { downloadDocx, readTemplate } from './docxwrite';

/** Visual direction, accent, density and number style — stored per browser, applied as html data-attributes. */
export const PREFS = {
  style: [
    { id: 'studio', label: 'Studio', hint: 'Neutral, precise, monospace figures', side: '#fcfcfb', hero: '#ffffff', card: '#ffffff', bg: '#f5f5f3' },
    { id: 'executive', label: 'Executive', hint: 'Navy chrome, gradient KPI band', side: '#0e1a2b', hero: 'linear-gradient(135deg,#1d3a64,#0e1a2b)', card: '#ffffff', bg: '#f3f5f9' },
    { id: 'atlas', label: 'Atlas', hint: 'Editorial serif, warm paper, hairlines', side: '#f6f1e8', hero: '#fffdf8', card: '#fffdf8', bg: '#efe7d8' },
    { id: 'pop', label: 'Bento', hint: 'Bold accent tile, big numerals, round', side: '#ffffff', hero: 'linear-gradient(135deg,#2a78d6,#8b5cf6)', card: '#ffffff', bg: '#f2f2f6' },
  ],
  accent: [{ id: 'blue', c: '#2a78d6' }, { id: 'teal', c: '#0f8a7e' }, { id: 'violet', c: '#6250d6' }, { id: 'terracotta', c: '#c4562b' }, { id: 'ink', c: '#0b0b0b' }],
} as const;
type Key = 'style' | 'accent' | 'density' | 'numbers';
const get = (k: Key) => { try { return localStorage.getItem('pl-' + k) ?? ''; } catch { return ''; } };
export function applyPrefs() { for (const k of ['style', 'accent', 'density', 'numbers'] as Key[]) { const v = get(k); if (v) document.documentElement.dataset[k] = v; } }
function setPref(k: Key, v: string) {
  try { localStorage.setItem('pl-' + k, v); } catch { /* ignore */ }
  document.documentElement.dataset[k] = v;
  dispatchEvent(new Event('pl-prefs')); // charts re-read tokens
}

export function AppearancePanel({ close }: { close: () => void }) {
  const [, force] = useState(0);
  const cur = (k: Key, d: string) => get(k) || d;
  const pick = (k: Key, v: string) => { setPref(k, v); force((x) => x + 1); };
  return (
    <>
      <div class="drawer-h"><h2>Appearance</h2><button class="btn icon ghost" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={close}>✕</button></div>
      <div class="drawer-b">
        <BrandSection />
        <TemplateSection />
        <section style={{ display: 'grid', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>Design direction</h3>
          <div class="style-grid">
            {PREFS.style.map((s) => (
              <button class="style-opt" aria-pressed={cur('style', 'studio') === s.id} onClick={() => pick('style', s.id)}>
                <div class="thumb" style={{ background: s.bg }}>
                  <i style={{ background: s.side }} />
                  <div class="tb"><i style={{ background: s.hero }} /><div><i style={{ background: s.card }} /><i style={{ background: s.card }} /></div></div>
                </div>
                <b>{s.label}</b><span>{s.hint}</span>
              </button>
            ))}
          </div>
        </section>
        <section style={{ display: 'grid', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>Accent colour</h3>
          <div class="swatches">{PREFS.accent.map((a) => <button class="swatch" aria-label={a.id} aria-pressed={cur('accent', 'blue') === a.id} style={{ background: a.c }} onClick={() => pick('accent', a.id)} />)}</div>
          <p class="muted" style={{ margin: 0, fontSize: '12px' }}>Chart colours stay fixed so series keep their meaning and remain colour-blind safe.</p>
        </section>
        <section style={{ display: 'grid', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>Density</h3>
          <div class="seg"><button aria-pressed={cur('density', 'comfortable') === 'comfortable'} onClick={() => pick('density', 'comfortable')}>Comfortable</button><button aria-pressed={cur('density', 'comfortable') === 'compact'} onClick={() => pick('density', 'compact')}>Compact</button></div>
        </section>
        <section style={{ display: 'grid', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>Figures</h3>
          <div class="seg"><button aria-pressed={cur('numbers', 'mono') === 'mono'} onClick={() => pick('numbers', 'mono')}>Monospace</button><button aria-pressed={cur('numbers', 'mono') === 'sans'} onClick={() => pick('numbers', 'sans')}>Proportional</button></div>
        </section>
      </div>
      <div class="drawer-f"><button class="btn ghost" onClick={() => { for (const k of ['style', 'accent', 'density', 'numbers'] as Key[]) { try { localStorage.removeItem('pl-' + k); } catch { /* */ } delete document.documentElement.dataset[k]; } dispatchEvent(new Event('pl-prefs')); force((x) => x + 1); }}>Reset to default</button><span style={{ flex: 1 }} /><button class="btn primary" onClick={close}>Done</button></div>
    </>
  );
}

/** The user's own Word file as the layout of letters: its header, footer, fonts and margins are kept. */
function TemplateSection() {
  const brand = useStore((s) => s.ledger.brand), t = brand?.docx;
  const [err, setErr] = useState(''), [info, setInfo] = useState<TemplateInfo | null>(null), [help, setHelp] = useState(false);
  const pick = async (f?: File) => {
    if (!f) return; setErr('');
    try { const r = await readTemplate(f); setInfo(r.info); setBrand({ ...(brand ?? {}), docx: { name: f.name, at: new Date().toISOString(), data: r.data, use: t?.use ?? 'letters' } }); }
    catch (e) { setErr((e as Error).message); }
  };
  const test = () => {
    const d = document.createElement('div');
    d.innerHTML = '<h1>Template test</h1><p>This is where the text of a letter goes. The header, footer, fonts and margins of this page come from your Word file.</p><h2>A heading</h2><p>Tables are written like this one:</p><table><thead><tr><th>Column</th><th>Amount (EUR)</th></tr></thead><tbody><tr><td>First row</td><td class="r">0.00</td></tr><tr><td>Second row</td><td class="r">0.00</td></tr></tbody></table>';
    void downloadDocx('template-test.docx', d, 'Template test', [], { letter: true, vars: { project: '{{project}}', code: '{{code}}', bh: '{{bh}}', agreement: '{{agreement}}' } });
  };
  return (
    <section class="tp">
      <h3>Word template</h3>
      <p class="muted">Use your own Word file as the layout of the letters the app drafts: its header and footer (logos, addresses), fonts and margins are kept, and the text is written into it.</p>
      {t ? <div class="tp-file">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13l1.2 4L12 13l1.8 4L15 13" /></svg>
        <div><b>{t.name}</b><span>added {new Date(t.at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}{info ? ` · ${info.content ? 'text goes where {{content}} stands' : 'text goes after the file’s own text'}${info.fields.length ? ` · fields: ${info.fields.join(', ')}` : ''}` : ''}</span></div>
        <button class="btn ghost danger" onClick={() => { setInfo(null); setBrand({ ...brand, docx: undefined }); }}>Remove</button>
      </div> : null}
      <div class="tp-act">
        <label class="btn">{t ? 'Replace the file…' : 'Choose a Word file…'}<input type="file" accept=".docx,.dotx" hidden onChange={(e) => { const i = e.target as HTMLInputElement; void pick(i.files?.[0]); i.value = ''; }} /></label>
        {t && <button class="btn" onClick={test}>Download a test page</button>}
        <button class="btn ghost" aria-expanded={help} onClick={() => setHelp(!help)}>{help ? 'Hide the fields' : 'Fields you can use'}</button>
      </div>
      {t && <div class="field"><label>Use it for</label>
        <div class="seg"><button aria-pressed={t.use === 'letters'} onClick={() => setBrand({ ...brand, docx: { ...t, use: 'letters' } })}>Letters and requests</button><button aria-pressed={t.use === 'all'} onClick={() => setBrand({ ...brand, docx: { ...t, use: 'all' } })}>Every Word document</button></div>
        <span class="muted" style={{ fontSize: '12px' }}>{t.use === 'letters' ? 'Notification and addendum letters, staff PO and budget transfer requests. Reports and summaries keep the standard layout.' : 'Also the monthly summary, Work Plan follow-up, revision note and the project report.'}</span></div>}
      {help && <div class="tp-help">
        <p>Type a field in your Word file, in curly brackets, wherever its value should appear — in the text, the header or the footer:</p>
        <dl>{FIELDS.map(([k, d]) => <><dt><code>{`{{${k}}}`}</code></dt><dd>{d}</dd></>)}</dl>
        <p>Without <code>{'{{content}}'}</code> the text is written after whatever your file already contains. A field keeps the font and size it is typed in.</p>
      </div>}
      {err && <p class="badge warning" style={{ margin: 0, whiteSpace: 'normal' }}>{err}</p>}
    </section>
  );
}

/** Reads an image and returns it as a PNG data URL no wider than 480 px (keeps the saved data small). */
export async function shrink(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 480 / img.naturalWidth), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

function BrandSection() {
  const brand = useStore((s) => s.ledger.brand);
  const [err, setErr] = useState('');
  const [url, setUrl] = useState('');
  // A link is read once and kept inside the data (works offline); when the site does not allow that, the link itself is kept.
  const pickUrl = async () => {
    const u = url.trim(); if (!/^https?:\/\//i.test(u)) return setErr('Paste a link starting with https://');
    setErr('');
    try { const r = await fetch(u); if (!r.ok) throw new Error(); const blob = await r.blob(); setBrand({ ...(brand ?? {}), logo: await shrink(new File([blob], 'logo', { type: blob.type || 'image/png' })) }); }
    catch { setBrand({ ...(brand ?? {}), logo: u }); setErr('The site does not allow copying the image, so the link is used: the logo shows when online, and not in PowerPoint. For offline use, download the image and choose it as a file.'); }
    setUrl('');
  };
  const pickFile = async (f?: File) => { if (!f) return; if (!/^image\//.test(f.type)) return setErr('Choose an image (PNG, JPG or SVG)'); setErr(''); setBrand({ ...(brand ?? {}), logo: await shrink(f) }); };
  return (
    <section style={{ display: 'grid', gap: '10px' }}>
      <h3 style={{ margin: 0, fontSize: '14px' }}>Name and logo</h3>
      <p class="muted" style={{ margin: 0, fontSize: '12.5px' }}>Shown at the top of the menu, in the browser tab and on the presentation cover. It is saved with your data (backups and shared copies include it).</p>
      <div class="brand-pick">
        <div class="brand-prev">{brand?.logo ? <img src={brand.logo} alt="Logo" /> : <span class="muted">No logo</span>}</div>
        <div style={{ display: 'grid', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '6px' }}><input class="input" style={{ minWidth: '220px' }} placeholder="or paste an image link (https://…)" value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && pickUrl()} /><button class="btn" disabled={!url.trim()} onClick={pickUrl}>Use link</button></div>
          <label class="btn">Choose image…<input type="file" accept="image/*" hidden onChange={(e) => pickFile((e.target as HTMLInputElement).files?.[0])} /></label>
          {brand?.logo && <button class="btn ghost" onClick={() => setBrand({ ...brand, logo: undefined })}>Remove logo</button>}
        </div>
      </div>
      <div class="field"><label for="brand-t">Application name</label><input id="brand-t" value={brand?.title ?? ''} placeholder="Portfolio Ledger" onChange={(e) => { const v = (e.target as HTMLInputElement).value.trim(); setBrand({ ...(brand ?? {}), title: v || undefined }); }} /></div>
      <div class="field"><label for="brand-n">Organisation name (optional)</label><input id="brand-n" value={brand?.name ?? ''} placeholder="e.g. Programme Office in Ankara" onChange={(e) => { const v = (e.target as HTMLInputElement).value.trim(); setBrand({ ...(brand ?? {}), name: v || undefined }); }} /></div>
      {err && <p class="badge warning" style={{ margin: 0 }}>{err}</p>}
    </section>
  );
}
