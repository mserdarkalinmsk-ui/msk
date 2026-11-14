import { latestReport, elapsed, money } from '../domain/calc';
import { flexOf, nearOf, pctOf, programmeOf } from '../domain/flex';
import { headings } from '../domain/insights';
import { findErrors } from '../domain/ledger';
import type { Ledger, Project } from '../domain/types';
import { TODAY } from '../today';
import { downloadDocx } from '../ui/docxwrite';
import { date, full } from '../ui/format';
import { latestWorkbook } from './FinancialReport';
import { NEEDS } from './Gaps';
import { wpName } from '../domain/workplan';
import { wpRow } from './WorkPlans';

const e = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pc = (v: number) => `${Math.round(v * 100)}%`;
const RED = 'F8D7DA', AMB = 'FFF3CD', GRN = 'D4EDDA';

/** What needs a decision or an action on one project this month, most serious first. */
export function projectActions(p: Project): { level: 'serious' | 'warning'; text: string }[] {
  const out: { level: 'serious' | 'warning'; text: string }[] = [], fx = flexOf(p);
  for (const h of headings(p).rows) {
    if (h.overspend > fx) out.push({ level: 'serious', text: `Heading ${h.code} ${h.label} is ${pc(h.overspend)} above the agreement — beyond the ${pctOf(fx)}% flexibility: an addendum is needed` });
    else if (h.overspend > 0.0001) out.push({ level: 'warning', text: `Heading ${h.code} ${h.label} is ${pc(h.overspend)} above the agreement — a notification${h.overspend > nearOf(fx) ? ', close to the addendum threshold' : ''}` });
  }
  const wb = latestWorkbook(p)?.snapshot?.workbook;
  if (wb?.entries?.length) { const f = findErrors(wb.entries, { pos: wb.pos, asAt: wb.meta.situationDate }).find((x) => x.kind === 'staff-short'); if (f) out.push({ level: 'warning', text: `${f.rows.length} staff PO${f.rows.length > 1 ? 's' : ''} do not cover the months left — ${full(f.amount)} to add` }); }
  const W = wpRow(p); if (W && W.V.level !== 'good') for (const x of W.V.flags.slice(0, 2)) out.push({ level: W.V.level === 'serious' ? 'serious' : 'warning', text: `Work Plan: ${x}` });
  const r = latestReport(p); if (r && (TODAY.getTime() - Date.parse(r.date)) / 86_400_000 > 45) out.push({ level: 'warning', text: `Latest report is of ${date(r.date)} — a newer extraction is due` });
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'serious' ? -1 : 1));
}

/** One Word document for the Head of Operations: the portfolio at a glance, then each project's figures and actions. */
export function monthSummaryDocx(P: Project[], ledger: Ledger) {
  const rows = P.filter((p) => !/closed/i.test(p.status ?? '')).map((p) => { const m = money(p), el = p.datesTbc ? 0 : elapsed(p, TODAY); return { p, m, el, used: m.budget ? m.spent / m.budget : 0, sc: m.budget ? m.exposure / m.budget : 0, A: projectActions(p), W: wpRow(p), miss: NEEDS.filter((n) => n.ok(p) === false).map((n) => n.label) }; });
  const B = rows.reduce((a, r) => a + r.m.budget, 0), S = rows.reduce((a, r) => a + r.m.spent, 0), X = rows.reduce((a, r) => a + r.m.exposure, 0);
  const serious = rows.filter((r) => r.A.some((x) => x.level === 'serious')).length;
  const tone = (r: (typeof rows)[number]) => (r.A.some((x) => x.level === 'serious') ? RED : r.A.length ? AMB : GRN);
  const d = document.createElement('div');
  d.innerHTML = `<h1>Portfolio — monthly summary</h1><p>${e(date(TODAY.toISOString().slice(0, 10)))} · ${rows.length} active projects · budget ${e(full(B))} · spent ${e(full(S))} (${pc(B ? S / B : 0)}) · spent + committed ${e(full(X))} (${pc(B ? X / B : 0)}) · ${serious} project${serious === 1 ? '' : 's'} needing a decision.</p>
  <table><thead><tr><th>Project</th><th>Programme</th><th>Budget</th><th>Spent</th><th>Spent + committed</th><th>Used / time</th><th>Work Plan</th><th>Actions</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${e(`${r.p.bh ? `${r.p.bh} · ` : ''}${r.p.name}`)}</td><td>${programmeOf(r.p)}</td><td class="r">${e(full(r.m.budget))}</td><td class="r">${e(full(r.m.spent))}</td><td class="r">${e(full(r.m.exposure))}</td><td class="r">${pc(r.used)} / ${pc(r.el)}</td><td>${r.W ? e(`${wpName(r.W.wp)} · ${r.W.V.label}`) : '—'}</td><td class="c" data-fill="${tone(r)}">${r.A.length || '✓'}</td></tr>`).join('')}</tbody></table>
  ${rows.map((r) => `<h2>${e(`${r.p.bh ? `BH ${r.p.bh} · ` : ''}${r.p.name}`)}</h2><p>${e(`${programmeOf(r.p) === 'VC' ? 'Voluntary Contribution' : 'Joint Programme'} · ${date(r.p.start)} – ${date(r.p.end)} · ${pc(r.el)} of the time used · spent ${full(r.m.spent)} (${pc(r.used)}) · spent + committed ${full(r.m.exposure)} (${pc(r.sc)})${latestReport(r.p) ? ` · report of ${date(latestReport(r.p)!.date)}` : ''}`)}</p>
    ${r.A.length ? `<ul>${r.A.map((x) => `<li>${x.level === 'serious' ? '<b>' : ''}${e(x.text)}${x.level === 'serious' ? '</b>' : ''}</li>`).join('')}</ul>` : '<p>No action needed this month.</p>'}
    ${r.W?.wp.notes ? `<h3>FOMA notes — ${e(wpName(r.W.wp))}</h3>${r.W.wp.notes.split('\n').map((x) => `<p>${e(x)}</p>`).join('')}` : ''}
    ${r.miss.length ? `<p><i>${e(`Missing on file: ${r.miss.join(', ')}.`)}</i></p>` : ''}`).join('')}`;
  downloadDocx(`portfolio-monthly-summary-${TODAY.toISOString().slice(0, 10)}.docx`, d, 'Portfolio monthly summary', [ledger.brand?.logo, ledger.brand?.logo2]);
}
