import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/**
 * The copy's status (shared copy, backup) as small chips in the top bar instead of bands over every page. A click
 * opens the full notices with their buttons; a backup that needs doing shows its chip in the warning colour.
 */
export function StatusTray({ children }: { children: ComponentChildren }) {
  const panel = useRef<HTMLDivElement>(null), wrap = useRef<HTMLDivElement>(null);
  const [chips, setChips] = useState<{ t: string; warn: boolean }[]>([]), [open, setOpen] = useState(false);
  useEffect(() => {
    const el = panel.current; if (!el) return;
    const read = () => setChips([...el.querySelectorAll<HTMLElement>('.bk-banner')].map((b) => ({ t: (b.querySelector('b')?.textContent ?? 'Notice').trim(), warn: !b.classList.contains('sh-banner') })));
    read(); const mo = new MutationObserver(read); mo.observe(el, { childList: true, subtree: true, characterData: true }); return () => mo.disconnect();
  }, []);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    addEventListener('mousedown', off); return () => removeEventListener('mousedown', off);
  }, [open]);
  return <div class="st-tray no-print" ref={wrap}>
    {chips.length > 0 && <button class="st-btn" aria-expanded={open} onClick={() => setOpen(!open)} title="Status of this copy">
      {chips.map((c) => <span class={`st-chip${c.warn ? ' warn' : ''}`}><i />{c.t}</span>)}<span class="st-car" aria-hidden="true">▾</span></button>}
    <div class={`st-panel${open ? ' on' : ''}`} ref={panel}>{children}</div>
  </div>;
}
