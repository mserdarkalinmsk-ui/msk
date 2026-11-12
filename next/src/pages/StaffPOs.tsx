import { filtered, go, useStore } from '../data/store';
import { findErrors } from '../domain/ledger';
import { TODAY } from '../today';
import { date, full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';
import { latestWorkbook } from './FinancialReport';

/** Staff purchase orders across the portfolio that do not cover the months still to pay. */
export function StaffPOs() {
  const s = useStore((x) => x);
  const R = filtered(s).flatMap((p) => {
    const wb = latestWorkbook(p)?.snapshot?.workbook; if (!wb?.entries?.length) return [];
    const f = findErrors(wb.entries, { pos: wb.pos, asAt: wb.meta.situationDate }).find((x) => x.kind === 'staff-short');
    return (f?.rows ?? []).map((r) => ({ p, asAt: wb.meta.situationDate ?? '', ...r }));
  }).sort((a, b) => b.amount - a.amount);
  const tot = R.reduce((a, r) => a + r.amount, 0), projects = new Set(R.map((r) => r.p.id)).size;
  const xlsx = () => download(`staff-po-shortfall-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Staff PO shortfall', money: [5], rows: [['Project', 'BH', 'Extraction of', 'PO', 'Line', 'Shortfall', 'Detail'], ...R.map((r) => [r.p.name, r.p.bh ?? '', r.asAt, r.doc, r.line, r.amount, r.description])] }]);
  return (
    <>
      <section class="hero" aria-label="Staff POs">
        <div class="kpi lead"><span class="label">Not yet committed on staff POs</span><span class="value">{short(tot)}</span><span class="ctx">months still to pay at the current monthly cost, above the PO balances</span></div>
        <div class="kpi"><span class="label">Staff POs to top up</span><span class="value">{R.length}</span><span class="ctx">in {projects} project{projects === 1 ? '' : 's'}</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h"><div><h2>Staff POs that do not cover the remaining months</h2><p>From each project's latest system extraction · committed and spent + committed are understated until these POs are topped up · click a row to open the project</p></div><button class="btn" onClick={xlsx}>⤓ Excel</button></div>
        {R.length ? <table class="wp-t" style={{ width: '100%', margin: 0 }}><thead><tr><th>Project</th><th>PO</th><th>Line</th><th>Detail</th><th class="num">Shortfall</th><th>As at</th></tr></thead>
          <tbody>{R.map((r) => <tr class="click" style={{ cursor: 'pointer' }} onClick={() => go(`project/${r.p.id}/checks`)}><td><b>{r.p.bh ? `${r.p.bh} · ` : ''}</b>{r.p.name}</td><td class="num">{r.doc}</td><td class="num">{r.line}</td><td style={{ fontSize: '12px' }}>{r.description}</td><td class="num serious">{full(r.amount)}</td><td>{r.asAt ? date(r.asAt) : ''}</td></tr>)}</tbody></table>
          : <div class="empty-page" style={{ padding: '32px' }}><div><h2>No shortfall found</h2><p>Every running staff PO covers the months to come — or no system extraction with purchase orders and invoices is loaded yet.</p></div></div>}
      </section>
    </>);
}
