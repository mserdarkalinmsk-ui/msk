import { useState } from 'preact/hooks';
import { crossDocs, SOURCES } from '../domain/crossdocs';
import type { Project } from '../domain/types';
import { date, full } from './format';

/** One figure per row as each document gives it; a row that does not agree is marked, with the difference. */
export function CrossDocsCard({ p }: { p: Project }) {
  const X = crossDocs(p);
  const [all, setAll] = useState(false);
  if (X.sources.length < 2) return null;
  // Figures that differ come first; those that agree stay folded unless asked for (or when nothing differs).
  const bad = X.rows.filter((r) => !r.ok), good = X.rows.filter((r) => r.ok), shown = all || !bad.length ? [...bad, ...good] : bad;
  const show = (v: number | string | undefined, money: boolean) => v == null ? <span class="muted">—</span> : money ? full(Number(v)) : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? date(String(v)) : String(v);
  return (
    <section class="card span-12 xdocs">
      <div class="card-h"><div><h2>Documents agree?</h2>
        <p>{X.bad ? `${X.bad} figure${X.bad > 1 ? 's differ' : ' differs'} between documents` : `${X.rows.filter((r) => !r.only).length} figures compared, all the same in each document`} · {X.sources.map((s) => `${SOURCES[s]}${X.names[s] ? `: ${X.names[s]}` : ''}`).join(' · ')}</p></div>
        <span class={`badge ${X.bad ? 'warning' : 'good'}`} style={{ marginLeft: 'auto' }}>{X.bad ? `${X.bad} to check` : 'consistent'}</span></div>
      <div class="card-b" style={{ overflowX: 'auto', paddingTop: 0 }}>
        <table class="mini">
          <thead><tr><th>Figure</th>{X.sources.map((s) => <th class="r">{SOURCES[s]}</th>)}<th /></tr></thead>
          <tbody>{shown.map((r) => (
            <tr class={r.ok ? '' : 'xd-bad'}>
              <td>{r.label}{r.note && <div class="muted" style={{ fontSize: '12px' }}>{r.note}</div>}</td>
              {X.sources.map((s) => <td class="r num">{show(r.values[s], r.money)}</td>)}
              <td class="r">{r.only ? <span class="muted" style={{ fontSize: '12px' }} title="Only one document gives this figure">one source</span> : r.ok ? <span class="xd-ok" aria-label="agrees">✓</span> : <span class="badge warning">differs</span>}</td>
            </tr>))}</tbody>
        </table>
        {bad.length > 0 && good.length > 0 && <button class="xd-more" onClick={() => setAll(!all)}>{all ? 'Show only the figures that differ' : <><span class="xd-ok">✓</span> {good.length} other figure{good.length > 1 ? 's' : ''} agree — show</>}</button>}
      </div>
    </section>
  );
}
