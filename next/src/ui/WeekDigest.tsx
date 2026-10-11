import { useState } from 'preact/hooks';
import { go, useStore } from '../data/store';
import { events, type Ev } from '../pages/Agenda';
import { moves } from '../pages/Pack';
import { TODAY } from '../today';
import { date } from './format';
import { saveFile } from './save';

const KEY = 'pl-digest-seen';
const iso = (d: Date) => d.toISOString().slice(0, 10);
const lab = (e: Ev) => (e.p.bh ? `BH ${e.p.bh}` : e.p.code);
const COLOR: Record<Ev['kind'], string> = { report: '#e5484d', contract: '#8e4ec6', activity: '#f5a524', project: '#3b82c4' };

/** Calendar items as an .ics file for phone or Outlook calendars (all-day events). */
export function downloadIcs(E: Ev[]) {
  const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const d8 = (s: string) => s.replace(/-/g, '');
  const next = (s: string) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d8(iso(d)); };
  const body = E.map((e, i) => ['BEGIN:VEVENT', `UID:pl-${e.kind}-${e.p.id}-${e.day}-${i}@portfolio-ledger`, `DTSTAMP:${d8(iso(TODAY))}T000000Z`, `DTSTART;VALUE=DATE:${d8(e.day)}`, `DTEND;VALUE=DATE:${next(e.day)}`,
    `SUMMARY:${esc(`${lab(e)} · ${e.title}`)}`, `DESCRIPTION:${esc(`${e.p.name} — ${e.sub}`)}`, `CATEGORIES:${e.kind}`, 'END:VEVENT'].join('\r\n'));
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Portfolio Ledger//EN', 'CALSCALE:GREGORIAN', ...body, 'END:VCALENDAR'].join('\r\n');
  saveFile(`portfolio-calendar-${iso(TODAY)}.ics`, new Blob([ics], { type: 'text/calendar' }));
}

/** Once a day on opening: what is overdue, what falls in the next 7 days, and which projects moved to a weaker band. */
export function WeekDigest() {
  const P = useStore((s) => s.ledger.projects);
  const [show, setShow] = useState(() => { try { const v = localStorage.getItem(KEY); return v !== 'off' && v !== iso(TODAY); } catch { return false; } });
  if (!show || !P.length) return null;
  const today = iso(TODAY), wk = new Date(TODAY); wk.setUTCDate(wk.getUTCDate() + 7);
  const E = events(P);
  const over = E.filter((e) => e.day < today && e.tone === 'bad');
  const week = E.filter((e) => e.day >= today && e.day <= iso(wk));
  const order = ['blue', 'green', 'amber', 'red'];
  const worse = moves(P).filter((x) => x.was && order.indexOf(x.now) > order.indexOf(x.was));
  const close = () => { try { localStorage.setItem(KEY, today); } catch { /* */ } setShow(false); };
  if (!over.length && !week.length && !worse.length) return null;
  const item = (e: Ev) => <li style={{ borderLeftColor: COLOR[e.kind] }} onClick={() => { close(); go(`project/${e.p.id}`); }}><span class="num">{date(e.day)}</span><b>{lab(e)}</b><span>{e.title}</span><small class="muted">{e.sub}</small></li>;
  return (
    <>
      <div class="scrim" style={{ zIndex: 60 }} onClick={close} />
      <div class="digest" role="dialog" aria-label="This week">
        <div class="dg-h"><div><h2>This week</h2><p class="muted">{date(today)} – {date(iso(wk))}</p></div><button class="btn ghost" onClick={close} aria-label="Close">✕</button></div>
        {over.length > 0 && <section class="dg-s bad"><h3>Overdue · {over.length}</h3><ul>{over.slice(0, 8).map(item)}</ul></section>}
        {worse.length > 0 && <section class="dg-s warn"><h3>Moved to a weaker band</h3><ul>{worse.map((x) => <li style={{ borderLeftColor: '#e5484d' }} onClick={() => { close(); go(`project/${x.p.id}`); }}><b>{x.p.bh ? `BH ${x.p.bh}` : x.p.code}</b><span>{x.was} → {x.now}</span><small class="muted">{Math.round(x.perf * 100)}% of plan</small></li>)}</ul></section>}
        <section class="dg-s"><h3>Next 7 days · {week.length}</h3>{week.length ? <ul>{week.slice(0, 12).map(item)}</ul> : <p class="muted">Nothing scheduled.</p>}</section>
        <div class="dg-f"><button class="btn" onClick={() => downloadIcs(E.filter((e) => e.day >= today))}>📅 Add all dates to my calendar (.ics)</button><button class="btn" onClick={() => { close(); go('reports/calendar'); }}>Open calendar</button><button class="btn primary" onClick={close}>Got it</button></div>
      </div>
    </>
  );
}
