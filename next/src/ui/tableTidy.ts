/* One look for every table, whichever page drew it: a column of figures is right-aligned with even-width digits
   (its header too), and a long table keeps its header in view while the page scrolls. Pages keep writing plain
   tables; this pass reads what a column holds and marks it. A table opts out with data-raw. */

/** An amount, a percentage, a count or a signed figure — not a line code such as 1.3 or 2.1.4. */
const FIGURE = /^[−\-+(]?\s?[€$£]?\s?[−\-]?(\d{1,3}(,\d{3})+(\.\d+)?|\d+\.\d{2}|\d+(\.\d+)?\s?%|\d{1,4}|\d+(\.\d+)?\s?[KMk]|\d+(\.\d+)?\s?(pp|mo|d))\)?\s?(€|%)?$/;
const EMPTY = /^(—|–|-|n\/a)?$/;

export const isFigure = (t: string) => FIGURE.test(t.replace(/\u00a0/g, ' ').trim());

/** Cells that hold a control or a drawing are left as drawn. */
const plain = (c: HTMLTableCellElement) => !c.querySelector('input, select, textarea, svg, canvas, div, ul, button:not(.link)');

const seen = new WeakMap<HTMLTableElement, string>();

function tidyTable(t: HTMLTableElement) {
  if (t.dataset.raw != null) return;
  const body = [...t.tBodies].flatMap((b) => [...b.rows]);
  if (!body.length) return;
  // Unchanged since the last pass: nothing to do.
  const sig = () => `${body.length}:${(t.textContent ?? '').length}:${t.querySelectorAll('.tnum').length}`;
  if (seen.get(t) === sig()) return;
  // Columns are counted only on rows without merged cells, so an index means the same column on every row.
  const flat = body.filter((r) => [...r.cells].every((c) => c.colSpan === 1));
  const cols = Math.max(0, ...flat.map((r) => r.cells.length));
  const figures: boolean[] = [];
  for (let i = 0; i < cols; i++) {
    let n = 0, f = 0;
    for (const r of flat) {
      const c = r.cells[i]; if (!c) continue;
      const s = c.innerText.trim(); if (EMPTY.test(s)) continue;
      n++; if (isFigure(s) && plain(c)) f++;
    }
    figures[i] = n > 0 && f / n >= 0.6;
  }
  const mark = (head: boolean) => (r: HTMLTableRowElement) => {
    if (![...r.cells].every((c) => c.colSpan === 1)) return;
    [...r.cells].forEach((c, i) => { if (figures[i] && (head ? !c.querySelector('input, select') : plain(c)) && !c.classList.contains('tnum')) c.classList.add('tnum'); });
  };
  flat.forEach(mark(false));
  if (t.tHead) [...t.tHead.rows].forEach(mark(true));
  if (t.tFoot) [...t.tFoot.rows].forEach(mark(false));
  seen.set(t, sig());
  // A long table on the page itself (not inside its own scroll box) keeps its header under the top bar.
  if (body.length > 15 && t.tHead && !t.classList.contains('stick')) {
    let scrolls = false;
    for (let e = t.parentElement; e && !e.classList.contains('main'); e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { scrolls = true; break; }
    }
    const own = t.tHead.rows[0]?.cells[0] && getComputedStyle(t.tHead.rows[0].cells[0]).position === 'sticky';
    if (!scrolls && !own) t.classList.add('stick');
  }
}

/** Watches the page and tidies tables as they appear or change; returns the stop function. */
export function watchTables(root: HTMLElement) {
  let queued = 0;
  const run = () => { queued = 0; root.querySelectorAll('table').forEach((t) => tidyTable(t as HTMLTableElement)); };
  const obs = new MutationObserver(() => { if (!queued) queued = requestAnimationFrame(run); });
  obs.observe(root, { childList: true, subtree: true, characterData: true });
  run();
  return () => { obs.disconnect(); if (queued) cancelAnimationFrame(queued); };
}
