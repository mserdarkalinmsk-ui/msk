import { useState } from 'preact/hooks';
import { filtered, go, set, useStore } from '../data/store';
import { attention, burnGap, deadlines, elapsed, latestReport, money, reportsByDate, reportTotals, spendPoints } from '../domain/calc';
import { roster } from '../domain/staff';
import { SECTORS, type Project } from '../domain/types';
import { TODAY } from '../today';
import { date, month, pct, short, signedPct } from '../ui/format';
import { Sparkline } from '../ui/Sparkline';
import { Filters, ProjectTable } from './Overview';

const pref = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
export const sectorColor = (s?: string) => `var(--c${[1, 2, 3][SECTORS.indexOf(s as never)] ?? 8})`;

const SORTS: { id: string; label: string; f: (a: Project, b: Project) => number }[] = [
  { id: 'attention', label: 'Most attention', f: (a, b) => attention([b], TODAY).length - attention([a], TODAY).length },
  { id: 'pace', label: 'Furthest behind', f: (a, b) => burnGap(a, TODAY) - burnGap(b, TODAY) },
  { id: 'budget', label: 'Largest budget', f: (a, b) => money(b).budget - money(a).budget },
  { id: 'end', label: 'Ending soonest', f: (a, b) => a.end.localeCompare(b.end) },
  { id: 'name', label: 'Name', f: (a, b) => a.name.localeCompare(b.name) },
];

export function Projects() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const [view, setView] = useState(pref('pl-projects-view', 'cards'));
  const [sort, setSort] = useState(pref('pl-projects-sort', 'attention'));
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const sorted = [...P].sort(SORTS.find((x) => x.id === sort)!.f);
  return (
    <>
      <Filters />
      <div class="toolbar">
        <div class="seg" role="group" aria-label="View">
          <button aria-pressed={view === 'cards'} onClick={() => { setView('cards'); save('pl-projects-view', 'cards'); }}>▦ Cards</button>
          <button aria-pressed={view === 'list'} onClick={() => { setView('list'); save('pl-projects-view', 'list'); }}>☰ List</button>
        </div>
        {view === 'cards' && <select class="select" value={sort} aria-label="Sort" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setSort(v); save('pl-projects-sort', v); }}>{SORTS.map((x) => <option value={x.id}>Sort: {x.label}</option>)}</select>}
        <span class="muted" style={{ fontSize: '12.5px' }}>{P.length} projects</span>
        <button class="btn" style={{ marginLeft: 'auto' }} onClick={() => set({ drawer: { kind: 'import' } })}>Import project list</button>
      </div>
      {view === 'list'
        ? <section class="card" style={{ overflow: 'hidden' }}><ProjectTable rows={P} cname={cname} maxHeight={Math.max(360, innerHeight - 260)} /></section>
        : <div class="pgrid">{sorted.map((p, i) => <ProjectCard p={p} cname={cname} i={i} />)}
            <button class="pcard pcard-add" onClick={() => set({ drawer: { kind: 'new-project' } })}><span>+</span>Add project<small>reports and documents go inside each project</small></button>
          </div>}
    </>
  );
}

function ProjectCard({ p, cname, i }: { p: Project; cname: (id: string) => string; i: number }) {
  const m = money(p), el = elapsed(p, TODAY), g = burnGap(p, TODAY);
  const F = attention([p], TODAY), crit = F.filter((f) => f.severity === 'critical').length, ser = F.filter((f) => f.severity === 'serious').length;
  const R = reportsByDate(p).filter((r) => r.snapshot?.lines?.length && !/approved budget/i.test(r.type));
  const last = latestReport(p), prev = R.at(-2);
  const delta = last && prev ? reportTotals(last).actual - reportTotals(prev).actual : null;
  const age = last ? Math.round((TODAY.getTime() - Date.parse(last.date)) / 86_400_000) : null;
  const staff = roster(p, TODAY).filter((a) => a.status === 'Active').length;
  const next = deadlines(p, TODAY).find((d) => d.status !== 'submitted');
  const pts = spendPoints(p).map((x) => x.v);
  const tone = g < -0.3 || g > 0.1 ? 'serious' : g < -0.15 ? 'warning' : 'good';
  return (
    <article class="pcard" style={{ '--sc': sectorColor(p.sector), animationDelay: `${Math.min(i, 12) * 40}ms` } as Record<string, string>}
      tabIndex={0} onClick={() => go(`project/${p.id}`)} onKeyDown={(e) => e.key === 'Enter' && go(`project/${p.id}`)}>
      <header>
        <span class="num pc-code">{p.code}</span>
        <span class="pc-sector">{p.sector}</span>
        {crit + ser > 0 && <span class={`badge ${crit ? 'critical' : 'serious'}`} title={F.map((f) => f.title).join('\n')} style={{ marginLeft: 'auto' }}>{crit + ser}</span>}
      </header>
      <h3>{p.name}</h3>
      <div class="pc-meta">{cname(p.country)} · {month(p.start)} → {month(p.end)}{p.bh && <> · BH <span class="num">{p.bh}</span></>}</div>
      <div class="pc-money">
        <div><b class="num">{short(m.spent)}</b><span>of {short(m.budget)}</span></div>
        <span class={`badge ${tone}`}>{signedPct(g)}</span>
      </div>
      <div class="meter" title={`${pct(m.budget ? m.spent / m.budget : 0)} spent · ${pct(el)} of time`}>
        <span style={{ width: `${Math.min(100, (m.spent / (m.budget || 1)) * 100)}%`, background: 'var(--sc)' }} />
        <span style={{ left: `${Math.min(100, (m.spent / (m.budget || 1)) * 100)}%`, width: `${Math.min(100, (m.committed / (m.budget || 1)) * 100)}%`, background: 'var(--sc)', opacity: .35 }} />
        <i class="tick" style={{ left: `calc(${el * 100}% - 1px)` }} />
      </div>
      <div class="pc-spark"><Sparkline values={pts.length > 1 ? pts : [0, 0]} color="var(--sc)" height={30} /></div>
      <footer>
        <span title="Change in cumulative spend since the previous report">{delta != null ? <><b class="num">+{short(delta)}</b> since last report</> : 'first report'}</span>
        <span class={age != null && age > 150 ? 'stale' : ''} title={last ? `Latest figures: ${last.name}` : 'No figures yet'}>{age != null ? `data ${age} d old` : 'no data'}</span>
        <span>{staff} staff</span>
        {next && <span class={next.status === 'overdue' ? 'stale' : ''}>{next.status === 'overdue' ? 'report overdue' : `report due ${date(next.due)}`}</span>}
      </footer>
    </article>
  );
}
