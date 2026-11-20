import { dayMonYear } from '../domain/dt';
import { adminHash } from '../domain/hash';
import { normalizeProject } from '../domain/normalize';
import { useEffect, useState } from 'preact/hooks';
import real from './seed.json';
import demo from './demo.json';

/** `?demo` loads the fictional demo portfolio (used by the end-to-end tests) in its own storage slot. */
const DEMO = new URLSearchParams(location.search).has('demo');
const seed = DEMO ? demo : real;
import type { Country, Ledger, Project, ReportingPeriod, Risk, TrashItem } from '../domain/types';
import { validateLedger } from '../domain/calc';
import { officeCountry } from '../domain/office';
import { lockOf } from '../domain/close';
import { pruneMarks } from '../domain/worklist';
import { customRules, setRules } from '../domain/rules';

export interface Filters { country: string; sector: string; q: string }
export interface Toast { id: number; text: string; undo?: () => void }
export interface State {
  ledger: Ledger;
  route: string;
  filters: Filters;
  drawer: null | { kind: 'project'; id: string } | { kind: 'new-project'; country?: string; prefill?: Partial<Project>; thenReport?: boolean } | { kind: 'import' } | { kind: 'rules' } | { kind: 'trace'; projectId: string; figure?: import('../domain/provenance').Figure; line?: string; field?: import('../domain/provenance').LineField } | { kind: 'countries'; edit?: string } | { kind: 'report'; projectId: string } | { kind: 'risk'; projectId: string; id?: string } | { kind: 'contract'; projectId: string; key: string } | { kind: 'appearance' } | { kind: 'share' } | { kind: 'documents'; projectId: string } | { kind: 'portfolio-import'; files: File[] } | { kind: 'smart-import'; files: File[] } | { kind: 'alert'; projectId: string; alertKind: string; ids: string[] } | { kind: 'period'; t: number; from: number; ids: string[] } | { kind: 'points'; title: string; text: string; items: { id: string; label: string; why: string; group?: string; tone?: 'bad' | 'warn' | 'good' | 'info'; to?: string }[] };
  palette: boolean;
  theme: 'light' | 'dark' | 'auto';
  toasts: Toast[];
  ready: boolean;
  /** shared copy waiting for its password */ locked?: boolean;
  /** nothing was saved in this browser yet: the start data is shown and a backup can be restored */ fresh?: boolean;
}

/** A shared copy carries its data inside the file (see ui/Share): read once, before anything renders. */
export interface Embed { id: string; at: string; mode: 'view' | 'edit'; from?: string; scope: string; ledger?: Ledger; /** the ledger as gzip, base64: a large copy opens faster and is a fraction of the size */ z?: string; /** password-protected data */ enc?: import('../ui/crypto').Sealed; /** donor version: internal detail removed */ audience?: 'donor' }
export const EMBED: Embed | null = (() => { try { const t = document.getElementById('pl-embed')?.textContent; return t ? JSON.parse(t) as Embed : null; } catch { return null; } })();
export const READONLY = EMBED?.mode === 'view';
/** Unpacks a compressed shared copy (`z`). Done only when the data is needed: a copy opened before reads its own saved data. */
async function gunzipText(b64: string): Promise<string> {
  const a = atob(b64), u = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) u[i] = a.charCodeAt(i);
  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
let embedOpened = false;
async function openEmbed() {
  if (!EMBED?.z || EMBED.ledger || embedOpened) return;
  embedOpened = true;
  try { const l = JSON.parse(await gunzipText(EMBED.z)) as Ledger; state = { ...state, ledger: { ...l, projects: (l.projects ?? []).map(normalizeProject) } }; }
  catch { toast('The data inside this copy could not be opened in this browser. Open it in an up-to-date Edge or Chrome.'); }
}
/** The page as it was served (before rendering), so a shared copy can be written out with data inside. */
export const SOURCE = (() => { const h = document.documentElement.cloneNode(true) as HTMLElement; h.querySelector('#pl-embed')?.remove(); for (const a of [...h.attributes]) if (a.name.startsWith('data-')) h.removeAttribute(a.name); return '<!doctype html>\n' + h.outerHTML; })();
// A shared copy keeps its own storage slot, so opening it never mixes with the recipient's own ledger.
const DB = 'portfolio-ledger-next', STORE = 'kv', KEY = DEMO ? 'demo' : EMBED ? `shared:${EMBED.id}` : 'ledger-v2';
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
/**
 * A new ledger for a change: the lists are copied, the projects and offices in them are shared. A mutation copies only
 * the object it changes (own*), so a change costs the size of that object — not of every report in the portfolio — and
 * unchanged projects keep their identity, which keeps the per-project caches warm.
 */
const draft = (l: Ledger): Ledger => ({ ...l, projects: [...l.projects], countries: [...l.countries], ...(l.offices ? { offices: [...l.offices] } : {}), ...(l.trash ? { trash: [...l.trash] } : {}) });
const ownProject = (L: Ledger, id?: string) => { const i = L.projects.findIndex((p) => p.id === id); return i < 0 ? undefined : (L.projects[i] = clone(L.projects[i])); };
const ownOffice = (L: Ledger, id: string) => { const i = (L.offices ?? []).findIndex((o) => o.id === id); return i < 0 ? undefined : (L.offices![i] = clone(L.offices![i])); };

let state: State = {
  ledger: ((l: Ledger) => ({ ...l, projects: l.projects.map(normalizeProject) }))(clone((EMBED ? EMBED.ledger ?? { countries: [], projects: [] } : seed) as unknown as Ledger)),
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
let rulesOf: unknown;
export function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  // The house rules travel with the ledger: whenever another ledger is shown (load, undo, restore), its rules apply.
  if (state.ledger.rules !== rulesOf) { rulesOf = state.ledger.rules; setRules(state.ledger.rules); }
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
/* Storage is split: the ledger without its projects under META, each project under its own key. A save writes only the
   projects whose object changed since the last save (changes copy only the touched project), so saving stays quick however
   many reports and workbooks the other projects hold. */
const META = `${KEY}:m`, PK = `${KEY}:p:`, PRANGE = () => IDBKeyRange.bound(PK, PK + '\uffff');
const written = new Map<string, Project>();
let failNoted = 0;
const noteFail = () => { if (Date.now() - failNoted > 60_000) { failNoted = Date.now(); toast('Your last changes could not be saved in this browser (storage full or blocked). Back up now from Import / backup.'); } };
/** Resolves false when the browser refused the write (storage full or blocked): nothing of it is then taken as saved. */
async function write(l: Ledger): Promise<boolean> {
  const db = await open(); if (!db) { noteFail(); return false; }
  const tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE);
  st.put({ ...l, projects: [], ids: l.projects.map((p) => p.id) }, META);
  const ids = new Set<string>(), put: Project[] = [], gone: string[] = [];
  for (const p of l.projects) { ids.add(p.id); if (written.get(p.id) !== p) { st.put(p, PK + p.id); put.push(p); } }
  for (const id of [...written.keys()]) if (!ids.has(id)) { st.delete(PK + id); gone.push(id); }
  // One restore point per day (the first save of the day keeps the state before that day's changes); 30 days kept.
  const day = new Date().toISOString().slice(0, 10), k = `${KEY}:snap:${day}`;
  const q = st.getKey(k);
  q.onsuccess = () => { if (q.result === undefined) st.put({ at: new Date().toISOString(), ledger: prevSaved ?? l }, k); };
  const keys = st.getAllKeys(IDBKeyRange.bound(`${KEY}:snap:`, `${KEY}:snap:\uffff`));
  keys.onsuccess = () => { const S = (keys.result as string[]).sort(); for (const x of S.slice(0, Math.max(0, S.length - 30))) st.delete(x); };
  // Only a committed write counts: a project whose write was refused is written again with the next save.
  return new Promise((res) => {
    tx.oncomplete = () => { for (const p of put) written.set(p.id, p); for (const id of gone) written.delete(id); prevSaved = l; res(true); };
    tx.onabort = () => { noteFail(); res(false); };
  });
}
/** Reads the stored ledger: the split form, or the older single record (moved to the split form on the next save). */
function readStored(db: IDBDatabase): Promise<{ l?: Ledger; legacy: boolean }> {
  return new Promise((res) => {
    const st = db.transaction(STORE).objectStore(STORE);
    const m = st.get(META), ps = st.getAll(PRANGE()), old = st.get(KEY);
    st.transaction.oncomplete = () => {
      const meta = m.result as (Ledger & { ids?: string[] }) | undefined;
      if (meta && Array.isArray(meta.ids)) {
        const by = new Map((ps.result as Project[]).map((p) => [p.id, p]));
        const projects = meta.ids.map((id) => by.get(id)).filter((p): p is Project => !!p);
        for (const p of projects) written.set(p.id, p);
        const { ids: _ids, ...rest } = meta;
        res({ l: { ...rest, projects }, legacy: false });
      } else res({ l: old.result as Ledger | undefined, legacy: true });
    };
    st.transaction.onerror = () => res({ legacy: true });
  });
}
let prevSaved: Ledger | null = null;
/** Restore points kept in this browser, newest first. */
export async function restorePoints(): Promise<{ key: string; at: string; label?: string; projects: number; reports: number; ledger: Ledger }[]> {
  const db = await open(); if (!db) return [];
  return new Promise((res) => {
    const st = db.transaction(STORE).objectStore(STORE), out: { key: string; at: string; label?: string; projects: number; reports: number; ledger: Ledger }[] = [];
    const c = st.openCursor();
    c.onsuccess = () => { const cur = c.result; if (!cur) { res(out.sort((a, b) => b.at.localeCompare(a.at))); return; }
      const k = String(cur.key); if (k.startsWith(`${KEY}:snap:`) || k.startsWith(`${KEY}:pre:`) || k === `${KEY}:rescued`) { const v = cur.value as { at: string; ledger: Ledger; label?: string }; out.push({ key: k, at: v.at, label: v.label, projects: v.ledger.projects.length, reports: v.ledger.projects.reduce((s, p) => s + (p.reportingPeriods?.length ?? 0), 0), ledger: v.ledger }); }
      cur.continue(); };
    c.onerror = () => res(out);
  });
}
/**
 * A restore point taken just before an import, so a wrong file is one click away from undone even after the page was
 * closed. Imports in quick succession (a bulk drop) share one point; the last 10 are kept.
 */
let lastCheckpoint = 0;
export async function checkpoint(label: string) {
  if (READONLY || Date.now() - lastCheckpoint < 120_000) return;
  lastCheckpoint = Date.now();
  const before = state.ledger; // taken now, before the import changes it
  const db = await open(); if (!db) return;
  const st = db.transaction(STORE, 'readwrite').objectStore(STORE), at = new Date().toISOString();
  st.put({ at, label, ledger: before }, `${KEY}:pre:${at}`);
  const keys = st.getAllKeys(IDBKeyRange.bound(`${KEY}:pre:`, `${KEY}:pre:\uffff`));
  keys.onsuccess = () => { const K = (keys.result as string[]).sort(); for (const x of K.slice(0, Math.max(0, K.length - 10))) st.delete(x); };
}
/** A small value kept with the data in this browser (e.g. the backup folder). */
export async function kv<T>(key: string, value?: T | null): Promise<T | undefined> {
  const db = await open(); if (!db) return undefined;
  return new Promise((res) => {
    const st = db.transaction(STORE, value === undefined ? 'readonly' : 'readwrite').objectStore(STORE), k = `${KEY}:${key}`;
    const r = value === undefined ? st.get(k) : value === null ? st.delete(k) : st.put(value, k);
    r.onsuccess = () => res(value === undefined ? r.result as T : undefined); r.onerror = () => res(undefined);
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
/** Opens a password-protected shared copy; false when the password is wrong. */
export async function unlock(pw: string): Promise<boolean> {
  if (!EMBED?.enc) return true;
  const { open: openSealed } = await import('../ui/crypto');
  const t = await openSealed(EMBED.enc, pw); if (t == null) return false;
  EMBED.ledger = JSON.parse(t) as Ledger;
  state = { ...state, ledger: ((l: Ledger) => ({ ...l, projects: l.projects.map(normalizeProject) }))(clone(EMBED.ledger)) };
  set({ locked: false, ready: false });
  await load();
  return true;
}
export async function load() {
  // Ask the browser to keep this data even when disk space runs low (otherwise it may be cleared silently).
  try { void navigator.storage?.persist?.(); } catch { /* not supported */ }
  if (EMBED?.enc && !EMBED.ledger) { set({ ready: true, locked: true }); return; }
  if (READONLY) { await openEmbed(); set({ ready: true }); return; }
  const db = await open();
  let stored = false;
  if (db) {
    const { l, legacy } = await readStored(db);
    if (!l && !DEMO && !EMBED) state = { ...state, fresh: true };
    if (l && Array.isArray(l.projects)) {
      stored = true;
      // Never fall back to the start data when stored data has a problem — that silently lost work before.
      if (validateLedger(l).length) { const db2 = await open(); db2?.transaction(STORE, 'readwrite').objectStore(STORE).put({ at: new Date().toISOString(), ledger: l }, `${KEY}:rescued`); }
      prevSaved = l;
      l.projects = l.projects.map(normalizeProject);
      state = { ...state, ledger: EMBED ? l : mergeSeed(validateLedger(l).length ? repair(l) : l) };
      // Move the older single record to the split form once; it is kept as that day's restore point.
      if (legacy) { void write(state.ledger).then((ok) => (ok ? open() : null)).then((d) => d?.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY)); }
    }
  }
  if (!stored) await openEmbed();
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
  const S = seed as unknown as Ledger;
  // Copy the stored data only when something below changes it (the copy of a large ledger costs time on every opening).
  const needs = v < SEED_VERSION || l.projects.some((x) => { const p = S.projects.find((y) => y.id === x.id || (y.bh && y.bh === x.bh)); return p && !p.datesTbc && (x.datesTbc || x.end <= x.start || (Date.parse(x.end) - Date.parse(x.start)) < 90 * 864e5); });
  if (!needs) return l;
  const L = clone(l);
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
  // The same message again (e.g. typing in a table) replaces the one on screen instead of stacking.
  set((s) => ({ toasts: [...s.toasts.filter((t) => t.text !== text), { id, text, undo }].slice(-2) }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 6000);
}
/** Set by the backup module: a folder copy follows saved changes. */
let afterSave: (() => void) | undefined;
export const onSaved = (f: () => void) => { afterSave = f; };
export function commit(next: Ledger, message: string, project?: string) {
  if (READONLY) { toast('This is a view-only copy — changes are not saved'); return; }
  history.push(state.ledger);
  next.audit = [{ at: new Date().toISOString(), message, ...(project ? { project } : {}) }, ...(next.audit ?? [])].slice(0, 300);
  if (history.length > 50) history.shift();
  set({ ledger: next });
  persist(next);
  afterSave?.();
  toast(message, undo);
}
export function undo() {
  const prev = history.pop(); if (!prev) return;
  set({ ledger: prev }); persist(prev); toast('Change undone');
}

export function upsertProject(p0: Project) {
  const p = normalizeProject(p0);
  const L = draft(state.ledger);
  const i = L.projects.findIndex((x) => x.id === p.id);
  if (i >= 0) L.projects[i] = p; else L.projects.push(p);
  commit(L, i >= 0 ? `Saved ${p.code}` : `Added ${p.code}`, p.code);
}
export function updateProject(id: string, patch: Partial<Project>) {
  const p = state.ledger.projects.find((x) => x.id === id); if (!p) return;
  upsertProject({ ...p, ...patch });
}
/** Adds an office report (same office and date replaces), creating the office from the file on first import. */
export function upsertOfficeReport(r: import('../domain/office').OfficeReport, country?: string) {
  const L = draft(state.ledger), O = (L.offices ??= []);
  // Country from the CCM label or office name (Bureau ANKARA → Türkiye), else the country filter in use.
  const c = country ?? officeCountry(`${r.ccmName ?? ''} ${r.office}`)?.id ?? (state.filters.country || L.countries[0]?.id || '');
  let o = O.find((x) => (r.ccm && x.ccm === r.ccm) || x.name === r.office);
  if (o) o = ownOffice(L, o.id);
  r = clone(r);
  if (!o) { o = { id: `office-${r.ccm ?? O.length + 1}`, name: r.office, country: c, ccm: r.ccm, bh: r.bh, reports: [] }; O.push(o); }
  const i = o.reports.findIndex((x) => x.date === r.date);
  if (i >= 0) o.reports[i] = r; else o.reports.push(r);
  if (r.hasPlan) o.name = r.office; // the office's own report names it properly (the system export only has the CCM label)
  o.reports.sort((a, b) => a.date.localeCompare(b.date));
  // System exports carry no line budgets: take them from the office's forecast of the same year (whichever came first).
  for (const x of o.reports.filter((x) => !x.hasPlan)) {
    const ref = o.reports.filter((y) => y.hasPlan && y.year === x.year).sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(x.date)) - Math.abs(Date.parse(b.date) - Date.parse(x.date)))[0];
    if (!ref) continue;
    const by = new Map(ref.lines.map((l) => [l.code, l]));
    for (const l of ref.lines) if (!x.lines.some((y) => y.code === l.code)) x.lines.push({ ...l, ob: { budget: l.ob.budget, sc: 0, planned: 0 }, ls: { budget: l.ls.budget, sc: 0, planned: 0 }, note: undefined });
    for (const l of x.lines) { const b = by.get(l.code); if (b) { l.ob.budget = b.ob.budget; l.ls.budget = b.ls.budget; l.heading = b.heading; l.description = b.description; } }
    x.lines.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    x.office = ref.office;
  }
  commit(L, `Office budget ${o.name} · ${r.date}`);
}
export function setOfficeNote(officeId: string, key: string, note: import('../domain/office').OfficeNote | null) {
  const L = draft(state.ledger), o = ownOffice(L, officeId); if (!o) return;
  const N = { ...(o.notes ?? {}) }; if (note) N[key] = note; else delete N[key]; o.notes = N;
  commit(L, note ? `${o.name} line ${key.split(':')[1]}: ${note.resolved ? 'corrected' : 'note'}` : 'Note removed');
}
export function setOfficeCountry(officeId: string, country: string) {
  const L = draft(state.ledger), o = ownOffice(L, officeId); if (!o) return;
  o.country = country; commit(L, `${o.name} → ${country.toUpperCase()}`);
}
/** The admin password as first set (salted hash; the password itself is not in the code). Changed under Rules & thresholds. */
const DEFAULT_ADMIN = 'c4a45da4b7dbd3f86a5f95cc7f95b6e93be43dba5446774a844666914ee1b38b';
/** Changes the admin password: the current one first. Kept salted and hashed in the data, so a shared copy carries it. */
export function setAdminPassword(current: string, next: string): string {
  if (adminHash(current) !== (state.ledger.adminHash ?? DEFAULT_ADMIN)) return 'The current password is not right.';
  if (next.length < 4) return 'The new password needs at least 4 characters.';
  const L = draft(state.ledger); L.adminHash = adminHash(next); commit(L, 'Admin password changed');
  try { sessionStorage.removeItem('pl-admin'); } catch { /* asked again next time anyway */ }
  return '';
}
/** Deleting is for the admin: the password is asked once per browser session. Guards mistakes, not a real lock (the file is offline). */
export function isAdmin(what = 'delete'): boolean {
  try { if (sessionStorage.getItem('pl-admin') === '1') return true; } catch { /* ignore */ }
  const typed = typeof prompt === 'function' ? prompt(`Admin password to ${what}`) : null;
  const ok = typed != null && adminHash(typed) === (state.ledger.adminHash ?? DEFAULT_ADMIN);
  if (ok) try { sessionStorage.setItem('pl-admin', '1'); } catch { /* ignore */ }
  else if (typeof alert === 'function') alert(`Only the admin can ${what}.`);
  return ok;
}
/**
 * Period lock: a report that carried the figures of a closed month is changed only by the admin, after a clear
 * question. Returns true when the change may go ahead (the report is not locked, or the admin confirmed).
 */
export function lockOk(pid: string, rid: string, what: string): boolean {
  const p = state.ledger.projects.find((x) => x.id === pid), r = p?.reportingPeriods?.find((x) => x.id === rid);
  const c = p && r ? lockOf(state.ledger.closes, pid, r) : undefined;
  if (!c) return true;
  const k = `${pid}:${rid}:${c.month}`; if (Date.now() - (lockAsked.get(k) ?? 0) < 5 * 60_000) return true;
  const m = new Date(c.month + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (typeof confirm === 'function' && !confirm(`“${r!.name}” carries the figures of ${m}, which is closed.\n\nTo ${what} changes what was closed. Monthly close will show the difference until the month is closed again.\n\nGo ahead?`)) return false;
  const ok = isAdmin('change a closed month'); if (ok) lockAsked.set(k, Date.now());
  return ok;
}
const lockAsked = new Map<string, number>();
/** Reopens a closed month: its report can be changed again and its figures are no longer watched. */
export function reopenClose(month: string) {
  if (!isAdmin('reopen a closed month')) return;
  const L = draft(state.ledger); L.closes = (L.closes ?? []).map((c) => (c.month === month ? { ...c, reopened: new Date().toISOString() } : c));
  commit(L, `Month ${month} reopened`);
}
/** Every deletion is kept in the trash (last 100) so it can be put back from Data check. */
function toTrash(L: Ledger, t: Omit<TrashItem, 'id' | 'at'>) {
  L.trash = [{ ...clone(t), id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: new Date().toISOString() } as TrashItem, ...(L.trash ?? [])].slice(0, 100);
}
export function restoreTrash(id: string) {
  const L = draft(state.ledger), t0 = L.trash?.find((x) => x.id === id); if (!t0) return;
  const t = clone(t0);
  const P = (pid?: string) => ownProject(L, pid);
  if (t.kind === 'project') { if (!L.projects.some((p) => p.id === (t.data as Project).id)) L.projects.push(t.data as Project); }
  else if (t.kind === 'country') { if (!L.countries.some((c) => c.id === (t.data as Country).id)) L.countries.push(t.data as Country); for (const p of t.projects ?? []) if (!L.projects.some((x) => x.id === p.id)) L.projects.push(p); }
  else if (t.kind === 'report') { const p = P(t.pid); if (!p) return toast('The project is gone — restore it first'); (p.reportingPeriods ??= []).push(t.data as ReportingPeriod); p.reportingPeriods.sort((a, b) => a.date.localeCompare(b.date)); }
  else if (t.kind === 'document') { const p = P(t.pid); if (!p) return toast('The project is gone — restore it first'); (p.documents ??= []).push(t.data as NonNullable<Project['documents']>[number]); }
  else if (t.kind === 'risk') { const p = P(t.pid); if (!p) return toast('The project is gone — restore it first'); (p.riskRegister ??= []).push(t.data as Risk); }
  else if (t.kind === 'office-report') { const d = t.data as { office: import('../domain/office').Office; report: import('../domain/office').OfficeReport }; const o = t.officeId ? ownOffice(L, t.officeId) : undefined; L.offices ??= []; if (o) o.reports.push(d.report); else L.offices.push({ ...d.office, reports: [d.report] }); }
  L.trash = L.trash!.filter((x) => x.id !== id);
  commit(L, `Restored ${t.label}`, t.pid);
}
/** A one-click fix from Data check; anything it removes goes to the trash. */
export function fixProject(pid: string, fix: import('../domain/health').AutoFix, f: typeof import('../domain/health').applyFix) {
  const L = draft(state.ledger), i = L.projects.findIndex((p) => p.id === pid); if (i < 0) return;
  const { p, removed } = f(L.projects[i], fix);
  for (const r of removed) toTrash(L, { kind: r.kind, label: `${r.label} (${p.code})`, data: r.data, pid });
  L.projects[i] = p; commit(L, fix === 'use-approved' ? `${p.code}: budget set from the approved budget` : `${p.code}: ${removed.length} duplicate${removed.length === 1 ? '' : 's'} moved to the trash`, p.code);
}
/** The organisation's logo and name shown in the menu, the browser tab and on covers (null removes it). */
export function setBrand(brand: Ledger['brand'] | null) {
  const L = draft(state.ledger); if (brand) L.brand = brand; else delete L.brand;
  commit(L, brand ? 'Appearance and document settings saved' : 'Name and logo removed');
}
/** Records the close of a month (replaces an earlier close of the same month). */
export function saveClose(rec: import('../domain/close').CloseRecord) {
  const L = draft(state.ledger); L.closes = [rec, ...(L.closes ?? []).filter((c) => c.month !== rec.month)].slice(0, 36);
  commit(L, `Month ${rec.month} closed`);
}
/** Saves the house rules (only what differs from the defaults is kept). Every check is redone under the new rules. */
export function saveRules(r: import('../domain/rules').Rules) {
  const L = draft(state.ledger), c = customRules(r);
  if (c) L.rules = c; else delete L.rules;
  // Checks are remembered per project: a new identity for each project makes them read the new rules.
  L.projects = L.projects.map((p) => ({ ...p }));
  commit(L, c ? 'Rules and thresholds saved' : 'Rules and thresholds back to the defaults');
}
/** Marks alerts handled or snoozed (null puts them back in the open list); each decision goes to the alert log. */
export function markAlerts(items: { key: string; title: string; project?: string; severity: import('../domain/calc').Severity }[], mark: { state: 'done' | 'snoozed'; until?: string; note?: string } | null) {
  if (!items.length) return;
  const L = draft(state.ledger), M = { ...(L.alertMarks ?? {}) }, at = new Date().toISOString(), note = mark?.note?.trim() || undefined;
  for (const x of items) { if (mark) M[x.key] = { state: mark.state, at, until: mark.until, note, severity: x.severity, title: x.title, project: x.project }; else delete M[x.key]; }
  L.alertMarks = Object.keys(M).length > 300 ? pruneMarks(M, new Set(items.map((x) => x.key)), new Date()) : M;
  L.alertLog = [...items.map((x) => ({ at, key: x.key, action: mark ? mark.state : 'reopened' as const, title: x.title, project: x.project, note, until: mark?.until })), ...(L.alertLog ?? [])].slice(0, 400);
  const n = items.length, what = n > 1 ? `${n} alerts` : `“${items[0].title}”`;
  commit(L, mark ? (mark.state === 'done' ? `${what} marked as handled` : `${what} snoozed until ${mark.until ? dayMonYear(new Date(mark.until + 'T00:00:00Z')) : 'later'}`) : `${what} reopened`, items[0].project);
}
/** Remembers how a file format is read (block roles, document type); null forgets it. */
export function setFormat(key: string, f: { roles?: Record<string, string>; type?: string } | null) {
  const L = draft(state.ledger), m = { ...(L.formats ?? {}) };
  if (f) m[key] = { ...m[key], ...f, at: new Date().toISOString() }; else delete m[key];
  L.formats = m; commit(L, f ? 'File format remembered' : 'File format forgotten');
}
/** Sets by hand the service-provider kind of a purchase order ('' = back to automatic, 'none' = leave it out). */
export function setPoKind(key: string, kind: string) {
  const L = draft(state.ledger), m = { ...(L.poKinds ?? {}) };
  if (kind) m[key] = kind; else delete m[key];
  L.poKinds = m; commit(L, kind ? 'PO kind set' : 'PO kind back to automatic');
}
/** Sets or clears a service provider's framework contract (ceiling, end date, reference). */
export function setFramework(key: string, f: import('../domain/contracts').Contract | null) {
  const L = draft(state.ledger), m = { ...(L.frameworks ?? {}) };
  if (f && (f.cap || f.end || f.ref || f.start || f.openEnded)) m[key] = f; else delete m[key];
  L.frameworks = m; commit(L, f ? `Contract saved${f.name ? `: ${f.name}` : ''}` : 'Contract removed');
}
/** Adds or changes a member of a country office's core team. */
export function setCoreMember(country: string, m: import('../domain/coreTeam').CoreMember) {
  const L = draft(state.ledger), all = { ...(L.coreTeam ?? {}) }, M = [...(all[country] ?? [])], i = M.findIndex((x) => x.id === m.id);
  if (i >= 0) M[i] = m; else M.push(m);
  all[country] = M; L.coreTeam = all; commit(L, `Core team: ${m.name} ${i >= 0 ? 'changed' : 'added'}`);
}
/** Adds the members read from a list to a country's core team, leaving out a name already on it. */
export function addCoreMembers(country: string, add: import('../domain/coreTeam').CoreMember[]): number {
  const M = state.ledger.coreTeam?.[country] ?? [], k = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
  const fresh = add.filter((m) => !M.some((x) => k(x.name) === k(m.name)));
  if (!fresh.length) return 0;
  const L = draft(state.ledger); L.coreTeam = { ...(L.coreTeam ?? {}), [country]: [...M, ...fresh] }; commit(L, `Core team: ${fresh.length} added from a list`);
  return fresh.length;
}
/** Removes a member of a core team (the admin password is asked). */
export function removeCoreMember(country: string, id: string) {
  const M = state.ledger.coreTeam?.[country] ?? [], m = M.find((x) => x.id === id);
  if (!m || !isAdmin('remove a core team member')) return;
  const L = draft(state.ledger); L.coreTeam = { ...(L.coreTeam ?? {}), [country]: M.filter((x) => x.id !== id) }; commit(L, `Core team: ${m.name} removed`);
}
/** Ticks or unticks a task of the monthly checklist. */
export function setCheck(month: string, key: string, done: boolean) {
  const L = draft(state.ledger), C = { ...(L.checklist ?? {}) }, M = { ...(C[month] ?? {}) };
  if (done) M[key] = new Date().toISOString(); else delete M[key];
  C[month] = M; L.checklist = C;
  commit(L, done ? 'Task done' : 'Task reopened');
}
export function emptyTrash() { if (!isAdmin()) return; const L = draft(state.ledger); L.trash = []; commit(L, 'Trash emptied'); }
export function deleteDocument(pid: string, name: string) {
  if (!isAdmin()) return;
  editProject(pid, (p) => { const d = p.documents?.find((x) => x.name === name); if (!d) return; p.documents = p.documents!.filter((x) => x !== d); toTrash(L0!, { kind: 'document', label: `${name} (${p.code})`, data: d, pid }); }, 'Document removed');
}
export function deleteOfficeReport(officeId: string, reportId: string) {
  if (!isAdmin()) return;
  const L = draft(state.ledger), o = ownOffice(L, officeId); if (!o) return;
  const rep = o.reports.find((r) => r.id === reportId); if (rep) toTrash(L, { kind: 'office-report', label: `${o.name} · ${rep.date}`, data: { office: { ...o, reports: [] }, report: rep }, officeId });
  o.reports = o.reports.filter((r) => r.id !== reportId);
  if (!o.reports.length) L.offices = L.offices!.filter((x) => x !== o);
  commit(L, `Removed office report`);
}
export function deleteProjects(ids: string[]) {
  if (!isAdmin()) return;
  const L = draft(state.ledger);
  for (const p of L.projects.filter((p) => ids.includes(p.id))) toTrash(L, { kind: 'project', label: `${p.code} ${p.name}`, data: p });
  L.projects = L.projects.filter((p) => !ids.includes(p.id));
  commit(L, `Deleted ${ids.length} project${ids.length > 1 ? 's' : ''}`);
}
export function upsertCountry(c: Country) {
  const L = draft(state.ledger);
  const i = L.countries.findIndex((x) => x.id === c.id);
  if (i >= 0) L.countries[i] = c; else L.countries.push(c);
  L.countries.sort((a, b) => a.name.localeCompare(b.name));
  commit(L, i >= 0 ? `Saved ${c.name}` : `Added ${c.name}`);
}
/** Removes a country; refuses while projects still reference it. */
export function deleteCountry(id: string, withProjects = false): string | null {
  const used = state.ledger.projects.filter((p) => p.country === id).length;
  if (used && !withProjects) return `${used} project${used > 1 ? 's' : ''} still use this country. Move or delete them first.`;
  if (!isAdmin()) return 'Only the admin can delete.';
  const L = draft(state.ledger);
  const c = L.countries.find((x) => x.id === id);
  if (c) toTrash(L, { kind: 'country', label: c.name, data: c, projects: L.projects.filter((p) => p.country === id) });
  L.projects = L.projects.filter((p) => p.country !== id);
  L.countries = L.countries.filter((x) => x.id !== id);
  if (state.filters.country === id) set({ filters: { ...state.filters, country: '' } });
  commit(L, `Removed ${c?.name ?? 'country'}`);
  return null;
}
let L0: Ledger | null = null;
function editProject(id: string, f: (p: Project) => void, message: string) {
  const L = draft(state.ledger);
  const p = ownProject(L, id); if (!p) return;
  L0 = L; f(p); L0 = null; commit(L, message, p.code);
}
export const upsertReport = (pid: string, r: ReportingPeriod) => lockOk(pid, r.id, 'replace it') && editProject(pid, (p) => {
  const R = p.reportingPeriods ?? (p.reportingPeriods = []);
  const i = R.findIndex((x) => x.id === r.id); if (i >= 0) R[i] = r; else R.push(r);
  R.sort((a, b) => a.date.localeCompare(b.date));
}, `Saved ${r.name}`);
export const deleteReport = (pid: string, rid: string) => lockOk(pid, rid, 'delete it') && isAdmin() && editProject(pid, (p) => { const r = p.reportingPeriods?.find((x) => x.id === rid); if (r) toTrash(L0!, { kind: 'report', label: `${r.name} (${p.code})`, data: r, pid }); p.reportingPeriods = (p.reportingPeriods ?? []).filter((r) => r.id !== rid); }, 'Report removed');
export function updateLine(pid: string, rid: string, code: string, patch: Record<string, number | string | null>) {
  if (('approved' in patch || 'actual' in patch || 'committed' in patch) && !lockOk(pid, rid, 'correct a figure in it')) return;
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
export const deleteRisk = (pid: string, id: string) => isAdmin() && editProject(pid, (p) => { const k = p.riskRegister?.find((r) => r.id === id); if (k) toTrash(L0!, { kind: 'risk', label: `${k.title} (${p.code})`, data: k, pid }); p.riskRegister = (p.riskRegister ?? []).filter((r) => r.id !== id); }, 'Risk removed');
export const setStaffOverride = (pid: string, key: string, o: import('../domain/staff').StaffOverride | null) => editProject(pid, (p) => {
  const O = p.staffOverrides ?? (p.staffOverrides = {});
  if (o) O[key] = { ...o, updatedAt: new Date().toISOString() }; else delete O[key];
}, o ? 'Contract details saved' : 'Contract details cleared');
export function replaceLedger(l: Ledger, message: string) { const L = clone(l); L.projects = L.projects.map(normalizeProject); commit(L, message); }
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
