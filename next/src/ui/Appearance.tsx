import { useState } from 'preact/hooks';

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
