import { useEffect, useMemo, useState } from 'preact/hooks';
import { get, go, set, setTheme, undo, useStore } from '../data/store';
import { ROUTES } from './Shell';
import { lines } from '../domain/calc';
import { roster } from '../domain/staff';
import { TODAY } from '../today';
import { short } from './format';
import type { Project } from '../domain/types';
import { plabel } from '../domain/label';
import { dmy } from '../domain/dt';
import { providerIndex } from '../domain/entity';
import { providerPOs } from '../domain/providers';
import { personKeyOf } from '../domain/coreTeam';
import { openPerson, openProvider } from './EntityPanel';

interface Cmd { group: string; label: string; hint?: string; run: () => void; /** the same person met twice (core team and a project) is listed once */ id?: string }

export function Palette() {
  const open = useStore((s) => s.palette);
  const projects = useStore((s) => s.ledger.projects);
  const countries = useStore((s) => s.ledger.countries);
  const poKinds = useStore((s) => s.ledger.poKinds), FW = useStore((s) => s.ledger.frameworks), core = useStore((s) => s.ledger.coreTeam);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); set({ palette: !get().palette }); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement).closest('input,textarea,select')) { e.preventDefault(); undo(); }
      else if (e.key === 'Escape') set({ palette: false });
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  // Cleared when it closes, not after it opens: what is typed straight after Ctrl+K must not be wiped by a late reset.
  useEffect(() => { if (!open) { setQ(''); setI(0); } }, [open]);
  // autofocus is honoured only once per page load: the box is focused as soon as it is in the page, or the first keys are lost
  const box = (el: HTMLInputElement | null) => { if (el && document.activeElement !== el) el.focus(); };

  const cmds: Cmd[] = useMemo(() => [
    { group: 'Actions', label: 'Add project', hint: 'N', run: () => set({ drawer: { kind: 'new-project' } }) },
    { group: 'Actions', label: 'Add country', run: () => set({ drawer: { kind: 'countries', edit: 'new' } }) },
    { group: 'Actions', label: 'Manage countries', run: () => set({ drawer: { kind: 'countries' } }) },
    { group: 'Actions', label: 'Smart import: reports, budgets, DoA, contracts (many files or a folder)', run: () => set({ drawer: { kind: 'import' } }) },
    { group: 'Actions', label: 'Import Excel, CSV or backup', run: () => set({ drawer: { kind: 'import' } }) },
    { group: 'Actions', label: 'Undo last change', hint: 'Ctrl Z', run: undo },
    { group: 'Actions', label: 'Appearance: design direction, accent, density', run: () => set({ drawer: { kind: 'appearance' } }) },
    { group: 'Actions', label: 'Rules & thresholds: flexibility, pace, line limits, report age', run: () => set({ drawer: { kind: 'rules' } }) },
    { group: 'Actions', label: 'Alert centre: open, handled and snoozed alerts', run: () => go('reports/alerts') },
    { group: 'Actions', label: 'Theme: light', run: () => setTheme('light') },
    { group: 'Actions', label: 'Theme: dark', run: () => setTheme('dark') },
    { group: 'Actions', label: 'Theme: follow system', run: () => setTheme('auto') },
    ...ROUTES.map((r) => ({ group: 'Go to', label: r.label, run: () => go(r.id) })),
    ...[['wp', 'Work Plans'], ['staffpo', 'Staff POs'], ['heat', 'Headings heat map'], ['pack', 'Monthly pack'], ['compare', 'Expenditure monitoring'], ['studio', 'Project report'], ['alerts', 'Alerts'], ['changes', 'Month comparison'], ['calendar', 'Calendar'], ['compliance', 'Compliance & results'], ['history', 'Change history'], ['health', 'Data health'], ['commit', 'Commitments (open POs)'], ['units', 'Unit costs benchmark'], ['closure', 'Closure tracker'], ['annual', 'Annual cash plan'], ['deck', 'Presentation']].map(([k, l]) => ({ group: 'Reports', label: l, run: () => go(`reports/${k}`) })),
    ...countries.map((c) => ({ group: 'Filter by country', label: c.name, run: () => { set((s) => ({ filters: { ...s.filters, country: c.id } })); } })),
    ...projects.map((p) => ({ group: 'Projects', label: `${p.code} — ${p.name}${p.bh ? ` · BH ${p.bh}` : ''}${p.pmm ? ` · PMM ${p.pmm}` : ''}${p.mae ? ` · MAE ${p.mae}` : ''}`, run: () => go(`project/${p.id}`) })),
    ...projects.map((p) => ({ group: 'Import report', label: `Import report for ${p.code}`, run: () => set({ drawer: { kind: 'report', projectId: p.id } }) })),
  ], [projects, countries]);
  // Deep results: budget lines and people, searched only once something is typed.
  const deep: Cmd[] = useMemo(() => {
    const tab = (id: string, t: string) => () => { go(`project/${id}`); setTimeout(() => dispatchEvent(new CustomEvent('pl-tab', { detail: t })), 60); };
    const lab = (p: Project) => (plabel(p));
    const SCREENS: [string, string][] = [['wp', 'Work Plan'], ['statement', 'Financial statement'], ['checks', 'Entry checks'], ['budget', 'vs approved budget'], ['bydate', 'Spending by date'], ['pos', 'Open POs'], ['staff', 'Staff'], ['docs', 'Documents'], ['forecast', 'Forecast & revision'], ['reports', 'Reports']];
    return [
      ...projects.flatMap((p) => SCREENS.map(([k, t]) => ({ group: 'Project screens', label: `${lab(p)} · ${p.code} ${p.name} — ${t}`, run: () => go(`project/${p.id}/${k}`) }))),
      ...projects.flatMap((p) => (p.workPlans ?? []).map((w) => ({ group: 'Work Plans', label: `${lab(p)} · ${w.label && w.no <= 0 ? `WP ${w.label}` : `WP ${w.no}`} ${dmy(w.from)} – ${dmy(w.to)}`, hint: short(w.planned), run: () => go(`project/${p.id}/wp`) }))),
      ...projects.flatMap((p) => { const w = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.workbook).at(-1)?.snapshot?.workbook; return (w?.pos ?? []).map((o) => ({ group: 'Purchase orders', label: `${lab(p)} · PO ${o.po} ${o.line} ${o.description} ${o.supplier}`, hint: short(o.sc), run: () => go(`project/${p.id}/pos`) })); }),
      ...projects.flatMap((p) => lines(p).map((l) => ({ group: 'Budget lines', label: `${plabel(p)} · ${l.code} ${l.description ?? ''}`, hint: short(l.approved ?? 0), run: tab(p.id, 'Budget lines') }))),
      ...Object.entries(core ?? {}).flatMap(([c, M]) => M.map((m) => ({ group: 'People', label: `${m.name} — ${m.position} · core team ${countries.find((x) => x.id === c)?.name ?? c}`, hint: m.end ? `until ${dmy(m.end)}` : 'open-ended', id: personKeyOf(m.name), run: () => openPerson(personKeyOf(m.name)) }))),
      ...projects.flatMap((p) => roster(p, TODAY).map((a) => ({ group: 'People', label: `${a.display} — ${a.position} · ${plabel(p)}`, hint: a.status, id: personKeyOf(a.name), run: () => openPerson(personKeyOf(a.name)) }))),
    ];
  }, [projects, open, core]);
  // providers and contracts come first among the deep results: a firm's card gathers its orders, projects and contract
  const firms: Cmd[] = useMemo(() => !open ? [] : [
    ...providerIndex(providerPOs(projects, poKinds ?? {}, true)).map((x) => ({ group: 'Providers', label: x.name, hint: `${x.n} orders · ${short(x.sc)}`, run: () => openProvider(x.key) })),
    ...Object.entries(FW ?? {}).map(([k, c]) => ({ group: 'Contracts', label: `${c.name ?? k}${c.ref ? ` · ${c.ref}` : ''}${c.kind ? ` · ${c.kind}` : ''}`, hint: c.end ? `ends ${dmy(c.end)}` : c.openEnded ? 'open-ended' : '', run: () => openProvider(k.startsWith('office:') ? k.split(':').slice(3).join(':') : k) })),
  ], [projects, poKinds, FW, open]);

  const qq = q.trim().toLowerCase();
  const match = (c: Cmd) => qq.split(/\s+/).every((w) => c.label.toLowerCase().includes(w));
  const people = (L: Cmd[]) => L.filter((c, i) => !c.id || L.findIndex((x) => x.id === c.id) === i);
  const list = qq ? [...cmds.filter(match), ...(qq.length >= 2 ? [...firms.filter(match).slice(0, 12), ...people(deep.filter(match)).slice(0, 40)] : [])] : cmds;
  if (!open) return null;
  const run = (c?: Cmd) => { if (!c) return; set({ palette: false }); c.run(); };
  let lastGroup = '';
  return (
    <>
      <div class="scrim" style={{ zIndex: 50 }} onClick={() => set({ palette: false })} />
      <div class="palette" role="dialog" aria-label="Command palette">
        <input ref={box} autoFocus placeholder="Search projects, providers, people, POs, contracts, budget lines, pages…" value={q} role="combobox" aria-expanded="true" aria-controls="pal-list"
          onInput={(e) => { setQ((e.target as HTMLInputElement).value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(list.length - 1, x + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            if (e.key === 'Enter') run(list[i]);
          }} />
        <ul id="pal-list" role="listbox">
          {list.map((c, k) => {
            const head = c.group !== lastGroup ? <div class="grp">{c.group}</div> : null; lastGroup = c.group;
            return (<>{head}<li role="option" aria-selected={k === i} onMouseEnter={() => setI(k)} onClick={() => run(c)}>{c.label}{c.hint && <span class="k">{c.hint}</span>}</li></>);
          })}
          {!list.length && <li class="muted">Nothing matches “{q}”</li>}
        </ul>
      </div>
    </>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div class="toast">{t.text}{t.undo && <button onClick={() => { set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })); t.undo!(); }}>Undo</button>}</div>
      ))}
    </div>
  );
}
