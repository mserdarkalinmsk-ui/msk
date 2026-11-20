import { dayMonYear } from '../domain/dt';
/* Small finishing pass run with the table tidy on every change of the page: what a page writes plainly gets the
   house treatment, so every screen behaves the same without each page repeating it.
   - Download buttons (⤓ ⬇ ⎙ 🖨) that are not the page's main action are quiet (data-dl).
   - Dates stored as 2026-10-15 show as 15 Oct 2026.
   - Anything clickable that is not a button or link (rows, cells, cards marked .click) can be reached with Tab and
     opened with Enter or Space. */
const DL = /^\s*(⤓|⬇|⎙|🖨|↓)/u;
const ISO = /\b(20\d\d)-(\d\d)-(\d\d)\b/g;
/** Dates written in data as 2026-10-15 (report names, notes, file facts) read as every other date on screen. */
function isoText(root: ParentNode) {
  const el = root instanceof Element ? root : (root as Document).body; if (!el) return;
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue && /20\d\d-\d\d-\d\d/.test(n.nodeValue) && !n.parentElement?.closest('input, textarea, code, pre, [contenteditable], [data-raw], .side') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const hit: Text[] = []; let n: Node | null; while ((n = w.nextNode())) hit.push(n as Text);
  for (const t of hit) t.nodeValue = t.nodeValue!.replace(ISO, (m) => { const d = new Date(m + 'T00:00:00Z'); return isNaN(d.getTime()) ? m : dayMonYear(d); });
}

export function uiPass(root: ParentNode) {
  isoText(root);
  root.querySelectorAll<HTMLElement>('.btn:not(.primary)').forEach((b) => {
    const dl = DL.test(b.textContent ?? '');
    if (dl !== b.hasAttribute('data-dl')) { if (dl) b.setAttribute('data-dl', ''); else b.removeAttribute('data-dl'); }
  });
  root.querySelectorAll<HTMLElement>('.click:not(button):not(a):not([tabindex])').forEach((e) => {
    e.tabIndex = 0; if (!e.getAttribute('role')) e.setAttribute('role', 'button');
  });
}

/** Enter or Space on a focused clickable element does what a click does. */
export function keyClicks(): () => void {
  const k = (ev: KeyboardEvent) => {
    const t = ev.target as HTMLElement | null;
    if (!t || (ev.key !== 'Enter' && ev.key !== ' ') || !t.classList?.contains('click') || t.matches('button, a, input, select, textarea')) return;
    ev.preventDefault(); t.click();
  };
  addEventListener('keydown', k);
  return () => removeEventListener('keydown', k);
}
