import { filtered, go, useStore } from '../data/store';
import { findErrors } from '../domain/ledger';
import type { Ledger, Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';
import { downloadDocx } from '../ui/docxwrite';
import { latestWorkbook } from './FinancialReport';

/** Staff purchase orders across the portfolio that do not cover the months still to pay. */
export const staffShortRows = (P: Project[]) => P.flatMap((p) => {
  const wb = latestWorkbook(p)?.snapshot?.workbook; if (!wb?.entries?.length) return [];
  const f = findErrors(wb.entries, { pos: wb.pos, asAt: wb.meta.situationDate }).find((x) => x.kind === 'staff-short');
  return (f?.rows ?? []).map((r) => ({ p, asAt: wb.meta.situationDate ?? '', ...r }));
}).sort((a, b) => b.amount - a.amount);

export function StaffPOs() {
  const s = useStore((x) => x);
  const R = staffShortRows(filtered(s));
  const request = () => staffRequestDocx(R, s.ledger);
  const tot = R.reduce((a, r) => a + r.amount, 0), projects = new Set(R.map((r) => r.p.id)).size;
  const up = (v: number) => Math.ceil(v / 100) * 100;

  const xlsx = () => download(`staff-po-shortfall-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Staff PO shortfall', money: [8, 9, 10, 11, 12, 13], widths: [44, 8, 14, 10, 30, 8, 12, 9, 14, 14, 14, 14, 16, 16], rows: [['Project', 'BH', 'Extraction of', 'PO', 'Staff member', 'Line', 'Contract to', 'Months left', 'Monthly cost', 'Needed', 'PO balance', 'Shortfall', 'Increase requested', 'New PO amount'].map((v) => ({ v, st: 'head' as const })),
    ...R.map((r) => { const x = r.staff; return [r.p.name, r.p.bh ?? '', r.asAt, r.doc, x?.person ?? r.description, r.line, x?.to ?? '', x?.months ?? '', x?.perMonth ?? '', x?.need ?? '', x?.balance ?? '', r.amount, up(x?.shortfall ?? r.amount), x ? x.ordered + up(x.shortfall) : '']; })] }]);
  return (
    <>
      <section class="hero" aria-label="Staff POs">
        <div class="kpi lead"><span class="label">Not yet committed on staff POs</span><span class="value">{short(tot)}</span><span class="ctx">months still to pay at the current monthly cost, above the PO balances</span></div>
        <div class="kpi"><span class="label">Staff POs to top up</span><span class="value">{R.length}</span><span class="ctx">in {projects} project{projects === 1 ? '' : 's'}</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h"><div><h2>Staff POs that do not cover the remaining months</h2><p>From each project's latest system extraction · committed and spent + committed are understated until these POs are topped up · click a row to open the project</p></div><span style={{ display: 'flex', gap: '8px' }}><button class="btn primary" disabled={!R.length} title="One request per project: each PO, the months left, the monthly cost and the increase needed (Word)" onClick={request}>⬇ Increase request (Word)</button><button class="btn" onClick={xlsx}>⤓ Excel</button></span></div>
        {R.length ? <table class="wp-t" style={{ width: '100%', margin: 0 }}><thead><tr><th>Project</th><th>PO</th><th>Line</th><th>Detail</th><th class="num">Shortfall</th><th>As at</th></tr></thead>
          <tbody>{R.map((r) => <tr class="click" style={{ cursor: 'pointer' }} onClick={() => go(`project/${r.p.id}/checks`)}><td><b>{r.p.bh ? `${r.p.bh} · ` : ''}</b>{r.p.name}</td><td class="num">{r.doc}</td><td class="num">{r.line}</td><td style={{ fontSize: '12px' }}>{r.description}</td><td class="num serious">{full(r.amount)}</td><td>{r.asAt ? date(r.asAt) : ''}</td></tr>)}</tbody></table>
          : <div class="empty-page" style={{ padding: '32px' }}><div><h2>No shortfall found</h2><p>Every running staff PO covers the months to come — or no system extraction with purchase orders and invoices is loaded yet.</p></div></div>}
      </section>
    </>);
}

  /** One request per project to the budget / procurement unit: each PO, the months left and the increase needed. */
export function staffRequestDocx(R: ReturnType<typeof staffShortRows>, ledger: Ledger) {
  const up = (v: number) => Math.ceil(v / 100) * 100;
    const e = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    const by = new Map<string, typeof R>(); for (const r of R) by.set(r.p.id, [...(by.get(r.p.id) ?? []), r]);
    const d = document.createElement('div');
    d.innerHTML = `<h1>Request to increase staff purchase orders</h1><p>${e(date(TODAY.toISOString().slice(0, 10)))} · ${R.length} purchase order${R.length === 1 ? '' : 's'} in ${by.size} project${by.size === 1 ? '' : 's'} · total increase ${e(full(R.reduce((a, r) => a + up(r.staff?.shortfall ?? r.amount), 0)))}</p>
      <p>The purchase orders below do not cover the salaries until the end of the contract period at the monthly cost paid so far. An increase is requested so that the commitments of the project are complete.</p>
      ${[...by.values()].map((L) => { const p = L[0].p; return `<h2>${e(`${p.bh ? `BH ${p.bh} · ` : ''}${p.name}`)}</h2><p>Situation of the system extraction of ${e(date(L[0].asAt))}.</p>
      <table><thead><tr><th>PO</th><th>Staff member</th><th>Line</th><th>Contract to</th><th>Months left</th><th>Monthly cost</th><th>Needed</th><th>PO balance</th><th>Increase requested</th><th>New PO amount</th></tr></thead><tbody>${L.map((r) => { const x = r.staff; return x ? `<tr><td>${e(x.po)}</td><td>${e(x.person)}</td><td>${e(x.line)}</td><td>${e(date(x.to))}</td><td class="r">${x.months}</td><td class="r">${e(full(x.perMonth))}</td><td class="r">${e(full(x.need))}</td><td class="r">${e(full(x.balance))}</td><td class="r" data-fill="FFF3CD"><b>${e(full(up(x.shortfall)))}</b></td><td class="r">${e(full(x.ordered + up(x.shortfall)))}</td></tr>` : `<tr><td>${e(r.doc)}</td><td colspan="7">${e(r.description)}</td><td class="r">${e(full(up(r.amount)))}</td><td></td></tr>`; }).join('')}
      <tr><td colspan="8"><b>Total</b></td><td class="r"><b>${e(full(L.reduce((a, r) => a + up(r.staff?.shortfall ?? r.amount), 0)))}</b></td><td></td></tr></tbody></table>`; }).join('')}
      <p>Monthly cost = the average of the months already invoiced on the PO; increases are rounded up to the next 100 euros.</p>`;
    downloadDocx(`staff-PO-increase-request-${TODAY.toISOString().slice(0, 10)}.docx`, d, 'Staff PO increase request', [ledger.brand?.logo, ledger.brand?.logo2]);
  }
