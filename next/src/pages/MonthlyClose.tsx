import { useMemo, useState } from 'preact/hooks';
import { filtered, go, saveClose, set, useStore } from '../data/store';
import { closeRecord, closeRows, generalDecisions, type CloseRow, type CloseStatus } from '../domain/close';
import { TODAY } from '../today';
import { downloadClosePack } from '../ui/closePack';
import { date, full, short } from '../ui/format';

const ST: Record<CloseStatus, { label: string; badge: string }> = { blocked: { label: 'Blocked', badge: 'critical' }, check: { label: 'To check', badge: 'warning' }, clean: { label: 'Clean', badge: 'good' } };
const lab = (r: CloseRow) => (r.p.bh ? `BH ${r.p.bh}` : r.p.code);
const MONTH = (m: string) => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Monthly close: load the month's files in one go, see every project's state, download the pack, close the month. */
export function MonthlyClose() {
  const s = useStore((x) => x), P = filtered(s), closes = s.ledger.closes ?? [];
  const month = TODAY.toISOString().slice(0, 7), done = closes.find((c) => c.month === month), last = closes.find((c) => c.month < month);
  const rows = useMemo(() => closeRows(P, TODAY, last), [P, last]);
  const general = useMemo(() => generalDecisions(P, TODAY), [P]);
  const [over, setOver] = useState(false), [open, setOpen] = useState<string | null>(null), [busy, setBusy] = useState(false), [filter, setFilter] = useState<CloseStatus | 'all'>('all');
  const n = (st: CloseStatus) => rows.filter((r) => r.status === st).length;
  const drop = (F: File[]) => F.length && set({ drawer: { kind: 'smart-import', files: F } });
  const shown = rows.filter((r) => filter === 'all' || r.status === filter);
  const nDec = rows.reduce((a, r) => a + r.decisions.length, 0) + general.length;
  const pack = async () => { setBusy(true); try { await downloadClosePack(rows, general, month, TODAY); } finally { setBusy(false); } };
  return (
    <div class="mc">
      <section class="hero" aria-label="Monthly close">
        <div class="kpi lead"><span class="label">Monthly close · {MONTH(month)}</span><span class="value">{done ? 'Closed' : n('blocked') ? `${n('blocked')} blocked` : n('check') ? `${n('check')} to check` : 'Ready to close'}</span>
          <span class="ctx">{done ? `closed ${date(done.at.slice(0, 10))} ${done.at.slice(11, 16)}` : last ? `last close: ${MONTH(last.month)}` : 'first close'}</span></div>
        {(['clean', 'check', 'blocked'] as const).map((k) => <button class={`kpi click mc-k ${filter === k ? 'on' : ''}`} onClick={() => setFilter(filter === k ? 'all' : k)}><span class="label">{ST[k].label}</span><span class="value" style={{ color: k === 'blocked' ? 'var(--critical)' : k === 'check' ? 'var(--warn)' : 'var(--good)' }}>{n(k)}</span><span class="ctx">{k === 'clean' ? 'in the pack' : k === 'check' ? 'in the pack, marked' : 'left out until fixed'}</span></button>)}
      </section>

      <section class="card mc-step">
        <div class="mc-n">1</div>
        <div style={{ flex: 1 }}><h2>Load this month's files</h2><p class="muted">Drop every system extraction, report and budget of the month at once — each file is recognised and sent to its project by BH, JP or contract number. Files loaded before are skipped.</p>
          <label class={`drop ${over ? 'on' : ''}`} style={{ marginTop: '10px' }} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); drop([...(e.dataTransfer?.files ?? [])]); }}>
            <input type="file" hidden multiple accept=".xlsx,.xlsm,.pdf,.docx" onChange={(e) => drop([...((e.target as HTMLInputElement).files ?? [])])} />
            <strong style={{ color: 'var(--ink)' }}>Drop the month's files here</strong><br />or click to choose — a whole folder can be chosen again each month
          </label></div>
      </section>

      <section class="card mc-step" style={{ display: 'block' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}><div class="mc-n">2</div>
          <div><h2>Check every project</h2><p class="muted">{rows.length} running projects · {nDec} decision{nDec === 1 ? '' : 's'} and action{nDec === 1 ? '' : 's'}{last ? ` · changes since the ${MONTH(last.month)} close` : ''} · click a row for the details</p></div>
          {filter !== 'all' && <button class="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => setFilter('all')}>Show all</button>}</div>
        <div style={{ overflowX: 'auto', marginTop: '10px' }}>
          <table class="mini mc-t">
            <thead><tr><th>Project</th><th>Status</th><th>Latest report</th><th class="r">Spent</th><th class="r">{last ? 'Since last close' : 'Spent + committed'}</th><th>Decisions</th><th /></tr></thead>
            <tbody>{shown.map((r) => <>
              <tr class={`mc-r ${open === r.p.id ? 'on' : ''}`} tabIndex={0} onClick={() => setOpen(open === r.p.id ? null : r.p.id)} onKeyDown={(e) => e.key === 'Enter' && setOpen(open === r.p.id ? null : r.p.id)}>
                <td><b class="num">{lab(r)}</b> <span class="muted">{r.p.name.slice(0, 48)}</span></td>
                <td><span class={`badge ${ST[r.status].badge}`}>{ST[r.status].label}</span>{r.reasons.length > 0 && <span class="muted mc-c"> {r.reasons.length}</span>}</td>
                <td>{r.report ? <>{date(r.report.date)} {!r.report.fresh && <span class="badge warning">old</span>}</> : <span class="badge warning">none</span>}</td>
                <td class="r num">{full(r.spent)}</td>
                <td class="r num">{r.since ? <span style={{ color: r.since.spent < 0 ? 'var(--critical)' : undefined }}>{r.since.spent >= 0 ? '+' : '−'}{full(Math.abs(r.since.spent))}</span> : full(r.sc)}</td>
                <td>{r.decisions.map((d) => <span class={`badge ${d.tone === 'bad' ? 'critical' : 'warning'} mc-d`}>{d.kind}</span>)}</td>
                <td class="r"><span class="mc-more">{open === r.p.id ? '▾' : '▸'}</span></td>
              </tr>
              {open === r.p.id && <tr class="mc-x"><td colSpan={7}>
                <div class="mc-xg">
                  <div><h3>{r.reasons.length ? 'To look at' : 'Data'}</h3>{r.reasons.length ? <ul>{r.reasons.map((t) => <li>{t}</li>)}</ul> : <p class="muted">All checks pass.</p>}</div>
                  <div><h3>Decisions and actions</h3>{r.decisions.length ? <ul>{r.decisions.map((d) => <li>{d.text}</li>)}</ul> : <p class="muted">Nothing to decide this month.</p>}</div>
                  <div><h3>Figures</h3><dl class="dl" style={{ gridTemplateColumns: '1fr auto', fontSize: '13px' }}><dt>Budget</dt><dd class="num">{full(r.budget)}</dd><dt>Spent</dt><dd class="num">{full(r.spent)}</dd><dt>Spent + committed</dt><dd class="num">{full(r.sc)}</dd>
                    {r.since && <><dt>Spent {r.since.label}</dt><dd class="num">{short(r.since.spent)}</dd></>}{r.report && <><dt>Report</dt><dd>{r.report.name}</dd></>}</dl></div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button class="btn" onClick={() => go(`project/${r.p.id}`)}>Open project →</button>
                  {r.status !== 'clean' && <button class="btn" onClick={() => go('reports/health')}>Data health →</button>}
                  <button class="btn" onClick={() => set({ drawer: { kind: 'report', projectId: r.p.id } })}>Import report</button>
                </div>
              </td></tr>}
            </>)}</tbody>
          </table>
          {general.length > 0 && <ul class="mc-gen">{general.map((d) => <li><span class={`badge ${d.tone === 'bad' ? 'critical' : 'warning'}`}>{d.kind}</span> {d.text}</li>)}</ul>}
        </div>
      </section>

      <section class="card mc-step">
        <div class="mc-n">3</div>
        <div style={{ flex: 1 }}><h2>Download the pack and close the month</h2>
          <p class="muted">One ZIP: the close summary (every project, the decisions, the problems) and the workbook of each project that is not blocked, each with its source report in the file properties. Closing records the figures as they stand today — next month shows the changes since.</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            <button class="btn primary" disabled={busy || !rows.length} onClick={pack}>{busy ? 'Preparing…' : `⤓ Close pack · ${rows.length - n('blocked')} project${rows.length - n('blocked') === 1 ? '' : 's'}`}</button>
            <button class="btn" disabled={!rows.length} onClick={() => { if (!n('blocked') || confirm(`${n('blocked')} project${n('blocked') > 1 ? 's are' : ' is'} blocked. Close ${MONTH(month)} anyway? Their figures are recorded as they are.`)) saveClose(closeRecord(rows, TODAY)); }}>{done ? `Close ${MONTH(month)} again` : `Close ${MONTH(month)}`}</button>
          </div>
          {closes.length > 0 && <div class="mc-hist"><h3>Earlier closes</h3><ul>{closes.slice(0, 12).map((c) => <li><b>{MONTH(c.month)}</b> <span class="muted">closed {date(c.at.slice(0, 10))} · {c.rows.length} projects · spent {short(c.rows.reduce((a, x) => a + x.spent, 0))} · {c.rows.filter((x) => x.status === 'blocked').length} blocked</span></li>)}</ul></div>}
        </div>
      </section>
    </div>
  );
}
