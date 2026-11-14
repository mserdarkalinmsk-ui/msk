import { BackupBanner, FreshStart } from './Backup';
import { SharedBanner } from './Share';
import { READONLY } from '../data/store';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { get, go, set, setTheme, useStore } from '../data/store';
import { attention } from '../domain/calc';
import { TODAY } from '../today';

export const ROUTES = [
  { id: 'overview', label: 'Overview', icon: 'M3 12h4l3-8 4 16 3-8h4', ready: true },
  { id: 'projects', label: 'Projects', icon: 'M4 6h16M4 12h16M4 18h10', ready: true },
  { id: 'budget', label: 'Budget', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2', ready: true },
  { id: 'people', label: 'Staff', icon: 'M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', ready: true },
  { id: 'offices', label: 'Offices', icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4', ready: true },
  { id: 'map', label: 'Map', icon: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14', ready: true },
  { id: 'reports', label: 'Reports', icon: 'M6 3h9l4 4v14H6zM14 3v5h5', ready: true },
  { id: 'guide', label: 'Guide', icon: 'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 21V5M9 7h6M9 11h6', ready: true },
];

export const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={d} /></svg>
);

/** Two letters for the badge when no logo is set: the first letters of the first two words (Portfolio Ledger → PL, CoE Portfolio → CP). */
const initials = (t: string) => (t.match(/[A-Za-zÀ-ž0-9]+/g) ?? ['P']).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export function Shell({ title, crumb, actions, children }: { title: string; crumb?: ComponentChildren; actions?: ComponentChildren; children: ComponentChildren }) {
  const route = useStore((s) => s.route);
  const theme = useStore((s) => s.theme);
  const ledger = useStore((s) => s.ledger);
  const [open, setOpen] = useState(false);
  const appTitle = ledger.brand?.title || 'Portfolio Ledger';
  useEffect(() => { document.title = appTitle; }, [appTitle]);
  // The browser tab shows the organisation's logo when one is set.
  const logo = ledger.brand?.logo;
  useEffect(() => { let l = document.querySelector<HTMLLinkElement>('link[rel="icon"]'); if (!logo) { l?.remove(); return; } if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); } l.href = logo; }, [logo]);
  // Wide screens: the button hides / shows the sidebar (room for wide tables); narrow screens: it opens the menu.
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('pl-side') === 'hidden'; } catch { return false; } });
  const menu = () => {
    if (matchMedia('(max-width: 900px)').matches) return setOpen(true);
    const h = !hidden; setHidden(h); try { localStorage.setItem('pl-side', h ? 'hidden' : 'shown'); } catch { /* ignore */ }
  };
  const flags = attention(ledger.projects, TODAY).filter((f) => f.severity !== 'warning').length;
  const nextTheme = theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto';
  return (
    <div class={`shell${hidden ? ' side-hidden' : ''}`}>
      <aside class={`side ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div class="brand">{ledger.brand?.logo ? <img class="brand-logo" src={ledger.brand.logo} alt={ledger.brand.name ?? "Logo"} /> : <i>{initials(appTitle)}</i>}<span>{ledger.brand?.title || 'Portfolio Ledger'}{ledger.brand?.name && <small class="brand-org">{ledger.brand.name}</small>}</span></div>
        <nav class="nav">
          {ROUTES.map((r) => (
            <a href={`#/${r.id}`} aria-current={route === r.id || (r.id === 'projects' && route.startsWith('project/')) ? 'page' : undefined} class={r.ready ? '' : 'soon'} onClick={() => setOpen(false)}>
              <Icon d={r.icon} />{r.label}
              {r.id === 'overview' && flags > 0 && <span class="badge serious count">{flags}</span>}

            </a>
          ))}
        </nav>
        <div class="side-foot">
          <small class="muted build" title="Version of this app — compare when something seems missing">Build {__BUILD__} UTC</small>
          <button class="btn ghost" onClick={() => set({ drawer: { kind: 'import' } })}><Icon d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />Import / backup</button>
          <button class="btn ghost" onClick={() => set({ drawer: { kind: 'share' } })}><Icon d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />Share a copy</button>
          <button class="btn ghost" onClick={() => set({ drawer: { kind: 'appearance' } })}><Icon d="M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 9.8C22 6 17.5 3 12 3zM7 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm3-4a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm5 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />Appearance</button>
          <button class="btn ghost" onClick={() => setTheme(nextTheme)} aria-label="Change theme">
            <Icon d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />Theme: {theme}
          </button>
        </div>
      </aside>
      {open && <div class="scrim" style={{ zIndex: 19 }} onClick={() => setOpen(false)} />}
      <div class="side-spacer" />
      <div class="main">
        <header class="top">
          <button class="btn icon ghost menu-btn" aria-label={hidden ? 'Show menu' : 'Menu'} title={hidden ? 'Show the menu' : 'Hide the menu (more room)'} onClick={menu}><Icon d="M4 6h16M4 12h16M4 18h16" /></button>
          {crumb}<h1>{title}</h1>
          <span class="grow" />
          <button class="search hide-sm" onClick={() => set({ palette: true })}>
            <Icon d="m21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" /><span>Search or run a command</span><kbd>Ctrl K</kbd>
          </button>
          {actions}
        </header>
        <main class="page" id="content"><OldCopyBanner /><SharedBanner />{!READONLY && <><FreshStart /><BackupBanner /></>}{children}</main>
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

/**
 * Warns when an older copy of the app is opened in a browser where a newer one has already been used: both read
 * the same saved data, and an old copy may not show (or may overwrite) what the newer one stored.
 */
function OldCopyBanner() {
  const [newest] = useState(() => { try { const k = 'pl-newest-build', seen = localStorage.getItem(k) ?? ''; if (__BUILD__ > seen) { localStorage.setItem(k, __BUILD__); return ''; } return seen > __BUILD__ ? seen : ''; } catch { return ''; } });
  if (!newest || READONLY) return null;
  return <div class="old-copy" role="alert"><b>This is an older copy of the app</b> (build {__BUILD__}). A newer build ({newest}) was already used in this browser — close this file and open the newer one, otherwise recent data may not appear or changes may be lost.</div>;
}
