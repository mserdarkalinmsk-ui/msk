/* ---------- people's names stay on this computer ---------- */
/** Replaces people's names with "Person n" before anything is sent, and puts them back in what comes in. One table per
 * page load, so the same person keeps the same placeholder across a conversation. */
export class Mask {
  private to = new Map<string, string>(); private back = new Map<string, string>(); private known: RegExp | null = null;
  constructor(names: string[]) {
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+').replace(/,\s*/g, ',\\s*');
    const all = [...new Set(names.flatMap((n) => { const p = n.split(','); return p.length === 2 ? [n, `${p[1].trim()} ${p[0].trim()}`, `${p[0].trim()} ${p[1].trim()}`] : [n]; }))].sort((a, b) => b.length - a.length);
    if (all.length) this.known = new RegExp(`(?<![\\p{L}])(?:${all.map(esc).join('|')})(?![\\p{L}])`, 'giu');
  }
  private key(name: string) {
    const k = name.toLowerCase().replace(/[^\p{L}]+/gu, ' ').trim().split(' ').sort().join(' ');
    let v = this.to.get(k); if (!v) { v = `Person ${this.to.size + 1}`; this.to.set(k, v); this.back.set(v, name.replace(/\s+/g, ' ').trim()); }
    return v;
  }
  /** Names of project staff, titled names (Mr / Ms / Mrs …) and "SURNAME,Given" forms. */
  hide(text: string): string {
    let t = text;
    if (this.known) t = t.replace(this.known, (m) => this.key(m));
    t = t.replace(/\b(Mr|Ms|Mrs|Miss|Dr)\.?\s+(?!Person \d)((?:[A-ZÇĞİÖŞÜ][\p{L}'-]+)(?:[ -](?:[A-ZÇĞİÖŞÜ][\p{L}'-]+)){0,3})/gu, (_, tl: string, n: string) => `${tl} ${this.key(n)}`);
    t = t.replace(/\b([A-ZÇĞİÖŞÜ]{2,}(?:[ -][A-ZÇĞİÖŞÜ]{2,})*),\s?([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:[ -][A-ZÇĞİÖŞÜ][a-zçğıöşü]+)*)/gu, (m) => this.key(m));
    return t;
  }
  show(text: string): string { return text.replace(/\bPerson (\d+)\b/g, (m) => this.back.get(m) ?? m); }
}
