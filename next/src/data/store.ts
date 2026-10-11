import { useEffect, useState } from 'preact/hooks';
import seed from './seed.json';
import type { Country, Ledger, Project, ReportingPeriod, Risk } from '../domain/types';
import { validateLedger } from '../domain/calc';

export interface Filters { country: string; sector: string; q: string }
export interface Toast { id: number; text: string; undo?: () => void }
export interface State {
  ledger: Ledger;
  route: string;
  filters: Filters;
  drawer: null | { kind: 'project'; id: string } | { kind: 'new-project'; country?: string; prefill?: Partial<Project>; thenReport?: boolean } | { kind: 'import' } | { kind: 'countries'; edit?: string } | { kind: 'report'; projectId: string } | { kind: 'risk'; projectId: string; id?: string } | { kind: 'contract'; projectId: string; key: string } | { kind: 'appearance' } | { kind: 'documents'; projectId: string };
  palette: boolean;
  theme: 'light' | 'dark' | 'auto';
  toasts: Toast[];
  ready: boolean;
}

const DB = 'portfolio-ledger-next', STORE = 'kv', KEY = 'ledger';
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

let state: State = {
  ledger: clone(seed as unknown as Ledger),
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
  useEffect(() => { const f = () => force((x) => x + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return sel(state);
}

/* ---------- persistence (IndexedDB, fails soft) ---------- */
function open(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
}
async function persist(l: Ledger) {
  const db = await open(); if (!db) return;
  db.transaction(STORE, 'readwrite').objectStore(STORE).put(l, KEY);
}
export async function load() {
  const db = await open();
  if (db) {
    const l = await new Promise<Ledger | undefined>((res) => {
      const q = db.transaction(STORE).objectStore(STORE).get(KEY);
      q.onsuccess = () => res(q.result); q.onerror = () => res(undefined);
    });
    if (l && !validateLedger(l).length) state = { ...state, ledger: l };
  }
  set({ ready: true });
}

/* ---------- mutations: every change is undoable ---------- */
let tid = 0;
export function toast(text: string, undo?: () => void) {
  const id = ++tid;
  set((s) => ({ toasts: [...s.toasts, { id, text, undo }].slice(-2) }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 6000);
}
export function commit(next: Ledger, message: string) {
  history.push(state.ledger);
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
  commit(L, i >= 0 ? `Saved ${p.code}` : `Added ${p.code}`);
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
  f(p); commit(L, message);
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
export function resetDemo() { commit(clone(seed as unknown as Ledger), 'Demo data restored'); }

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
