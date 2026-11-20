import { MON } from '../domain/dt';
import { useEffect, useState } from 'preact/hooks';
import { get, kv, onSaved, replaceLedger, set, toast, useStore } from '../data/store';
import { migrateBackup } from '../domain/insights';
import { validateLedger } from '../domain/calc';
import type { Ledger } from '../domain/types';
import { saveFile } from './save';
import { askPassword } from './ask';
import type { Sealed } from './crypto';

const K = 'pl-last-backup', S = 'pl-backup-snooze';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

/* ---------- password protection ---------- */
// With a password set, every backup (the file and the folder copies) is encrypted: without it the file cannot be read.
let pw: string | null | undefined;
async function password(): Promise<string | null> { if (pw === undefined) pw = (await kv<string>('backup-pw')) ?? null; return pw; }
export async function setBackupPassword(p: string | null) { pw = p; await kv('backup-pw', p); write('pl-backup-protected', p ? '1' : ''); changed(); if (await folder()) await writeToFolder(); }
interface ProtectedBackup { app: 'portfolio-ledger'; protected: true; at: string; projects: number; enc: Sealed }
const isProtected = (x: unknown): x is ProtectedBackup => !!x && typeof x === 'object' && (x as ProtectedBackup).protected === true && !!(x as ProtectedBackup).enc;
/** The backup as it is written: plain JSON, or encrypted when a password is set. */
async function payload(pretty?: boolean): Promise<Blob> {
  const L = get().ledger, text = JSON.stringify(L, null, pretty ? 2 : undefined), p = await password();
  if (!p) return new Blob([text], { type: 'application/json' });
  const { seal } = await import('./crypto');
  const out: ProtectedBackup = { app: 'portfolio-ledger', protected: true, at: new Date().toISOString(), projects: L.projects.length, enc: await seal(text, p) };
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}
/**
 * Reads a backup file: a protected one is opened with the saved password, else the password is asked.
 * Returns the parsed content, or null when the user cancelled.
 */
export async function readBackup(text: string): Promise<unknown | null> {
  const j = JSON.parse(text) as unknown;
  if (!isProtected(j)) return j;
  const { open } = await import('./crypto');
  const saved = await password(), first = saved ? await open(j.enc, saved) : null;
  if (first != null) return JSON.parse(first);
  let plain: string | null = null;
  const got = await askPassword({ title: 'Protected backup', text: `This backup${j.at ? ` of ${new Date(j.at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}` : ''} is encrypted. Enter the password it was saved with.`, ok: 'Open',
    check: async (v) => ((plain = await open(j.enc, v)) == null ? 'Wrong password.' : null) });
  return got == null || plain == null ? null : JSON.parse(plain);
}

/** Saves the whole ledger as a backup file and remembers when. */
export async function backupNow() {
  const d = new Date().toISOString();
  await saveFile(`portfolio-ledger-${d.slice(0, 10)}.json`, await payload(true));
  write(K, d); changed();
}

onSaved(() => scheduleFolderBackup());

/* ---------- automatic backup to a folder (Chrome / Edge) ---------- */
// The folder handle is kept with the data; the browser asks again for permission after it is restarted.
type Dir = { name: string; queryPermission(o: object): Promise<string>; requestPermission(o: object): Promise<string>; getFileHandle(n: string, o?: object): Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }>; getFile(): Promise<File> }>; values(): AsyncIterable<{ kind: string; name: string }>; removeEntry(n: string): Promise<void> };
const RW = { mode: 'readwrite' };
const FILE = /^portfolio-ledger-(\d{4}-\d{2}-\d{2})\.json$/;
export const folderSupported = () => typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function' && window.top === window.self;
let dir: Dir | null | undefined, timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());
async function folder(): Promise<Dir | null> { if (dir === undefined) dir = (await kv<Dir>('backup-dir')) ?? null; return dir; }
export async function folderState(): Promise<{ name: string; ok: boolean } | null> {
  const d = await folder(); if (!d) return null;
  try { return { name: d.name || 'selected folder', ok: (await d.queryPermission(RW)) === 'granted' }; } catch { return { name: d.name || 'selected folder', ok: false }; }
}
/** Lets the user pick the folder; the first backup is written at once. */
export async function chooseFolder() {
  try {
    const d = await (window as unknown as { showDirectoryPicker(o: object): Promise<Dir> }).showDirectoryPicker({ ...RW, id: 'pl-backup' });
    dir = d; await kv('backup-dir', d); await writeToFolder(); toast(`Automatic backup on: folder “${d.name || 'selected folder'}”`); changed();
  } catch (e) { if ((e as Error).name !== 'AbortError') toast('This browser cannot save to a folder — use “Back up now”'); }
}
export async function stopFolder() { dir = null; await kv('backup-dir', null); changed(); toast('Automatic backup off'); }
/** Asks again for the permission the browser dropped after a restart (needs a click). */
export async function resumeFolder() {
  const d = await folder(); if (!d) return;
  if ((await d.requestPermission(RW)) === 'granted') { await writeToFolder(); toast('Automatic backup resumed'); }
  changed();
}
/** Writes today's file (one per day, overwritten during the day); keeps the last 60. */
async function writeToFolder(): Promise<boolean> {
  const d = await folder(); if (!d) return false;
  try {
    if ((await d.queryPermission(RW)) !== 'granted') return false;
    const day = new Date().toISOString().slice(0, 10), f = await d.getFileHandle(`portfolio-ledger-${day}.json`, { create: true });
    const blob = await payload(), w = await f.createWritable(); await w.write(blob); await w.close();
    // Read back: the copy counts only when the file on disk has the size that was written.
    const back = await f.getFile().catch(() => null);
    write('pl-backup-verified', back && back.size === blob.size ? '1' : '');
    write(K, new Date().toISOString()); write('pl-backup-folder-at', new Date().toISOString());
    const old: string[] = []; for await (const e of d.values()) if (e.kind === 'file' && FILE.test(e.name)) old.push(e.name);
    for (const n of old.sort().slice(0, Math.max(0, old.length - 60))) await d.removeEntry(n).catch(() => {});
    changed(); return true;
  } catch { return false; }
}
/** Called after every saved change: the folder copy follows 20 seconds after the last change. */
export function scheduleFolderBackup() { clearTimeout(timer); timer = setTimeout(() => { void writeToFolder(); }, 20_000); }
/** The newest backup in the folder, to restore on a new computer or after browser data was cleared. */
export async function restoreFromFolder() {
  try {
    const d = await (window as unknown as { showDirectoryPicker(o: object): Promise<Dir> }).showDirectoryPicker({ mode: 'read', id: 'pl-backup' });
    const names: string[] = []; for await (const e of d.values()) if (e.kind === 'file' && FILE.test(e.name)) names.push(e.name);
    const last = names.sort().at(-1); if (!last) { toast('No Portfolio Ledger backup in that folder'); return; }
    const raw = await readBackup(await (await (await d.getFileHandle(last)).getFile()).text()); if (raw == null) return;
    const { ledger } = migrateBackup(raw);
    if (validateLedger(ledger).length) { toast(`${last} could not be read`); return; }
    const L = ledger as Ledger;
    if (!confirm(`Restore ${last}: ${L.projects.length} projects, ${L.projects.reduce((a, p) => a + (p.reportingPeriods?.length ?? 0), 0)} reports?`)) return;
    replaceLedger(L, `Restored from backup ${last}`); set({ fresh: false });
  } catch (e) { if ((e as Error).name !== 'AbortError') toast('The folder could not be read'); }
}
export function useFolder() {
  const [st, setSt] = useState<{ name: string; ok: boolean } | null | undefined>(undefined);
  useEffect(() => { const f = () => { void folderState().then(setSt); }; f(); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return st;
}

const when = (iso: string) => { const d = new Date(iso), t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
  return days <= 0 ? `today ${t}` : days === 1 ? `yesterday ${t}` : days < 7 ? `${days} days ago` : `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
export type SafetyLevel = 'safe' | 'due' | 'risk';
/** Where the data stands: saved outside the browser (and how recently), or only here. */
export function useSafety() {
  const st = useFolder(), [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  const last = read(K), lastChange = useStore((s) => s.ledger.audit?.[0]?.at);
  const since = useStore((s) => (last ? (s.ledger.audit ?? []).filter((a) => a.at > last).length : s.ledger.audit?.length ?? 0));
  const days = last ? Math.floor((Date.now() - Date.parse(last)) / 86_400_000) : null;
  const pending = !!lastChange && (!last || lastChange > last);
  const level: SafetyLevel = st?.ok ? 'safe' : !last ? (since ? 'risk' : 'due') : !pending ? 'safe' : days! >= 7 || since >= 25 ? 'risk' : 'due';
  const text = st?.ok ? `Saved to “${st.name}”${last ? ` · ${when(last)}` : ''}` : st ? 'Automatic backup paused' : !last ? 'No backup yet' : `Backed up ${when(last)}${pending && since ? ` · ${since} change${since === 1 ? '' : 's'} since` : ''}`;
  return { level, text, folder: st, last, since, pending, protected: read('pl-backup-protected') === '1', verified: read('pl-backup-verified') === '1' };
}

/** The backup state in one line of the sidebar; opens Import / backup. */
export function BackupStatus({ onOpen }: { onOpen: () => void }) {
  const s = useSafety();
  if (s.folder === undefined) return null;
  return <button class={`bk-status ${s.level}`} onClick={onOpen} title="Open Import / backup"><i /><span>{s.text}</span></button>;
}

/** Data safety, shown in Import / backup: where the data stands, the backup file, the automatic folder copy and its password. */
export function DataSafety() {
  const s = useSafety(), st = s.folder, at = read('pl-backup-folder-at');
  const head = s.level === 'safe' ? 'Your data is backed up' : s.level === 'due' ? 'Backup due' : 'Your data lives only in this browser';
  const setPw = async () => {
    const p = await askPassword({ title: 'Protect backups with a password', text: 'Every backup file and folder copy is encrypted from now on. Keep the password somewhere safe: without it a protected backup cannot be opened by anyone, including you.', twice: true, ok: 'Protect backups' });
    if (p) { await setBackupPassword(p); toast('Backups are password-protected from now on'); }
  };
  return (
    <section class="card ds">
      <div class={`ds-head ${s.level}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.2 7.9 8 9 4.8-1.1 8-4.5 8-9V6z" />{s.level === 'safe' ? <path d="m9 12 2 2 4-4" /> : <path d="M12 8v5M12 16h.01" />}</svg>
        <div><b>{head}</b><span>{s.text}{s.level === 'safe' && st?.ok && s.verified ? ' · copy checked after writing' : ''}{s.protected ? ' · password-protected' : ''}</span></div>
      </div>
      <div class="ds-row">
        <div><b>Backup file</b><span>One file with everything: projects, reports, documents, history. Keep it outside this computer.</span></div>
        <button class="btn primary" onClick={() => void backupNow()}>Back up now</button>
      </div>
      <div class="ds-row">
        <div><b>Automatic backup</b>
          {!folderSupported() ? <span>Works when the file is opened in Chrome or Edge on the computer.</span>
            : !st ? <span>Choose a folder once (OneDrive or a shared drive): a copy is saved there after every change, one file per day, the last 60 days kept.</span>
            : <span>Folder <b>“{st.name}”</b> · {st.ok ? (at ? `last saved ${when(at)}` : 'on') : <em class="ds-warn">paused — the browser needs your permission again</em>}</span>}</div>
        {folderSupported() && (!st ? <button class="btn" onClick={() => void chooseFolder()}>Choose backup folder…</button>
          : <span class="ds-btns">{!st.ok && <button class="btn primary" onClick={() => void resumeFolder()}>Resume</button>}<button class="btn" onClick={() => void chooseFolder()}>Change folder</button><button class="btn ghost danger" onClick={() => void stopFolder()}>Turn off</button></span>)}
      </div>
      <div class="ds-row">
        <div><b>Password protection</b><span>{s.protected ? 'On — backup files and folder copies are encrypted (AES-256). They open only with the password.' : 'Off — a backup file can be read by anyone who has it. Turn it on when copies go to a shared drive or by e-mail.'}</span></div>
        {s.protected ? <span class="ds-btns"><button class="btn" onClick={() => void setPw()}>Change password</button><button class="btn ghost danger" onClick={() => { if (confirm('Turn off password protection? New backups will be readable without a password; the ones already saved stay protected.')) void setBackupPassword(null).then(() => toast('Password protection off')); }}>Turn off</button></span>
          : <button class="btn" onClick={() => void setPw()}>Set a password…</button>}
      </div>
    </section>
  );
}

/** First opening in a browser with nothing saved: offer to bring the data back before anyone starts over. */
export function FreshStart() {
  const fresh = useStore((s) => s.fresh && !(s.ledger.audit?.length));
  if (!fresh) return null;
  return (
    <div class="bk-fresh no-print" role="status">
      <div><b>No saved data in this browser yet.</b> If you used Portfolio Ledger before — on this computer or another — restore your backup first, so nothing is entered twice.</div>
      <div class="bk-fresh-a">
        {folderSupported() && <button class="btn primary" onClick={() => void restoreFromFolder()}>Restore from backup folder…</button>}
        <button class={`btn ${folderSupported() ? '' : 'primary'}`} onClick={() => set({ drawer: { kind: 'import' } })}>Restore a backup file…</button>
        <button class="btn ghost" onClick={() => set({ fresh: false })}>Start without a backup</button>
      </div>
    </div>
  );
}

/** Slim reminder when data changed and the last backup is older than a week (or never made). */
export function BackupBanner() {
  const audit = useStore((s) => s.ledger.audit?.length ?? 0);
  const [, tick] = useState(0);
  const last = read(K), snooze = read(S);
  const days = last ? Math.floor((Date.now() - Date.parse(last)) / 86_400_000) : null;
  const lastChange = useStore((s) => s.ledger.audit?.[0]?.at);
  const changed = !last || (lastChange && lastChange > last);
  // Many changes since the last backup (a big import day) prompt sooner than the weekly reminder.
  const since = useStore((s) => (last ? (s.ledger.audit ?? []).filter((a) => a.at > last).length : 0));
  const folderSt = useFolder();
  if (folderSt && !folderSt.ok && audit) return (
    <div class="bk-banner no-print" role="status">
      <span class="bk-i">⛁</span>
      <span><b>Automatic backup paused</b> — the browser asks once more for permission to save to “{folderSt.name}”.</span>
      <button class="btn primary" onClick={() => void resumeFolder()}>Resume backup</button>
    </div>
  );
  if (folderSt?.ok) return null;
  if (!audit || !changed || (days != null && days < 7 && since < 25) || (snooze && Date.now() < Date.parse(snooze))) return null;
  return (
    <div class="bk-banner no-print" role="status">
      <span class="bk-i">⛁</span>
      <span><b>{!last ? 'No backup yet' : since >= 25 && days! < 7 ? `${since} changes since your last backup` : `Last backup ${days} days ago`}</b> — your data lives only in this browser. {folderSupported() ? 'Turn on the automatic backup: choose a folder (OneDrive or a shared drive) once, and a copy is saved there after every change.' : 'Save a copy to keep it safe.'}</span>
      {folderSupported() && <button class="btn primary" onClick={() => void chooseFolder()}>Turn on automatic backup…</button>}
      <button class={`btn ${folderSupported() ? '' : 'primary'}`} onClick={async () => { await backupNow(); tick((x) => x + 1); }}>Back up now</button>
      <button class="btn ghost" onClick={() => { write(S, new Date(Date.now() + 3 * 86_400_000).toISOString()); tick((x) => x + 1); }}>Later</button>
    </div>
  );
}
