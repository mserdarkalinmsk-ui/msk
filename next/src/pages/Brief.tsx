import { Ico } from '../ui/Ico';
import { go, useStore } from '../data/store';
import { burnGap, elapsed, money } from '../domain/calc';
import { flexOf, pctOf } from '../domain/flex';
import { alerts } from '../domain/insights';
import { plabel } from '../domain/label';
import { staffCount, staffSplit } from '../domain/staff';
import { followUp, wpName } from '../domain/workplan';
import { openAlerts } from '../domain/worklist';
import { TODAY } from '../today';
import { Chart } from '../ui/Chart';
import { exportOk } from '../ui/exportGate';
import { date, full, pct, short } from '../ui/format';
import { headingOption, headsOf, latestWorkbook, reportWorkbook } from './FinancialReport';

/**
 * One-page project brief (A4): who and when, the headline figures, every heading against its budget, what needs
 * attention and the latest Work Plan — everything from the app's own figures, with the report it comes from.
 */
export function Brief({ id }: { id: string }) {
  const p = useStore((s) => s.ledger.projects.find((x) => x.id === id));
  const L = useStore((s) => s.ledger);
  if (!p) return <div class="card empty-page"><div><h2>Project not found</h2></div></div>;
  const m = money(p), el = elapsed(p, TODAY), gap = burnGap(p, TODAY), wb = reportWorkbook(p), rep = latestWorkbook(p);
  const heads = wb ? headsOf(wb) : [];
  const flex = flexOf(p), staff = staffCount([p], TODAY);
  const country = L.countries.find((c) => c.id === p.country)?.name ?? p.country;
  const sev = { critical: 0, serious: 1, warning: 2 } as const;
  const open = openAlerts(alerts([p], TODAY), L.alertMarks, TODAY).sort((a, b) => sev[a.severity] - sev[b.severity]);
  const wps = [...(p.workPlans ?? [])].sort((a, b) => a.from.localeCompare(b.from)), wp = wps.at(-1);
  const f = wp && wb ? followUp(p, wb, wp, wps) : null;
  const asAt = wb?.meta.situationDate || wb?.meta.asAt || rep?.date;
  const ids = [p.bh && `BH ${p.bh}`, p.pmm && `PMM ${p.pmm}`, p.jp && `JP ${p.jp}`, p.mae && `MAE ${p.mae}`].filter(Boolean).join(' · ');
  const print = () => { if (exportOk(p, 'the one-page brief')) window.print(); };
  return (
    <>
      <div class="brief-bar no-print">
        <button class="btn" onClick={() => go(`project/${p.id}/summary`)}>← {plabel(p)}</button>
        <span class="grow" />
        <span class="muted">One A4 page · print or save as PDF</span>
        <button class="btn primary" onClick={print}><Ico n="print" />Print / save as PDF</button>
      </div>
      <article class="brief">
        <header class="br-h">
          <div class="br-org">{L.brand?.logo && <img src={L.brand.logo} alt="" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />}<div><b>{L.brand?.title ?? ''}</b><span>{L.brand?.name ?? ''}</span></div></div>
          <div class="br-id"><span>{ids}</span><span>{country}{p.sector ? ` · ${p.sector}` : ''}</span></div>
        </header>
        <h1 class="br-t">{p.name}</h1>
        <p class="br-sub">{date(p.start)} → {date(p.end)} · {pct(el)} of the time gone{asAt ? ` · figures as at ${date(asAt)}` : ''}</p>

        <section class="br-k">
          <div><span>Total budget</span><b>{full(m.budget)}</b><small>{staff.total ? `${staff.total} staff · ${staffSplit(staff)}` : ' '}</small></div>
          <div class="lead"><span>Spent</span><b>{full(m.spent)}</b><small>{pct(m.budget ? m.spent / m.budget : 0)} of the budget</small><i class="br-m"><em style={{ width: `${Math.min(100, (m.budget ? m.spent / m.budget : 0) * 100)}%` }} /><u style={{ left: `${Math.min(100, el * 100)}%` }} /></i></div>
          <div><span>Spent + committed</span><b>{full(m.exposure)}</b><small>{full(m.committed)} committed</small></div>
          <div><span>Uncommitted balance</span><b>{full(m.remaining)}</b><small>{pct(m.budget ? m.remaining / m.budget : 0)} of the budget</small></div>
          <div data-tone={gap < -0.15 ? 'bad' : gap < -0.05 ? 'warn' : undefined}><span>Pace vs time</span><b>{gap >= 0 ? '+' : '−'}{Math.abs(Math.round(gap * 100))} pp</b><small>{gap < 0 ? 'behind' : 'ahead of'} the time gone</small></div>
        </section>

        {heads.length > 0 && <section class="br-s">
          <h2>Budget by heading</h2>
          <p>Each heading against its own budget · flexibility between headings {pctOf(flex)}% · the line marks the time gone</p>
          <Chart height={Math.max(150, heads.length * 34 + 40)} label="Budget by heading" option={(t) => headingOption(t, heads, flex, el)} />
        </section>}

        <div class="br-2">
          <section class="br-s">
            <h2>Needs attention</h2>
            {open.length ? <ul class="br-a">{open.slice(0, 6).map((a) => <li class={a.severity}><b>{a.title}</b><span>{a.detail}</span></li>)}</ul> : <p class="br-ok">Nothing open: no alert waiting for a decision.</p>}
            {open.length > 6 && <p class="br-more">and {open.length - 6} more in the work list</p>}
          </section>
          <section class="br-s">
            <h2>Work Plan</h2>
            {f && wp ? <table class="br-wp"><tbody>
              <tr><th>{wpName(wp)}</th><td>{date(wp.from)} → {date(wp.to)}</td></tr>
              <tr><th>Planned (activities)</th><td>{full(wp.planned)}</td></tr>
              <tr><th>Activity budget left after it</th><td>{full(f.remaining)}</td></tr>
              {f.prev && <tr><th>Previous {wpName(f.prev)}: spent</th><td>{f.prevSpent == null ? '—' : `${full(f.prevSpent)} of ${full(f.prev.planned)}`}</td></tr>}
              {f.prev && <tr><th>Previous {wpName(f.prev)}: spent + committed</th><td>{f.prevSc == null ? '—' : full(f.prevSc)}</td></tr>}
            </tbody></table> : <p class="br-ok">No Work Plan entered for this project.</p>}
          </section>
        </div>

        <footer class="br-f">
          <span>Source: {wb?.fileName ?? rep?.fileName ?? 'no report workbook on file'}{asAt ? ` · as at ${date(asAt)}` : ''}</span>
          <span>{plabel(p)} · {short(m.budget)} · prepared {date(TODAY.toISOString().slice(0, 10))}</span>
        </footer>
      </article>
    </>
  );
}
