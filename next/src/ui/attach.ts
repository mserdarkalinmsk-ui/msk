import { saveFile } from './save';

/** A document kept with a record (a signed contract, an employment contract): in this browser and in backups, never in git. */
export interface Attachment { name: string; type: string; size: number; at: string; data: string }
export const MAX_ATTACH = 8 * 1024 * 1024;

export async function readAttachment(file: File): Promise<Attachment | string> {
  if (file.size > MAX_ATTACH) return `${file.name} is larger than 8 MB; attach a smaller copy (a scan at lower resolution, or the signed pages only).`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { name: file.name, type: file.type || 'application/octet-stream', size: file.size, at: new Date().toISOString(), data: btoa(bin) };
}
export function openAttachment(a: Attachment) {
  const bin = atob(a.data), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return saveFile(a.name, new Blob([u], { type: a.type }));
}
