import { saveFile } from './save';
import { getDoc, putDoc, toast } from '../data/store';
import { docId } from '../data/docs';

/** A document kept with a record (a signed contract, an employment contract): in this browser and in backups, never in git. */
/** The file itself is kept apart, once, under `id` (data/docs); `data` is only there for a document attached before that, or in transit. */
export interface Attachment { name: string; type: string; size: number; at: string; id?: string; data?: string }
export const MAX_ATTACH = 8 * 1024 * 1024;

export async function readAttachment(file: File): Promise<Attachment | string> {
  if (file.size > MAX_ATTACH) return `${file.name} is larger than 8 MB; attach a smaller copy (a scan at lower resolution, or the signed pages only).`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const data = btoa(bin), id = await docId(data), a = { name: file.name, type: file.type || 'application/octet-stream', size: file.size, at: new Date().toISOString() };
  // kept apart once; when this browser refuses to store it, it stays with the record so nothing is lost
  return (await putDoc(id, data)) ? { ...a, id } : { ...a, data };
}
export async function openAttachment(a: Attachment) {
  const data = a.data || (a.id ? await getDoc(a.id) : undefined);
  if (!data) { toast(`${a.name} is not in this browser: restore a full backup (Back up now) that holds it, or attach it again.`); return; }
  const bin = atob(data), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return saveFile(a.name, new Blob([u], { type: a.type }));
}
