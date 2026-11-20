import { download } from './xlsxwrite';
/* Every small table (table.mini) can be taken to Excel or printed on its own: one floating button, shown on hover,
   so no page has to add its own. Tables of the data grid have their own export and are left alone. */
const AMT = /^[−-]?\s*[€$£]?\s*[−-]?\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?\s*%?$|^[−-]?[€$£]?\d+(?:\.\d+)?%?$/;
const num = (s: string) => { const neg = /^[−-]/.test(s.trim()); const v = Number(s.replace(/[^\d.]/g, '')); return neg ? -v : v; };

/** The cells of a table as rows, numbers kept as numbers (money columns with two decimals). */
export function tableRows(t: HTMLTableElement): { rows: (string | number)[][]; money: number[] } {
  const R = [...t.rows].filter((r) => !r.closest('[hidden]')).map((r) => [...r.cells].map((c) => (c.innerText || c.textContent || '').replace(/\s+/g, ' ').trim()));
  const head = t.tHead ? t.tHead.rows.length : 0, body = R.slice(head);
  const n = Math.max(...R.map((r) => r.length));
  const isNum = Array.from({ length: n }, (_, i) => { const v = body.map((r) => r[i] ?? '').filter((x) => x && x !== '—'); return v.length > 0 && v.every((x) => AMT.test(x)); });
  const money = isNum.map((x, i) => (x && body.some((r) => /€|\.\d\d\b/.test(r[i] ?? '')) ? i : -1)).filter((i) => i >= 0);
  return { rows: R.map((r, k) => r.map((x, i) => (k >= head && isNum[i] && x && x !== '—' && !/%$/.test(x) ? num(x) : x))), money };
}

function titleOf(t: HTMLElement) {
  const h = t.closest('section, .card, details, .drawer')?.querySelector('h2, h3, summary');
  return (h?.textContent ?? 'table').replace(/[^\p{L}\p{N} &-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'table';
}

export function tableTools(): () => void {
  const bar = document.createElement('div'); bar.className = 'tt-bar no-print'; bar.hidden = true;
  bar.innerHTML = '<button type="button" data-k="x" title="This table to Excel">⤓ Excel</button><button type="button" data-k="p" title="Print this table">⎙ Print</button>';
  document.body.appendChild(bar);
  let cur: HTMLTableElement | null = null, hide = 0;
  const place = () => { if (!cur) return; const r = cur.getBoundingClientRect(); bar.style.top = `${Math.max(4, r.top - 30)}px`; bar.style.left = `${Math.max(4, r.right - bar.offsetWidth)}px`; };
  const over = (e: Event) => {
    const t = (e.target as HTMLElement)?.closest?.('table.mini') as HTMLTableElement | null;
    if (t && t.tBodies[0]?.rows.length >= 2 && !t.closest('.dt, .tt-none, .digest, .palette')) { clearTimeout(hide); cur = t; bar.hidden = false; place(); }
    else if (!(e.target as HTMLElement)?.closest?.('.tt-bar')) { clearTimeout(hide); hide = window.setTimeout(() => { bar.hidden = true; cur = null; }, 400); }
  };
  const click = (e: Event) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b || !cur) return;
    const name = titleOf(cur);
    if (b.dataset.k === 'x') { const { rows, money } = tableRows(cur); download(`${name}.xlsx`, [{ name: name.slice(0, 31), money, rows }]); }
    else { const w = window.open('', '_blank'); if (!w) return; w.document.write(`<!doctype html><meta charset="utf-8"><title>${name}</title><style>body{font:12px system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:4px 8px;text-align:left}td.r,th.r{text-align:right}</style><h2>${name}</h2>${cur.outerHTML}`); w.document.close(); w.focus(); w.print(); }
  };
  addEventListener('mouseover', over); addEventListener('scroll', place, true); bar.addEventListener('click', click);
  return () => { removeEventListener('mouseover', over); removeEventListener('scroll', place, true); bar.remove(); };
}
