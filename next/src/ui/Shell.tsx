import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { get, go, set, setTheme, useStore } from '../data/store';
import { attention } from '../domain/calc';
import { TODAY } from '../today';

export const ROUTES = [
  { id: 'overview', label: 'Overview', icon: 'M3 12h4l3-8 4 16 3-8h4', ready: true },
  { id: 'projects', label: 'Projects', icon: 'M4 6h16M4 12h16M4 18h10', ready: true },
  { id: 'budget', label: 'Budget', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2', ready: true },
  { id: 'people', label: 'People', icon: 'M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', ready: true },
  { id: 'map', label: 'Map', icon: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14', ready: true },
  { id: 'reports', label: 'Reports', icon: 'M6 3h9l4 4v14H6zM14 3v5h5', ready: true },
];

export const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export function Shell({ title, crumb, actions, children }: { title: string; crumb?: ComponentChildren; actions?: ComponentChildren; children: ComponentChildren }) {
  const route = useStore((s) => s.route);
  const theme = useStore((s) => s.theme);
  const ledger = useStore((s) => s.ledger);
  const [open, setOpen] = useState(false);
  const flags = attention(ledger.projects, TODAY).filter((f) => f.severity !== 'warning').length;
  const nextTheme = theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto';
  return (
    <div class="shell">
      <aside class={`side ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div class="brand"><i>PL</i>Portfolio Ledger</div>
        <nav class="nav">
          {ROUTES.map((r) => (
            <a href={`#/${r.id}`} aria-current={route === r.id || (r.id === 'projects' && route.startsWith('project/')) ? 'page' : undefined} class={r.ready ? '' : 'soon'} onClick={() => setOpen(false)}>
              <Icon d={r.icon} />{r.label}
              {r.id === 'overview' && flags > 0 && <span class="badge serious count">{flags}</span>}

            </a>
          ))}
        </nav>
        <div class="side-foot">
          <button class="btn ghost" onClick={() => set({ drawer: { kind: 'import' } })}><Icon d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />Import / backup</button>
          <button class="btn ghost" onClick={() => setTheme(nextTheme)} aria-label="Change theme">
            <Icon d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />Theme: {theme}
          </button>
        </div>
      </aside>
      {open && <div class="scrim" style={{ zIndex: 19 }} onClick={() => setOpen(false)} />}
      <div class="side-spacer" />
      <div class="main">
        <header class="top">
          <button class="btn icon ghost menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Icon d="M4 6h16M4 12h16M4 18h16" /></button>
          {crumb}<h1>{title}</h1>
          <span class="grow" />
          <button class="search hide-sm" onClick={() => set({ palette: true })}>
            <Icon d="m21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" /><span>Search or run a command</span><kbd>Ctrl K</kbd>
          </button>
          {actions}
        </header>
        <main class="page" id="content">{children}</main>
      </div>
    </div>
  );
}

export function Placeholder({ id }: { id: string }) {
  const r = ROUTES.find((x) => x.id === id);
  return (
    <div class="card empty-page">
      <div>
        <h2>{r?.label ?? 'Not found'}</h2>
        <p>This workspace is part of the next build phase.</p>
        <button class="btn" onClick={() => go('overview')}>Back to overview</button>
      </div>
    </div>
  );
}
void get;
