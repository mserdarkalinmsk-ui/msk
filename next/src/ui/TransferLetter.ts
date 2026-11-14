import { HEADINGS } from '../domain/calc';
import type { TransferPlan } from '../domain/transfers';
import type { Ledger, Project } from '../domain/types';
import { TODAY } from '../today';
import { downloadDocx } from './docxwrite';

const n2 = (v: number) => v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('-', '−');
const n0 = (v: number) => (Number.isInteger(v) ? v.toLocaleString('en-GB') : n2(v));
const e = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const dmy = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;

/**
 * The notification letter for the transfers that bring each line back within its budget, in the layout of the
 * forecast letter: the facts of each changed line, the flexibility statement and the annex (budget in force against
 * the notification budget, by heading). The reasons are left for the programme office to write.
 */
export function transferLetterDocx(p: Project, T: TransferPlan, flex: number, ledger: Ledger) {
  const brand = ledger.brand ?? {}, AB = new Map((p.approvedBudget?.lines ?? []).map((l) => [l.code, l]));
  const lastNo = Math.max(0, ...(p.budgetVersions ?? []).filter((v) => v.kind === 'notification').map((v) => v.no ?? 0), ...(p.budgetLetters ?? []).filter((l) => l.kind === 'notification').map((l) => l.no ?? 0));
  const no = lastNo + 1, F = Math.round(flex * 100);
  const changed = T.lines.filter((l) => Math.abs(l.after - l.budget) >= 0.005);
  const between = T.heads.some((h) => Math.abs(h.after - h.budget) >= 0.5);
  const agreement = p.contractNo || (p.contract as { number?: string } | undefined)?.number || '';
  const fact = (l: TransferPlan['lines'][number]) => l.after > l.budget
    ? `In the revised budget, the amount of the line has been increased from EUR ${n2(l.budget)} to EUR ${n2(l.after)}: spent and committed on the line reach EUR ${n2(l.sc)}.`
    : `In the revised budget, the amount of the line has been decreased from EUR ${n2(l.budget)} to EUR ${n2(l.after)}; spent and committed on the line are EUR ${n2(l.sc)}, so the amount transferred is not needed.`;
  const from = (c: string) => T.moves.filter((m) => m.to === c).map((m) => `EUR ${n2(m.amount)} from line ${m.from}`).join(', ');
  const signer = (brand.sign1 ?? '').split('\n').filter(Boolean);
  const shown = T.lines.filter((l) => l.budget || l.after);
  const heads = [...new Set(shown.map((l) => l.code.split('.')[0]))];
  const direct = shown.reduce((a, l) => a + l.budget, 0), admin = p.approvedBudget?.admin ?? 0;
  const d = document.createElement('div');
  d.innerHTML = `<p class="r">${dmy(TODAY)}</p><h1 class="c">NOTIFICATION LETTER FOR MINOR CHANGES</h1>
  ${(brand.addressee ?? '').split('\n').filter(Boolean).map((x) => `<p>${e(x)}</p>`).join('') || '<p>[Addressee]</p>'}
  <table><tbody><tr><th>Subject</th><td>Minor Change Notification No. ${no} regarding budget revision</td></tr><tr><th>Reference</th><td></td></tr><tr><th>Agreement No</th><td>${e(agreement)}</td></tr><tr><th>Title of Project</th><td>${e(p.name)}</td></tr></tbody></table>
  <p>Dear ${e(brand.salute ?? '')},</p><p>We would like to request approval for the below detailed modifications in the budget:</p>
  ${changed.map((l) => `<p><b>Line ${e(l.code)}${l.description ? ` ${e(l.description)}` : ''}:</b> ${e(fact(l))}${from(l.code) ? ` The increase comes from ${e(from(l.code))}.` : ''}</p>`).join('')}
  <p>${between ? `The transfers between budget headings do not exceed ${F}% of the amounts of the headings concerned, and the total eligible costs of the action remain unchanged.` : `All the above-mentioned transfers have been made within the same budget headings, and none of the transfers exceed ${F}%.`} The table in the Annex (revised budget) summarizes the budget changes.</p>
  <p>Yours sincerely,</p><p>${signer.map((x, i) => (i ? e(x) : `<b>${e(x)}</b>`)).join('<br/>')}</p><p><b>Annex:</b> Revised Budget</p>
  <h2>Annex to Notification No. ${no}</h2>
  <table><thead><tr><th>Costs</th><th>Unit</th><th># of units</th><th>Unit Value (in EUR)</th><th>Total Cost (in EUR)</th><th># of units</th><th>Unit Value (in EUR)</th><th>Total Cost (in EUR)</th><th>Variation in EUR</th><th>%</th></tr>
  <tr><th></th><th></th><th colspan="3">Budget All Years</th><th colspan="3">Notification Budget</th><th colspan="2">Variation</th></tr></thead><tbody>
  ${heads.map((h) => { const X = shown.filter((l) => l.code.split('.')[0] === h), b = X.reduce((a, l) => a + l.budget, 0), r = X.reduce((a, l) => a + l.after, 0);
    return `<tr><td colspan="10" data-fill="E8EEF6"><b>${e(h)}. ${e(HEADINGS[h] ?? '')}</b></td></tr>${X.map((l) => { const a = AB.get(l.code), u = a?.approvedUnits ?? 0, dv = l.after - l.budget, fill = Math.abs(dv) >= 0.005 ? ' data-fill="FFF3CD"' : '';
      return `<tr><td${fill}>${e(l.code)} ${e(l.description)}</td><td>${e(a?.unit ?? '')}</td><td class="r">${u ? n0(u) : ''}</td><td class="r">${u ? n2(l.budget / u) : ''}</td><td class="r">${n2(l.budget)}</td><td class="r">${u ? n0(u) : ''}</td><td class="r">${u ? n2(l.after / u) : ''}</td><td class="r"${fill}>${n2(l.after)}</td><td class="r">${n2(dv)}</td><td class="r">${l.budget ? `${n2((dv / l.budget) * 100)}%` : ''}</td></tr>`; }).join('')}
    <tr><td colspan="4"><b>Subtotal ${e(HEADINGS[h] ?? h)}</b></td><td class="r"><b>${n2(b)}</b></td><td colspan="2"></td><td class="r"><b>${n2(r)}</b></td><td class="r">${n2(r - b)}</td><td class="r">${b ? `${n2(((r - b) / b) * 100)}%` : ''}</td></tr>`; }).join('')}
  <tr><td colspan="4"><b>7. Subtotal direct eligible costs of the action</b></td><td class="r">${n2(direct)}</td><td colspan="2"></td><td class="r">${n2(direct)}</td><td class="r">0.00</td><td></td></tr>
  <tr><td colspan="4"><b>8. Indirect costs (maximum 7% of 7.)</b></td><td class="r">${n2(admin)}</td><td colspan="2"></td><td class="r">${n2(admin)}</td><td class="r">0.00</td><td></td></tr>
  <tr><td colspan="4"><b>9. Total eligible costs of the action (7 + 8)</b></td><td class="r">${n2(direct + admin)}</td><td colspan="2"></td><td class="r">${n2(direct + admin)}</td><td class="r">0.00</td><td></td></tr></tbody></table>`;
  downloadDocx(`${p.bh ? `BH${p.bh}` : p.code}-notification-${no}-${TODAY.toISOString().slice(0, 10)}.docx`, d, `Notification No. ${no}`, [brand.logo, brand.logo2]);
}
