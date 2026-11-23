import { useState } from 'preact/hooks';
import { go } from '../data/store';
import { TODAY } from '../today';
import { date } from './format';
import { MON } from '../domain/dt';

/* A calendar of dated items, seen by week, by month, by year or as a list. Items of one kind on one day (twenty yearly
   contracts ending on 31 December) are one entry; a click opens the screen the item belongs to. */
export interface CalItem { day: string; kind: string; title: string; sub?: string; where?: string; tone?: 'bad' | 'warn' | 'info'; go?: string }
export interface CalKind { k: string; label: string; color: string; many: (n: number) => string }
type View = 'week' | 'month' | 'year' | 'list';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const at = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const monday = (d: Date) => addDays(d, -((d.getUTCDay() + 6) % 7));
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekNo = (d: Date) => { const t = addDays(d, 3 - ((d.getUTCDay() + 6) % 7)); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); return 1 + Math.round(((t.getTime() - y.getTime()) / 864e5 - 3 + ((y.getUTCDay() + 6) % 7)) / 7); };

/** The entries of a day: one per item, or one per kind when a kind has more than two items that day. */
export function dayEntries(items: CalItem[], K: CalKind[]): { kind: string; title: string; sub?: string; tone?: CalItem['tone']; go?: string; n: number; items: CalItem[] }[] {
  const by = new Map<string, CalItem[]>(); for (const x of items) by.set(x.kind, [...(by.get(x.kind) ?? []), x]);
  return K.flatMap((k) => { const L = by.get(k.k) ?? []; if (!L.length) return [];
    if (L.length <= 2) return L.map((x) => ({ kind: k.k, title: x.title, sub: x.sub, tone: x.tone, go: x.go, n: 1, items: [x] }));
    const where = [...new Set(L.map((x) => x.where).filter(Boolean))];
    return [{ kind: k.k, title: k.many(L.length), sub: where.length > 3 ? `${where.slice(0, 3).join(', ')} +${where.length - 3}` : where.join(', '), tone: L.some((x) => x.tone === 'bad') ? 'bad' as const : L[0].tone, go: L[0].go, n: L.length, items: L }]; });
}

export function CalendarView({ items, kinds, title, extra }: { items: CalItem[]; kinds: CalKind[]; title: string; extra?: import('preact').ComponentChildren }) {
  const [view, setView] = useState<View>(() => { try { return (localStorage.getItem('pl-cal-view') as View) || 'month'; } catch { return 'month'; } });
  const [cur, setCur] = useState(iso(TODAY));
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [openDay, setOpenDay] = useState(''), [years, setYears] = useState(1);
  const today = iso(TODAY), d0 = at(cur);
  const K = kinds.filter((k) => !off[k.k]);
  const I = items.filter((x) => !off[x.kind]);
  const byDay = new Map<string, CalItem[]>(); for (const x of I) byDay.set(x.day, [...(byDay.get(x.day) ?? []), x]);
  const color = (k: string) => kinds.find((x) => x.k === k)?.color ?? 'var(--ink-3)';
  const setV = (v: View) => { setView(v); try { localStorage.setItem('pl-cal-view', v); } catch { /* the view still changes */ } };
  const step = (n: number) => { const d = at(cur); if (view === 'week') setCur(iso(addDays(d, 7 * n))); else if (view === 'year') setCur(`${d.getUTCFullYear() + n}-01-01`); else setCur(iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)))); };
  const head = view === 'week' ? (() => { const m = monday(d0), e = addDays(m, 6); return `Week ${weekNo(m)} · ${m.getUTCDate()} ${MON[m.getUTCMonth()]} – ${e.getUTCDate()} ${MON[e.getUTCMonth()]} ${e.getUTCFullYear()}`; })()
    : view === 'year' ? String(d0.getUTCFullYear()) : view === 'month' ? `${MONTHS[d0.getUTCMonth()]} ${d0.getUTCFullYear()}` : 'From today';
  const open = (e: { go?: string }) => { if (e.go) go(e.go); };
  const Entry = ({ e, full }: { e: ReturnType<typeof dayEntries>[number]; full?: boolean }) =>
    <button class={`cv-e ag-e t-${e.tone ?? 'info'}${full ? ' full' : ''}`} style={{ '--k': color(e.kind) } as never} title={`${e.title}${e.sub ? ` · ${e.sub}` : ''}`} onClick={(ev) => { ev.stopPropagation(); open(e); }}>
      <i aria-hidden="true" /><span class="cv-t">{e.title}</span>{full && e.sub && <small>{e.sub}</small>}</button>;

  const Month = () => { const first = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1)), start = monday(first);
    return <div class="cv-month"><div class="cv-wd">{WD.map((w) => <span>{w}</span>)}</div>
      <div class="cv-grid">{Array.from({ length: 42 }, (_, i) => { const d = addDays(start, i), s = iso(d), E = dayEntries(byDay.get(s) ?? [], K), out = d.getUTCMonth() !== d0.getUTCMonth();
        return <div class={`cv-day${out ? ' out' : ''}${s === today ? ' today' : ''}${E.length ? ' has' : ''}`} onClick={() => E.length && setOpenDay(openDay === s ? '' : s)}>
          <span class="cv-n">{d.getUTCDate()}</span>
          {E.slice(0, 3).map((e) => <Entry e={e} />)}{E.length > 3 && <span class="cv-more">+{E.length - 3} more</span>}
          {openDay === s && <div class="cv-pop" onClick={(ev) => ev.stopPropagation()}><b>{date(s)}</b>{E.map((e) => <Entry e={e} full />)}</div>}
        </div>; })}</div></div>; };

  const Week = () => { const m = monday(d0);
    return <div class="cv-week">{Array.from({ length: 7 }, (_, i) => { const d = addDays(m, i), s = iso(d), E = dayEntries(byDay.get(s) ?? [], K);
      return <div class={`cv-wcol${s === today ? ' today' : ''}`}><div class="cv-wh"><span>{WD[i]}</span><b>{d.getUTCDate()}</b><small>{MON[d.getUTCMonth()]}</small></div>
        <div class="cv-wb">{E.length ? E.map((e) => <Entry e={e} full />) : <span class="cv-none">—</span>}</div></div>; })}</div>; };

  const Year = () => { const y = d0.getUTCFullYear();
    return <div class="cv-year">{Array.from({ length: 12 }, (_, mi) => { const first = new Date(Date.UTC(y, mi, 1)), start = monday(first), n = I.filter((x) => x.day.startsWith(`${y}-${String(mi + 1).padStart(2, '0')}`)).length;
      return <button class={`cv-mini${y === TODAY.getUTCFullYear() && mi === TODAY.getUTCMonth() ? ' now' : ''}`} onClick={() => { setCur(iso(first)); setV('month'); }}>
        <span class="cv-mh"><b>{MONTHS[mi]}</b>{n > 0 && <em>{n}</em>}</span>
        <span class="cv-mg">{WD.map((w) => <i class="wd">{w[0]}</i>)}{Array.from({ length: 42 }, (_, i) => { const d = addDays(start, i), s = iso(d), E = byDay.get(s) ?? [], inM = d.getUTCMonth() === mi;
          const k = E.find((x) => x.tone === 'bad')?.kind ?? E[0]?.kind;
          return <i class={`${inM ? '' : 'out'}${s === today ? ' today' : ''}${inM && E.length ? ' ev' : ''}`} style={inM && k ? { '--k': color(k) } as never : undefined} title={inM && E.length ? `${date(s)}: ${E.length} item${E.length > 1 ? 's' : ''}` : undefined}>{inM ? d.getUTCDate() : ''}</i>; })}</span>
      </button>; })}</div>; };

  const List = () => {
    // what is late: one line per kind and place, the oldest date first; then the coming months, a year at a time
    const late = I.filter((x) => x.day < today && x.tone === 'bad'), g = new Map<string, CalItem[]>();
    for (const x of late) g.set(`${x.kind}|${x.where ?? ''}`, [...(g.get(`${x.kind}|${x.where ?? ''}`) ?? []), x]);
    const L = [...g.values()].map((X) => ({ ...X.sort((a, b) => a.day.localeCompare(b.day))[0], n: X.length })).sort((a, b) => a.day.localeCompare(b.day));
    const end = iso(new Date(Date.UTC(TODAY.getUTCFullYear() + years, TODAY.getUTCMonth(), TODAY.getUTCDate())));
    const fut = [...byDay.keys()].filter((s) => s >= today).sort(), days = fut.filter((s) => s <= end), months = [...new Set(days.map((s) => s.slice(0, 7)))];
    return <div class="cv-list">
      {L.length > 0 && <div class="cv-lm cv-late"><h3>Overdue</h3>{L.map((x) => { const k = kinds.find((y) => y.k === x.kind);
        return <div class="cv-ld"><span class="cv-ldd"><b>{at(x.day).getUTCDate()}</b><small>{MON[at(x.day).getUTCMonth()]} {String(at(x.day).getUTCFullYear()).slice(2)}</small></span>
          <div class="cv-lde"><Entry e={{ kind: x.kind, title: x.n > 1 && k ? `${k.many(x.n)} · ${x.where}` : x.title, sub: x.n > 1 ? `the oldest due ${date(x.day)}` : x.sub, tone: 'bad', go: x.go, n: x.n, items: [x] }} full /></div>
          <span class="cv-in late">{Math.round((at(today).getTime() - at(x.day).getTime()) / 864e5)} d late</span></div>; })}</div>}
      {months.map((m) => <div class="cv-lm"><h3>{MONTHS[+m.slice(5) - 1]} {m.slice(0, 4)}</h3>
        {days.filter((s) => s.startsWith(m)).map((s) => { const d = at(s), dd = Math.round((d.getTime() - at(today).getTime()) / 864e5);
          return <div class="cv-ld"><span class="cv-ldd"><b>{d.getUTCDate()}</b><small>{WD[(d.getUTCDay() + 6) % 7]}</small></span>
            <div class="cv-lde">{dayEntries((byDay.get(s) ?? []).filter((x) => !(x.day < today)), K).map((e) => <Entry e={e} full />)}</div>
            <span class={`cv-in${dd <= 30 ? ' soon' : ''}`}>{dd === 0 ? 'today' : `in ${dd} d`}</span></div>; })}</div>)}
      {!L.length && !months.length && <p class="muted">Nothing dated from today on.</p>}
      {fut.length > days.length && <button class="btn ghost cv-next" onClick={() => setYears(years + 1)}>Show the following year ({fut.length - days.length} more dates)</button>}
    </div>; };

  return <section class="card cv"><div class="card-h cv-h"><div><h2>{title}</h2><p>Report deadlines, contract ends, planned activity ends and project ends · click an item to open it</p></div></div>
    <div class="cv-bar">
      <div class="cv-nav">{view !== 'list' && <><button class="btn" onClick={() => setCur(today)}>Today</button><button class="btn icon ghost" aria-label="Previous" onClick={() => step(-1)}>‹</button><button class="btn icon ghost" aria-label="Next" onClick={() => step(1)}>›</button></>}<b class="cv-title">{head}</b></div>
      <div class="cv-right">{extra}<div class="seg cv-views" role="group" aria-label="View">{([['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['list', 'List']] as const).map(([k, l]) => <button aria-pressed={view === k} onClick={() => setV(k)}>{l}</button>)}</div></div>
    </div>
    <div class="cv-kinds">{kinds.map((k) => { const n = items.filter((x) => x.kind === k.k).length; return n ? <button class="cv-k" aria-pressed={!off[k.k]} onClick={() => setOff({ ...off, [k.k]: !off[k.k] })}><i style={{ background: k.color }} />{k.label}<small>{n}</small></button> : null; })}</div>
    <div class="card-b">{view === 'month' ? <Month /> : view === 'week' ? <Week /> : view === 'year' ? <Year /> : <List />}</div>
  </section>;
}
