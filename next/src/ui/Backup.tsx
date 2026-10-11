import { useState } from 'preact/hooks';
import { get, useStore } from '../data/store';
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

/** Slim reminder when data changed and the last backup is older than a week (or never made). */
export function BackupBanner() {
  const audit = useStore((s) => s.ledger.audit?.length ?? 0);
  const [, tick] = useState(0);
  const last = read(K), snooze = read(S);
  const days = last ? Math.floor((Date.now() - Date.parse(last)) / 86_400_000) : null;
  const lastChange = useStore((s) => s.ledger.audit?.[0]?.at);
  const changed = !last || (lastChange && lastChange > last);
  if (!audit || !changed || (days != null && days < 7) || (snooze && Date.now() < Date.parse(snooze))) return null;
  return (
    <div class="bk-banner no-print" role="status">
      <span class="bk-i">⛁</span>
      <span><b>{last ? `Last backup ${days} days ago` : 'No backup yet'}</b> — your data lives only in this browser. Save a copy to keep it safe.</span>
      <button class="btn primary" onClick={async () => { await backupNow(); tick((x) => x + 1); }}>Back up now</button>
      <button class="btn ghost" onClick={() => { write(S, new Date(Date.now() + 3 * 86_400_000).toISOString()); tick((x) => x + 1); }}>Later</button>
    </div>
  );
}
