import { useEffect, useState } from 'preact/hooks';
import { get, kv, onSaved, replaceLedger, set, toast, useStore } from '../data/store';
import { migrateBackup } from '../domain/insights';
import { validateLedger } from '../domain/calc';
import type { Ledger } from '../domain/types';
import { saveFile } from './save';

const K = 'pl-last-backup', S = 'pl-backup-snooze';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

/** Saves the whole ledger as a JSON backup and remembers when. */
export async function backupNow() {
  const d = new Date().toISOString();
  await saveFile(`portfolio-ledger-${d.slice(0, 10)}.json`, new Blob([JSON.stringify(get().ledger, null, 2)], { type: 'application/json' }));
  write(K, d);
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
    const w = await f.createWritable(); await w.write(new Blob([JSON.stringify(get().ledger)], { type: 'application/json' })); await w.close();
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
    const { ledger } = migrateBackup(JSON.parse(await (await (await d.getFileHandle(last)).getFile()).text()));
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

/** Automatic backup settings, shown in Import / backup. */
export function FolderBackup() {
  const st = useFolder(), at = read('pl-backup-folder-at');
  if (!folderSupported()) return <p class="muted" style={{ margin: 0, fontSize: '12.5px' }}>Automatic backup to a folder works when the file is opened in Chrome or Edge on the computer.</p>;
  return (
    <div class="bk-auto">
      <b>Automatic backup</b>
      {!st ? <><span class="muted">Choose a folder (e.g. OneDrive or a shared drive): a copy is saved there after every change, one file per day, the last 60 days kept.</span>
        <button class="btn primary" onClick={() => void chooseFolder()}>Choose backup folder…</button></>
        : <><span>Folder <b>“{st.name}”</b> · {st.ok ? (at ? `last saved ${new Date(at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : 'on') : <span style={{ color: 'var(--serious)' }}>paused — the browser needs your permission again</span>}</span>
          <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{!st.ok && <button class="btn primary" onClick={() => void resumeFolder()}>Resume</button>}
            <button class="btn" onClick={() => void chooseFolder()}>Change folder</button><button class="btn ghost danger" onClick={() => void stopFolder()}>Turn off</button></span></>}
    </div>
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
      <span><b>{!last ? 'No backup yet' : since >= 25 && days! < 7 ? `${since} changes since your last backup` : `Last backup ${days} days ago`}</b> — your data lives only in this browser. Save a copy to keep it safe.</span>
      <button class="btn primary" onClick={async () => { await backupNow(); tick((x) => x + 1); }}>Back up now</button>
      <button class="btn ghost" onClick={() => { write(S, new Date(Date.now() + 3 * 86_400_000).toISOString()); tick((x) => x + 1); }}>Later</button>
    </div>
  );
}
