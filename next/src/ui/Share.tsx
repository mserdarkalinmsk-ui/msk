import { useState } from 'preact/hooks';
import { EMBED, READONLY, SOURCE, useStore } from '../data/store';
import type { Ledger } from '../domain/types';
import { saveFile } from './save';

/** Writes the app out as one HTML file with (part of) the ledger inside, so a colleague sees the data offline. */
export function shareHtml(ledger: Ledger, mode: 'view' | 'edit', scope: string, from?: string) {
  const embed = { id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString(), mode, from, scope, ledger };
  // `<` escaped so report text can never close the script tag early.
  const tag = `<script id="pl-embed" type="application/json">${JSON.stringify(embed).replace(/</g, '\\u003c')}</script>`;
  // Placed just before the app's own script (first occurrence: the bundle itself only comes after it).
  const base = SOURCE, i = base.indexOf('<script type="module"');
  return i < 0 ? base.replace('</head>', `${tag}</head>`) : base.slice(0, i) + tag + base.slice(i);
}

export function SharePanel({ close }: { close: () => void }) {
  const L = useStore((s) => s.ledger);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [selC, setSelC] = useState<string[]>([]), [selP, setSelP] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [hist, setHist] = useState(false);
  const tog = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
  const used = L.countries.filter((c) => L.projects.some((p) => p.country === c.id));
  const inC = L.projects.filter((p) => !selC.length || selC.includes(p.country));
  const P = inC.filter((p) => !selP.length || selP.includes(p.id));
  const reports = P.reduce((s, p) => s + (p.reportingPeriods?.length ?? 0), 0);
  const scope = selP.length ? `${P.length} selected projects` : selC.length ? used.filter((c) => selC.includes(c.id)).map((c) => c.name).join(', ') : 'Whole portfolio';
  const make = async () => {
    const sub: Ledger = { ...L, projects: P, countries: L.countries.filter((c) => P.some((p) => p.country === c.id)), audit: hist ? (L.audit ?? []).filter((a) => !a.project || P.some((p) => p.code === a.project)) : [] };
    const html = shareHtml(sub, mode, scope, from.trim() || undefined);
    const name = `portfolio-ledger-${mode === 'view' ? 'view' : 'copy'}-${new Date().toISOString().slice(0, 10)}.html`;
    await saveFile(name, new Blob([html], { type: 'text/html' }));
  };
  const size = Math.round(JSON.stringify(P).length / 1024);
  return (
    <>
      <div class="drawer-h"><h2>Share a copy with data</h2><button class="btn ghost" aria-label="Close" onClick={close}>✕</button></div>
      <div class="drawer-b" style={{ display: 'grid', gap: '16px' }}>
        <p class="muted" style={{ margin: 0 }}>Your data lives only in this browser, so a link opens empty for others. This saves <b>one HTML file with the data inside</b>: send it by e-mail or a shared drive; it opens offline in any browser. Nothing is uploaded anywhere.</p>
        {READONLY && <p class="badge warning" style={{ margin: 0 }}>You are viewing a shared copy — what you share is the data in it.</p>}
        <section class="card card-b" style={{ display: 'grid', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>What to include</h3>
          <div class="cm-chips"><span class="muted">Countries</span>{used.map((c) => <button class="chip" aria-pressed={selC.includes(c.id)} onClick={() => { setSelC(tog(selC, c.id)); setSelP([]); }}>{c.name}</button>)}</div>
          <div class="cm-chips"><span class="muted">Projects</span>{inC.map((p) => <button class="chip" aria-pressed={selP.includes(p.id)} onClick={() => setSelP(tog(selP, p.id))}>{p.bh ? `BH ${p.bh}` : p.code}</button>)}</div>
          <p class="muted" style={{ margin: 0, fontSize: '12.5px' }}><b>{scope}</b> · {P.length} projects · {reports} reports · ~{size < 1024 ? `${size} KB` : `${(size / 1024).toFixed(1)} MB`} of data. Nothing selected = everything.</p>
          <label style={{ fontSize: '13px' }}><input type="checkbox" checked={hist} onChange={() => setHist(!hist)} /> Include the change history</label>
        </section>
        <section class="card card-b" style={{ display: 'grid', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>How the recipient can use it</h3>
          <label class="sh-opt"><input type="radio" name="sh-m" checked={mode === 'view'} onChange={() => setMode('view')} /><span><b>View only</b> (recommended)<br /><small class="muted">All screens, reports, Excel/PDF exports — but no edits. Always shows exactly the data you sent.</small></span></label>
          <label class="sh-opt"><input type="radio" name="sh-m" checked={mode === 'edit'} onChange={() => setMode('edit')} /><span><b>Editable copy</b><br /><small class="muted">The recipient can import reports and change data. Their changes stay in their browser and never come back to you; it is kept separate from any ledger of their own.</small></span></label>
          <div class="field"><label for="sh-from">Shared by (shown on the banner)</label><input id="sh-from" value={from} placeholder="e.g. Serdar · Programme Office" onInput={(e) => setFrom((e.target as HTMLInputElement).value)} /></div>
        </section>
        <p class="muted" style={{ margin: 0, fontSize: '12.5px' }}>⚠ The file contains financial data: share it only through channels approved for it.</p>
      </div>
      <div class="drawer-f"><button class="btn" onClick={close}>Cancel</button><button class="btn primary" disabled={!P.length} onClick={make}>⤓ Save shareable file</button></div>
    </>
  );
}

/** Top banner inside a shared copy: whose data, as of when, and whether it can be edited. */
export function SharedBanner() {
  if (!EMBED) return null;
  const d = new Date(EMBED.at);
  return (
    <div class="bk-banner sh-banner no-print" role="status">
      <span class="bk-i">⇪</span>
      <span><b>Shared copy</b>{EMBED.from ? ` from ${EMBED.from}` : ''} · {EMBED.scope} · data as of {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        {' · '}{READONLY ? 'view only' : 'editable copy — your changes stay in this browser'}</span>
    </div>
  );
}
