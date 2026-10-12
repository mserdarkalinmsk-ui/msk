import { filtered, get, go, set, setCheck, useStore } from '../data/store';
import { monthTasks, type Task } from '../domain/checklist';
import { TODAY } from '../today';
import { month } from '../ui/format';
import { events } from './Agenda';
import { officeRows } from './OfficeSummary';

const GROUPS: Task['group'][] = ['Data', 'Reports', 'Staff', 'Offices', 'Close the month'];
const ICON: Record<Task['group'], string> = { Data: '⇩', Reports: '▤', Staff: '☺', Offices: '⌂', 'Close the month': '✓' };

/** This month's checklist: what the data says is still to do, ticked automatically when the data proves it. */
export function Checklist() {
  const s = useStore((x) => x);
  const P = filtered(s), m = TODAY.toISOString().slice(0, 7);
  const L = { ...s.ledger, projects: P };
  const T = monthTasks(L, TODAY, { events: events(P), officeRequests: officeRows(get().ledger.offices ?? []).map((r) => ({ o: r.o, request: r.request, date: r.r.date })) });
  const ticks = s.ledger.checklist?.[m] ?? {};
  const isDone = (t: Task) => (t.auto ? !!t.done : !!ticks[t.key]);
  const done = T.filter(isDone).length, pct = T.length ? done / T.length : 1;
  return (
    <div class="ck">
      <section class="card ck-h">
        <div><div class="muted ck-k">Monthly checklist · {month(TODAY.getTime())}</div><h2>{done} of {T.length} done</h2>
          <p class="muted">Built from the data: a fresh report for every running project, open data issues, deadlines and contracts in the next 45 days, office budgets and the monthly close. Items marked <span class="badge neutral">auto</span> tick themselves when the data shows they are done.</p></div>
        <div class="ck-ring" style={{ '--p': `${Math.round(pct * 100)}` } as Record<string, string>}><b>{Math.round(pct * 100)}%</b></div>
      </section>
      {GROUPS.map((g) => { const G = T.filter((t) => t.group === g); if (!G.length) return null; const d = G.filter(isDone).length; return (
        <section class="card ck-g">
          <div class="card-h"><div><h2><span class="ck-i">{ICON[g]}</span>{g}</h2><p>{d} of {G.length} done</p></div></div>
          <ul class="ck-l">{G.sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || (a.due ?? '').localeCompare(b.due ?? '')).map((t) => { const ok = isDone(t); return (
            <li class={ok ? 'done' : ''}>
              <label class="ck-box"><input type="checkbox" checked={ok} disabled={t.auto} onChange={(e) => setCheck(m, t.key, (e.target as HTMLInputElement).checked)} title={t.auto ? 'Ticks itself from the data' : 'Tick when done'} /></label>
              <div class="ck-t"><b>{t.title}</b><small class="muted">{t.detail}</small></div>
              {t.auto && <span class="badge neutral">auto</span>}
              {t.due && !ok && t.due < TODAY.toISOString().slice(0, 10) && <span class="badge critical">overdue</span>}
              {(t.pid || t.to || t.importer) && !ok && <button class="linkish no-print ck-go" onClick={() => (t.importer ? set({ drawer: { kind: 'import' } }) : go(t.to ?? `project/${t.pid}`))}>{t.importer ? 'Import →' : 'Open →'}</button>}
            </li>); })}</ul>
        </section>); })}
    </div>
  );
}
