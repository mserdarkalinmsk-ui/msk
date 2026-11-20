import { useEffect, useState } from 'preact/hooks';

/**
 * "On this page": on a page longer than about two screens, a button at the bottom right lists its sections (the card
 * headings) and takes you to one. It floats, so the page's own layout never moves.
 */
export function PageIndex({ route }: { route: string }) {
  const [S, setS] = useState<{ el: HTMLElement; t: string }[]>([]), [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
    const main = document.getElementById('content'); if (!main) return;
    let t = 0;
    const read = () => { clearTimeout(t); t = window.setTimeout(() => {
      const H = [...main.querySelectorAll<HTMLElement>('.card-h h2, .card > h2')].filter((h) => h.offsetParent && h.textContent?.trim());
      const long = document.documentElement.scrollHeight > innerHeight * 2.2;
      setS(long && H.length >= 4 ? H.map((h) => ({ el: h, t: h.textContent!.trim().replace(/\s+/g, ' ') })) : []);
    }, 400); };
    read(); const mo = new MutationObserver(read); mo.observe(main, { childList: true, subtree: true });
    return () => { mo.disconnect(); clearTimeout(t); };
  }, [route]);
  if (!S.length) return null;
  const go = (el: HTMLElement) => { setOpen(false); const y = el.getBoundingClientRect().top + scrollY - 84; scrollTo({ top: y, behavior: 'smooth' }); };
  return <div class="pidx no-print">
    {open && <ul class="pidx-l" role="menu">{S.map((x) => <li role="menuitem" onClick={() => go(x.el)}>{x.t}</li>)}<li class="pidx-top" role="menuitem" onClick={() => { setOpen(false); scrollTo({ top: 0, behavior: 'smooth' }); }}>↑ Top of the page</li></ul>}
    <button class="pidx-b" aria-expanded={open} onClick={() => setOpen(!open)} title="Sections of this page">☰ On this page · {S.length}</button>
  </div>;
}
