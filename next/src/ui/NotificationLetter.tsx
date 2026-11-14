import { setBrand, useStore } from '../data/store';
import type { ForecastDraft, PlanLine, PlanResult } from '../domain/forecastPlan';
import type { ForecastOptions } from '../domain/forecastTemplate';
import { HEADINGS } from '../domain/calc';
import type { Project } from '../domain/types';
import { TODAY } from '../today';

/**
 * Notification letter for minor budget changes, in the layout the programme office sends to the Contracting Authority:
 * date, title, address block, subject / reference / agreement / project, one paragraph per changed line, the
 * flexibility statement, signature, and the annex comparing the budget in force with the notification budget.
 */
const n2 = (v: number) => v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('-', '\u2212');
const n0 = (v: number) => (Number.isInteger(v) ? v.toLocaleString('en-GB') : n2(v));
const dmy = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;

/** The facts of a line's change, as the opening of its paragraph (the reason is added by the user). */
export function lineFacts(l: PlanLine): string {
  const bu = l.bUnits ?? 0, br = bu ? l.budget / bu : 0, pu = l.propUnits, pr = pu ? l.rounded / pu : 0, parts: string[] = [];
  if (Math.abs(pu - bu) > 0.004) parts.push(`the number of units has been ${pu > bu ? 'increased' : 'decreased'} from ${n0(bu)} to ${n0(pu)}`);
  if (br && pr && Math.abs(pr - br) > 0.5) parts.push(`the unit value has been ${pr > br ? 'increased' : 'decreased'} from EUR ${n2(br)} to EUR ${n2(pr)}`);
  if (!parts.length) parts.push(`the amount has been ${l.rounded > l.budget ? 'increased' : 'decreased'}`);
  return `In the revised budget, ${parts.join(' and ')} (EUR ${n2(l.budget)} → EUR ${n2(l.rounded)}).`;
}

export function NotificationLetter({ p, E, R, opt, save }: { p: Project; E: ForecastDraft; R: PlanResult; opt: ForecastOptions; save: (x: Partial<ForecastDraft>) => void }) {
  const brand = useStore((s) => s.ledger.brand);
  const changed = R.lines.filter((l) => Math.abs(l.rounded - l.budget) >= 0.005);
  const headsMoved = R.heads.filter((h) => Math.abs(h.rounded - h.budget) >= 0.5);
  const lastNo = Math.max(0, ...(p.budgetVersions ?? []).filter((v) => v.kind === 'notification').map((v) => v.no ?? 0), ...(p.budgetLetters ?? []).filter((l) => l.kind === 'notification').map((l) => l.no ?? 0));
  const no = E.letter?.no ?? String(opt.change === 'notification' && opt.changeNo ? opt.changeNo : lastNo + 1);
  const L = E.letter ?? {}, put = (x: Partial<NonNullable<ForecastDraft['letter']>>) => save({ letter: { ...L, ...x } });
  const agreement = p.contractNo || (p.contract as { number?: string } | undefined)?.number || '';
  const flex = Math.round(R.flex * 100);
  const closing = !headsMoved.length
    ? `All the above-mentioned transfers have been made within the same budget headings, and none of the transfers exceed ${flex}%.`
    : `The transfers between budget headings do not exceed ${flex}% of the amounts of the headings concerned, and the total eligible costs of the action remain unchanged.`;
  const signer = (brand?.sign1 ?? '').split('\n').filter(Boolean);
  // Annex rows: every line with an amount, grouped by heading with its subtotal.
  const shown = R.lines.filter((l) => l.budget || l.rounded);
  const heads = [...new Set(shown.map((l) => l.code.split('.')[0]))];
  const cell = (l: PlanLine) => { const bu = l.bUnits ?? 0, pu = l.propUnits; return { bu, br: bu ? l.budget / bu : 0, pu, pr: pu ? l.rounded / pu : 0 }; };
  return (
    <>
      {R.decision === 'addendum' && <p class="fe-over no-print">At least one heading moves beyond {flex}% of the agreement — this change needs an addendum, not a notification. The letter can still be drafted.</p>}
      {!changed.length && <p class="fe-over no-print">No line changes in the forecast yet — fill the forecast first.</p>}
      <p style={{ textAlign: 'right' }}>{dmy(TODAY)}</p>
      <h1 style={{ textAlign: 'center', fontSize: '15pt' }}>NOTIFICATION LETTER FOR MINOR CHANGES</h1>
      <textarea class="fn-just fn-addr" rows={6} placeholder={'Addressee: name\ntitle\nContracting Authority\naddress\nphone / fax'} value={brand?.addressee ?? ''} onChange={(e) => setBrand({ ...(brand ?? {}), addressee: (e.target as HTMLTextAreaElement).value || undefined })} />
      <table class="fn-meta"><tbody>
        <tr><th>Subject</th><td>Minor Change Notification No. <input class="fn-sig fn-no" value={no} onChange={(e) => put({ no: (e.target as HTMLInputElement).value })} /> regarding budget revision</td></tr>
        <tr><th>Reference</th><td><input class="fn-sig" placeholder="letter reference" value={L.ref ?? ''} onChange={(e) => put({ ref: (e.target as HTMLInputElement).value })} /></td></tr>
        <tr><th>Agreement No</th><td>{agreement || '…'}</td></tr>
        <tr><th>Title of Project</th><td>{p.name}</td></tr>
      </tbody></table>
      <p>Dear <input class="fn-sig fn-salute" placeholder="Mr. / Ms. name" value={brand?.salute ?? ''} onChange={(e) => setBrand({ ...(brand ?? {}), salute: (e.target as HTMLInputElement).value || undefined })} />,</p>
      <p>We would like to request approval for the below detailed modifications in the budget:</p>
      {changed.map((l) => <div class="fn-line">
        <b>Line {l.code}:</b>
        <textarea class="fn-just" rows={3} value={L.lines?.[l.code] ?? `${lineFacts(l)} `} placeholder="Why the line changes"
          onChange={(e) => put({ lines: { ...L.lines, [l.code]: (e.target as HTMLTextAreaElement).value } })} />
      </div>)}
      <p>{closing} The table in the Annex (revised budget) summarizes the budget changes.</p>
      <p>Yours sincerely,</p>
      <p style={{ marginTop: '28px' }}>{signer.length ? signer.map((x, i) => <>{i ? <br /> : null}{i ? x : <b>{x}</b>}</>) : <span class="muted no-print">Signature: fill the left signature above</span>}</p>
      <p><b>Annex:</b> Revised Budget</p>

      <h2 class="fn-annex">Annex to Notification No. {no}</h2>
      <table class="fn-ann">
        <thead>
          <tr><th>Costs</th><th>Unit</th><th colSpan={3}>Budget All Years</th><th colSpan={3}>Notification Budget</th><th colSpan={2}>Variation</th></tr>
          <tr><th /><th /><th># of units</th><th>Unit Value (in EUR)</th><th>Total Cost (in EUR)</th><th># of units</th><th>Unit Value (in EUR)</th><th>Total Cost (in EUR)</th><th>in EUR</th><th>%</th></tr>
        </thead>
        <tbody>{heads.map((h) => { const X = shown.filter((l) => l.code.split('.')[0] === h), b = X.reduce((a, l) => a + l.budget, 0), r = X.reduce((a, l) => a + l.rounded, 0); return <>
          <tr class="fn-h"><td colSpan={10}>{h}. {HEADINGS[h] ?? ''}</td></tr>
          {X.map((l) => { const c = cell(l), d = l.rounded - l.budget; return <tr class={Math.abs(d) >= 0.005 ? 'fn-ch' : ''}>
            <td>{l.code} {l.description}</td><td>{l.unit}</td><td class="r">{n0(c.bu)}</td><td class="r">{n2(c.br)}</td><td class="r">{n2(l.budget)}</td>
            <td class="r">{n0(c.pu)}</td><td class="r">{n2(c.pr)}</td><td class="r">{n2(l.rounded)}</td><td class="r">{n2(d)}</td><td class="r">{l.budget ? `${n2((d / l.budget) * 100)}%` : d ? 'new' : '0.00%'}</td></tr>; })}
          <tr class="fn-sub"><td colSpan={4}>Subtotal {HEADINGS[h] ?? h}</td><td class="r">{n2(b)}</td><td colSpan={2} /><td class="r">{n2(r)}</td><td class="r">{n2(r - b)}</td><td class="r">{b ? `${n2(((r - b) / b) * 100)}%` : ''}</td></tr>
        </>; })}
          <tr class="fn-sub"><td colSpan={4}>7. Subtotal direct eligible costs of the action</td><td class="r">{n2(R.direct.budget)}</td><td colSpan={2} /><td class="r">{n2(R.direct.rounded)}</td><td class="r">{n2(R.direct.rounded - R.direct.budget)}</td><td /></tr>
          <tr class="fn-sub"><td colSpan={4}>8. Indirect costs (maximum 7% of 7.)</td><td class="r">{n2(R.admin.budget)}</td><td colSpan={2} /><td class="r">{n2(R.admin.rounded)}</td><td class="r">{n2(R.admin.rounded - R.admin.budget)}</td><td /></tr>
          <tr class="fn-sub"><td colSpan={4}>9. Total eligible costs of the action (7 + 8)</td><td class="r">{n2(R.total.budget)}</td><td colSpan={2} /><td class="r">{n2(R.total.rounded)}</td><td class="r">{n2(R.total.rounded - R.total.budget)}</td><td /></tr>
        </tbody>
      </table>
    </>
  );
}
