/** Password protection for shared copies: PBKDF2 (250 000 rounds, SHA-256) → AES-256-GCM. Without the password the data cannot be read. */
export interface Sealed { salt: string; iv: string; data: string }
const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function key(pw: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 250_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function seal(text: string, pw: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pw, salt), new TextEncoder().encode(text)));
  return { salt: b64(salt), iv: b64(iv), data: b64(data) };
}
/** Returns null when the password is wrong (the GCM tag does not verify). */
export async function open(s: Sealed, pw: string): Promise<string | null> {
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, await key(pw, unb64(s.salt)), unb64(s.data))); } catch { return null; }
}
