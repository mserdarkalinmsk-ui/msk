/**
 * What a table shows only on hover (a cell's or a badge's title) opens on a click too, in a small box beside it: on a
 * touch screen there is no hover, and a hint nobody finds is no help. Elements that do something on a click keep it.
 */
const TARGET = 'td[title], th[title], span[title], b[title], small[title], em[title], i[title], strong[title], .badge[title], .kpi [title]';
const ACTIVE = 'button, a, input, select, textarea, label, summary, [role="button"], .click, .ent, tr.click, [contenteditable], .seg';
let box: HTMLDivElement | null = null, from: Element | null = null, openedAt = 0;

function close() { box?.remove(); box = null; from = null; }
function open(el: Element, text: string) {
  close();
  box = document.createElement('div'); box.className = 'tap-tip'; box.setAttribute('role', 'tooltip'); box.textContent = text;
  document.body.append(box); from = el; openedAt = Date.now();
  const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
  const left = Math.max(8, Math.min(innerWidth - b.width - 8, r.left + r.width / 2 - b.width / 2));
  const below = r.bottom + 6 + b.height < innerHeight;
  box.style.left = `${left + scrollX}px`; box.style.top = `${(below ? r.bottom + 6 : r.top - b.height - 6) + scrollY}px`;
}

export function installTapTips() {
  document.addEventListener('click', (e) => {
    const t = e.target as Element | null;
    if (!t || box?.contains(t)) return;
    const el = t.closest(TARGET);
    // something that acts on a click keeps its own behaviour; outside the pages and drawers nothing changes
    if (!el || !el.closest('main, .drawer') || t.closest(ACTIVE) || el.closest(ACTIVE)) { close(); return; }
    const text = el.getAttribute('title')?.trim();
    if (!text) { close(); return; }
    if (from === el) { close(); return; }
    open(el, text);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // a page still gliding from the click that opened the box does not close it; a scroll by the reader does
  addEventListener('scroll', () => { if (Date.now() - openedAt > 600) close(); }, { passive: true, capture: true });
  addEventListener('hashchange', close);
}
