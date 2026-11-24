import type { Attachment } from '../ui/attach';

/**
 * Attached documents (signed contracts, amendments, employment contracts) are kept once, by their content, apart from
 * the data: the ledger holds only a reference (`id`). Saving a change, the daily restore points and the folder backup
 * then never copy the files again. A full backup file carries them along (`docs`), so it still restores everything.
 */

export const isAtt = (x: unknown): x is Attachment => !!x && typeof x === 'object' && typeof (x as Attachment).name === 'string' && typeof (x as Attachment).type === 'string'
  && typeof (x as Attachment).size === 'number' && typeof (x as Attachment).at === 'string' && ('data' in (x as object) || 'id' in (x as object));

/** Parts of the ledger that never hold attachments, skipped when walking it (they are large). */
const SKIP = new Set(['projects', 'audit', 'offices', 'closes', 'formats', 'alertLog', 'checklist']);

/** A copy of `x` with each attachment replaced by what `f` returns (the same object when nothing changed). */
export function mapAtts<T>(x: T, f: (a: Attachment) => Attachment, top = true): T {
  if (isAtt(x)) return f(x) as T;
  if (Array.isArray(x)) { let ch = false; const out = x.map((v) => { const w = mapAtts(v, f, false); if (w !== v) ch = true; return w; }); return (ch ? out : x) as T; }
  if (x && typeof x === 'object') {
    let out: Record<string, unknown> | null = null;
    for (const [k, v] of Object.entries(x)) { if (top && SKIP.has(k)) continue; const w = mapAtts(v, f, false); if (w !== v) (out ??= { ...(x as Record<string, unknown>) })[k] = w; }
    return (out ?? x) as T;
  }
  return x;
}
/** Every attachment in `x`. */
export function atts(x: unknown): Attachment[] { const A: Attachment[] = []; mapAtts(x, (a) => { A.push(a); return a; }); return A; }

/** The id of a document: the start of the SHA-256 of its bytes (the same file attached twice is kept once). */
export async function docId(b64: string): Promise<string> {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', u));
  return [...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Takes the documents written into the ledger (older data, a full backup) out of it: the ledger with references, and the files by id. */
export async function liftDocs<T>(x: T): Promise<{ ledger: T; docs: Map<string, string> }> {
  const docs = new Map<string, string>(), ids = new Map<string, string>();
  for (const a of atts(x)) if (a.data && !ids.has(a.data)) ids.set(a.data, a.id ?? await docId(a.data));
  const ledger = mapAtts(x, (a) => { if (!a.data) return a; const id = ids.get(a.data)!; docs.set(id, a.data); const { data: _d, ...r } = a; return { ...r, id }; });
  return { ledger, docs };
}
