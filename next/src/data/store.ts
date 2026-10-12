import { useEffect, useState } from 'preact/hooks';
import real from './seed.json';
import demo from './demo.json';

/** `?demo` loads the fictional demo portfolio (used by the end-to-end tests) in its own storage slot. */
const DEMO = new URLSearchParams(location.search).has('demo');
const seed = DEMO ? demo : real;
import type { Country, Ledger, Project, ReportingPeriod, Risk } from '../domain/types';
import { validateLedger } from '../domain/calc';

export interface Filters { country: string; sector: string; q: string }
export interface Toast { id: number; text: string; undo?: () => void }
export interface State {
  ledger: Ledger;
  route: string;
  filters: Filters;
  drawer: null | { kind: 'project'; id: string } | { kind: 'new-project'; country?: string; prefill?: Partial<Project>; thenReport?: boolean } | { kind: 'import' } | { kind: 'countries'; edit?: string } | { kind: 'report'; projectId: string } | { kind: 'risk'; projectId: string; id?: string } | { kind: 'contract'; projectId: string; key: string } | { kind: 'appearance' } | { kind: 'share' } | { kind: 'documents'; projectId: string } | { kind: 'portfolio-import'; files: File[] } | { kind: 'smart-import'; files: File[] } | { kind: 'alert'; projectId: string; alertKind: string; ids: string[] } | { kind: 'period'; t: number; from: number; ids: string[] };
  palette: boolean;
  theme: 'light' | 'dark' | 'auto';
  toasts: Toast[];
  ready: boolean;
}

/** A shared copy carries its data inside the file (see ui/Share): read once, before anything renders. */
export interface Embed { id: string; at: string; mode: 'view' | 'edit'; from?: string; scope: string; ledger: Ledger }
export const EMBED: Embed | null = (() => { try { const t = document.getElementById('pl-embed')?.textContent; return t ? JSON.parse(t) as Embed : null; } catch { return null; } })();
export const READONLY = EMBED?.mode === 'view';
/** The page as it was served (before rendering), so a shared copy can be written out with data inside. */
export const SOURCE = (() => { const h = document.documentElement.cloneNode(true) as HTMLElement; h.querySelector('#pl-embed')?.remove(); for (const a of [...h.attributes]) if (a.name.startsWith('data-')) h.removeAttribute(a.name); return '<!doctype html>\n' + h.outerHTML; })();
// A shared copy keeps its own storage slot, so opening it never mixes with the recipient's own ledger.
const DB = 'portfolio-ledger-next', STORE = 'kv', KEY = DEMO ? 'demo' : EMBED ? `shared:${EMBED.id}` : 'ledger-v2';
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

let state: State = {
  ledger: clone((EMBED?.ledger ?? seed) as unknown as Ledger),
  route: (location.hash.slice(2) || 'overview'),
  filters: { country: '', sector: '', q: '' },
  drawer: null,
  palette: false,
  theme: (safeGet('pl-theme') as State['theme']) || 'auto',
  toasts: [],
  ready: false,
};
const subs = new Set<() => void>();
const history: Ledger[] = [];

function safeGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string | null) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } }

export const get = () => state;
export function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach((f) => f());
}
export function useStore<T>(sel: (s: State) => T): T {
  const [, force] = useState(0);
  // A change between the first render and subscribing (e.g. a shared copy is ready at once) re-renders here.
  const seen = state;
  useEffect(() => { const f = () => force((x) => x + 1); subs.add(f); if (state !== seen) f(); return () => { subs.delete(f); }; }, []);
  return sel(state);
}

/* ---------- persistence (IndexedDB, fails soft) ---------- */
let dbp: Promise<IDBDatabase | null> | null = null;
function open(): Promise<IDBDatabase | null> {
  return (dbp ??= openDb().then((d) => { if (!d) dbp = null; else d.onclose = () => { dbp = null; }; return d; }));
}
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
}
// Rapid edits (bulk imports, typing) write once: the latest ledger is saved 250 ms after the last change.
let pending: Ledger | null = null, ptimer: ReturnType<typeof setTimeout> | undefined;
function persist(l: Ledger) {
  if (READONLY) return;
  pending = l; clearTimeout(ptimer);
  ptimer = setTimeout(() => { const x = pending; pending = null; if (x) void write(x); }, 250);
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { if (pending) { clearTimeout(ptimer); const x = pending; pending = null; void write(x); } });
async function write(l: Ledger) {
  const db = await open(); if (!db) return;
  const st = db.transaction(STORE, 'readwrite').objectStore(STORE);
  st.put(l, KEY);
  // One restore point per day (the first save of the day keeps the state before that day's changes); 30 days kept.
  const day = new Date().toISOString().slice(0, 10), k = `${KEY}:snap:${day}`;
  const q = st.get(k);
  q.onsuccess = () => { if (!q.result) st.put({ at: new Date().toISOString(), ledger: prevSaved ?? l }, k); };
  const keys = st.getAllKeys();
  keys.onsuccess = () => { const S = (keys.result as string[]).filter((x) => String(x).startsWith(`${KEY}:snap:`)).sort(); for (const x of S.slice(0, Math.max(0, S.length - 30))) st.delete(x); };
  prevSaved = l;
}
let prevSaved: Ledger | null = null;
/** Restore points kept in this browser, newest first. */
export async function restorePoints(): Promise<{ key: string; at: string; projects: number; reports: number; ledger: Ledger }[]> {
  const db = await open(); if (!db) return [];
  return new Promise((res) => {
    const st = db.transaction(STORE).objectStore(STORE), out: { key: string; at: string; projects: number; reports: number; ledger: Ledger }[] = [];
    const c = st.openCursor();
    c.onsuccess = () => { const cur = c.result; if (!cur) { res(out.sort((a, b) => b.key.localeCompare(a.key))); return; }
      const k = String(cur.key); if (k.startsWith(`${KEY}:snap:`) || k === `${KEY}:rescued`) { const v = cur.value as { at: string; ledger: Ledger }; out.push({ key: k, at: v.at, projects: v.ledger.projects.length, reports: v.ledger.projects.reduce((s, p) => s + (p.reportingPeriods?.length ?? 0), 0), ledger: v.ledger }); }
      cur.continue(); };
    c.onerror = () => res(out);
  });
}
/** Repairs instead of discarding: impossible dates are put back into set-up rather than throwing the whole ledger away. */
function repair(l: Ledger): Ledger {
  const L = clone(l);
  for (const p of L.projects) {
    if (!p.start || isNaN(Date.parse(p.start))) p.start = new Date().toISOString().slice(0, 10);
    if (!p.end || isNaN(Date.parse(p.end)) || p.end <= p.start) { const d = new Date(p.start); d.setUTCFullYear(d.getUTCFullYear() + 3); p.end = d.toISOString().slice(0, 10); p.datesTbc = true; }
    if (!(Number(p.budget) >= 0)) p.budget = 0;
    if (!p.name) p.name = p.code || p.id;
  }
  if (!Array.isArray(L.countries)) L.countries = [];
  return L;
}
export async function load() {
  // Ask the browser to keep this data even when disk space runs low (otherwise it may be cleared silently).
  try { void navigator.storage?.persist?.(); } catch { /* not supported */ }
  if (READONLY) { set({ ready: true }); return; }
  const db = await open();
  if (db) {
    const l = await new Promise<Ledger | undefined>((res) => {
      const q = db.transaction(STORE).objectStore(STORE).get(KEY);
      q.onsuccess = () => res(q.result); q.onerror = () => res(undefined);
    });
    if (l && Array.isArray(l.projects)) {
      // Never fall back to the start data when stored data has a problem — that silently lost work before.
      if (validateLedger(l).length) { const db2 = await open(); db2?.transaction(STORE, 'readwrite').objectStore(STORE).put({ at: new Date().toISOString(), ledger: l }, `${KEY}:rescued`); }
      prevSaved = l;
      state = { ...state, ledger: EMBED ? l : mergeSeed(validateLedger(l).length ? repair(l) : l) };
    }
  }
  set({ ready: true });
}

/**
 * Start data grows over time (new real projects). Projects added to the start data since this browser last
 * loaded it are merged in once, matched by id or budget head, so existing work is kept.
 */
const SEED_VERSION = 3;
function mergeSeed(l: Ledger): Ledger {
  const v = (l as Ledger & { seedVersion?: number }).seedVersion ?? 1;
  if (DEMO) return l;
  const S = seed as unknown as Ledger, L = clone(l);
  // Projects whose real dates are now in the start data leave set-up, whatever this browser's start-data version.
  let fixed = false;
  for (const x of L.projects) { const p = S.projects.find((y) => y.id === x.id || (y.bh && y.bh === x.bh)); if (p && !p.datesTbc && (x.datesTbc || x.end <= x.start || (Date.parse(x.end) - Date.parse(x.start)) < 90 * 864e5)) { x.start = p.start; x.end = p.end; delete x.datesTbc; fixed = true; } /* set-up or implausible dates (e.g. end read wrongly from a document) */ }
  if (v >= SEED_VERSION) { if (fixed) persist(L); return fixed ? L : l; }
  for (const p of S.projects) {
    const x = L.projects.find((y) => y.id === p.id || (p.bh && y.bh === p.bh));
    if (!x) { L.projects.push(clone(p)); continue; }
    // Identity fields from the monitoring sheet; dates and amount only while the project is still being set up.
    for (const k of ['ccm', 'mae', 'pmm', 'funding'] as const) if (p[k]) x[k] = p[k];
    if (x.datesTbc && !p.datesTbc) { x.start = p.start; x.end = p.end; delete x.datesTbc; }
    if (!x.approvedBudget && p.budget) x.budget = p.budget; // project amount from the monitoring sheet until an approved budget is on file
  }
  for (const c of S.countries) { const x = L.countries.find((y) => y.id === c.id); if (!x) L.countries.push(clone(c)); else if (c.ccm && !x.ccm) x.ccm = c.ccm; }
  (L as Ledger & { seedVersion?: number }).seedVersion = SEED_VERSION;
  persist(L);
  return L;
}

/* ---------- mutations: every change is undoable ---------- */
let tid = 0;
export function toast(text: string, undo?: () => void) {
  const id = ++tid;
  set((s) => ({ toasts: [...s.toasts, { id, text, undo }].slice(-2) }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 6000);
}
export function commit(next: Ledger, message: string, project?: string) {
  if (READONLY) { toast('This is a view-only copy — changes are not saved'); return; }
  history.push(state.ledger);
  next.audit = [{ at: new Date().toISOString(), message, ...(project ? { project } : {}) }, ...(next.audit ?? [])].slice(0, 300);
  if (history.length > 50) history.shift();
  set({ ledger: next });
  persist(next);
  toast(message, undo);
}
export function undo() {
  const prev = history.pop(); if (!prev) return;
  set({ ledger: prev }); persist(prev); toast('Change undone');
}
export function upsertProject(p: Project) {
  const L = clone(state.ledger);
  const i = L.projects.findIndex((x) => x.id === p.id);
  if (i >= 0) L.projects[i] = p; else L.projects.push(p);
  commit(L, i >= 0 ? `Saved ${p.code}` : `Added ${p.code}`, p.code);
}
export function updateProject(id: string, patch: Partial<Project>) {
  const p = state.ledger.projects.find((x) => x.id === id); if (!p) return;
  upsertProject({ ...clone(p), ...patch });
}
export function deleteProjects(ids: string[]) {
  const L = clone(state.ledger);
  L.projects = L.projects.filter((p) => !ids.includes(p.id));
  commit(L, `Deleted ${ids.length} project${ids.length > 1 ? 's' : ''}`);
}
export function upsertCountry(c: Country) {
  const L = clone(state.ledger);
  const i = L.countries.findIndex((x) => x.id === c.id);
  if (i >= 0) L.countries[i] = c; else L.countries.push(c);
  L.countries.sort((a, b) => a.name.localeCompare(b.name));
  commit(L, i >= 0 ? `Saved ${c.name}` : `Added ${c.name}`);
}
/** Removes a country; refuses while projects still reference it. */
export function deleteCountry(id: string): string | null {
  const used = state.ledger.projects.filter((p) => p.country === id).length;
  if (used) return `${used} project${used > 1 ? 's' : ''} still use this country. Move or delete them first.`;
  const L = clone(state.ledger);
  const c = L.countries.find((x) => x.id === id);
  L.countries = L.countries.filter((x) => x.id !== id);
  if (state.filters.country === id) set({ filters: { ...state.filters, country: '' } });
  commit(L, `Removed ${c?.name ?? 'country'}`);
  return null;
}
function editProject(id: string, f: (p: Project) => void, message: string) {
  const L = clone(state.ledger);
  const p = L.projects.find((x) => x.id === id); if (!p) return;
  f(p); commit(L, message, p.code);
}
export const upsertReport = (pid: string, r: ReportingPeriod) => editProject(pid, (p) => {
  const R = p.reportingPeriods ?? (p.reportingPeriods = []);
  const i = R.findIndex((x) => x.id === r.id); if (i >= 0) R[i] = r; else R.push(r);
  R.sort((a, b) => a.date.localeCompare(b.date));
}, `Saved ${r.name}`);
export const deleteReport = (pid: string, rid: string) => editProject(pid, (p) => { p.reportingPeriods = (p.reportingPeriods ?? []).filter((r) => r.id !== rid); }, 'Report removed');
export function updateLine(pid: string, rid: string, code: string, patch: Record<string, number | string | null>) {
  editProject(pid, (p) => {
    const l = p.reportingPeriods?.find((r) => r.id === rid)?.snapshot?.lines.find((x) => x.code === code);
    if (!l) return;
    Object.assign(l, patch);
    if ('actual' in patch || 'committed' in patch) l.spentCommitted = (l.actual ?? 0) + (l.committed ?? 0);
  }, `Line ${code} updated`);
}
export const upsertRisk = (pid: string, r: Risk) => editProject(pid, (p) => {
  const R = p.riskRegister ?? (p.riskRegister = []);
  const i = R.findIndex((x) => x.id === r.id); if (i >= 0) R[i] = r; else R.push(r);
}, `Saved risk “${r.title}”`);
export const deleteRisk = (pid: string, id: string) => editProject(pid, (p) => { p.riskRegister = (p.riskRegister ?? []).filter((r) => r.id !== id); }, 'Risk removed');
export const setStaffOverride = (pid: string, key: string, o: import('../domain/staff').StaffOverride | null) => editProject(pid, (p) => {
  const O = p.staffOverrides ?? (p.staffOverrides = {});
  if (o) O[key] = { ...o, updatedAt: new Date().toISOString() }; else delete O[key];
}, o ? 'Contract details saved' : 'Contract details cleared');
export function replaceLedger(l: Ledger, message: string) { commit(clone(l), message); }
export function resetDemo() { commit(clone(seed as unknown as Ledger), 'Start data restored'); }

/* ---------- navigation & theme ---------- */
export function go(route: string) { if (location.hash !== '#/' + route) location.hash = '/' + route; set({ route, palette: false }); }
addEventListener('hashchange', () => set({ route: location.hash.slice(2) || 'overview' }));
export function setTheme(t: State['theme']) {
  safeSet('pl-theme', t === 'auto' ? null : t);
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  set({ theme: t });
}
export const isDark = () =>
  document.documentElement.dataset.theme === 'dark' ||
  (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);

export function filtered(s: State): Project[] {
  const { country, sector, q } = s.filters;
  const qq = q.trim().toLowerCase();
  return s.ledger.projects.filter((p) =>
    (!country || p.country === country) && (!sector || p.sector === sector) &&
    (!qq || `${p.code} ${p.name} ${p.sector} ${p.funding} ${p.pmm ?? ''} ${p.bh ?? ''}`.toLowerCase().includes(qq)));
}
