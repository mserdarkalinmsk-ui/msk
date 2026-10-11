import { useEffect, useMemo, useState } from 'preact/hooks';
import { get, go, set, setTheme, undo, useStore } from '../data/store';
import { ROUTES } from './Shell';

interface Cmd { group: string; label: string; hint?: string; run: () => void }

export function Palette() {
  const open = useStore((s) => s.palette);
  const projects = useStore((s) => s.ledger.projects);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); set({ palette: !get().palette }); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement).closest('input,textarea,select')) { e.preventDefault(); undo(); }
      else if (e.key === 'Escape') set({ palette: false });
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  useEffect(() => { setQ(''); setI(0); }, [open]);

  const cmds: Cmd[] = useMemo(() => [
    { group: 'Actions', label: 'Add project', hint: 'N', run: () => set({ drawer: { kind: 'new-project' } }) },
    { group: 'Actions', label: 'Add country', run: () => set({ drawer: { kind: 'countries', edit: 'new' } }) },
    { group: 'Actions', label: 'Manage countries', run: () => set({ drawer: { kind: 'countries' } }) },
    { group: 'Actions', label: 'Import Excel, CSV or backup', run: () => set({ drawer: { kind: 'import' } }) },
    { group: 'Actions', label: 'Undo last change', hint: 'Ctrl Z', run: undo },
    { group: 'Actions', label: 'Theme: light', run: () => setTheme('light') },
    { group: 'Actions', label: 'Theme: dark', run: () => setTheme('dark') },
    { group: 'Actions', label: 'Theme: follow system', run: () => setTheme('auto') },
    ...ROUTES.map((r) => ({ group: 'Go to', label: r.label, run: () => go(r.id) })),
    ...projects.map((p) => ({ group: 'Projects', label: `${p.code} — ${p.name}`, run: () => go(`project/${p.id}`) })),
    ...projects.map((p) => ({ group: 'Import report', label: `Import report for ${p.code}`, run: () => set({ drawer: { kind: 'report', projectId: p.id } }) })),
  ], [projects]);

  const qq = q.trim().toLowerCase();
  const list = qq ? cmds.filter((c) => qq.split(/\s+/).every((w) => c.label.toLowerCase().includes(w))) : cmds;
  if (!open) return null;
  const run = (c?: Cmd) => { if (!c) return; set({ palette: false }); c.run(); };
  let lastGroup = '';
  return (
    <>
      <div class="scrim" style={{ zIndex: 50 }} onClick={() => set({ palette: false })} />
      <div class="palette" role="dialog" aria-label="Command palette">
        <input autoFocus placeholder="Type a command or project…" value={q} role="combobox" aria-expanded="true" aria-controls="pal-list"
          onInput={(e) => { setQ((e.target as HTMLInputElement).value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(list.length - 1, x + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            if (e.key === 'Enter') run(list[i]);
          }} />
        <ul id="pal-list" role="listbox">
          {list.map((c, k) => {
            const head = c.group !== lastGroup ? <div class="grp">{c.group}</div> : null; lastGroup = c.group;
            return (<>{head}<li role="option" aria-selected={k === i} onMouseEnter={() => setI(k)} onClick={() => run(c)}>{c.label}{c.hint && <span class="k">{c.hint}</span>}</li></>);
          })}
          {!list.length && <li class="muted">Nothing matches “{q}”</li>}
        </ul>
      </div>
    </>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div class="toast">{t.text}{t.undo && <button onClick={() => { set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })); t.undo!(); }}>Undo</button>}</div>
      ))}
    </div>
  );
}
