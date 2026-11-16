/* Small finishing pass run with the table tidy on every change of the page: what a page writes plainly gets the
   house treatment, so every screen behaves the same without each page repeating it.
   - Download buttons (⤓ ⬇ ⎙ 🖨) that are not the page's main action are quiet (data-dl).
   - Anything clickable that is not a button or link (rows, cells, cards marked .click) can be reached with Tab and
     opened with Enter or Space. */
const DL = /^\s*(⤓|⬇|⎙|🖨|↓)/u;

export function uiPass(root: ParentNode) {
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
