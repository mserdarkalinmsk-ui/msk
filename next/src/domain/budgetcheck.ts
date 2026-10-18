import { byPeriodThenImport, lineExposure, n } from './calc';
import type { BudgetLine, Project } from './types';

/**
 * Line-by-line checks of budgets and reports — the mistakes made when a budget is typed or copied:
 * units × rate that does not give the amount, headings that do not add up, duplicate or unknown codes,
 * descriptions that changed, amounts that moved without a revision, rates far from the rest of the portfolio.
 */
export type Level = 'bad' | 'warn' | 'info';
export interface BudgetFinding { level: Level; where: string; code?: string; text: string; expected?: number; found?: number }
export interface BudgetCheck { p: Project; findings: BudgetFinding[]; bad: number; warn: number }

const eur = (v: number) => `€${Math.round(v).toLocaleString('en-GB')}`;
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005);
const words = (s = '') => new Set(s.toLowerCase().replace(/[^a-z0-9çğıöşü ]/g, ' ').split(/\s+/).filter((w) => w.length > 2));
/** Share of words two descriptions have in common (0–1). */
function similar(a = '', b = '') { const A = words(a), B = words(b); if (!A.size || !B.size) return 1; let k = 0; for (const w of A) if (B.has(w)) k++; return k / Math.min(A.size, B.size); }
const COUNTED = /\b(event|person|participant|day|month|trip|session|workshop|meeting|training|item|copy|piece|unit)s?\b/i;

function lineChecks(L: BudgetLine[], where: string, F: BudgetFinding[]) {
  const seen = new Map<string, number>();
  for (const l of L) seen.set(l.code, (seen.get(l.code) ?? 0) + 1);
  for (const [c, k] of seen) if (k > 1) F.push({ level: 'bad', where, code: c, text: `Line ${c} appears ${k} times — amounts may be counted twice` });
  for (const l of L) {
    const a = n(l.approved), u = l.approvedUnits, r = l.unitRate;
    if (a < 0) F.push({ level: 'bad', where, code: l.code, text: `Negative amount ${eur(a)}`, found: a });
    if (u != null && r != null && u > 0 && r > 0 && !close(u * r, a)) {
      // A rate shown rounded (€10 for €10.27) is not a mistake: the real rate rounds to the one on the page.
      const real = a / u, rounded = Math.abs(real - r) < 0.5 || Math.abs(real - r) / r < 0.005;
      F.push(rounded ? { level: 'info', where, code: l.code, text: `Unit rate shown as ${eur(r)}; the amount implies ${real.toFixed(2)} — rounding only` }
        : { level: 'bad', where, code: l.code, text: `${u} × ${eur(r)} = ${eur(u * r)}, but the amount is ${eur(a)} — difference ${eur(a - u * r)}`, expected: u * r, found: a });
    }
    if (a > 0 && u === 0) F.push({ level: 'warn', where, code: l.code, text: `Amount ${eur(a)} with 0 units` });
    if (u != null && u % 1 !== 0 && COUNTED.test(l.unit ?? '') && !/month/i.test(l.unit ?? '')) F.push({ level: 'warn', where, code: l.code, text: `${u} units "${l.unit}" — not a whole number` });
  }
}

/** Heading rows (1, 1.1 …) against the sum of the lines below them, from a report workbook. */
function headingSums(lines: { code: string; leaf: boolean; budget: { cost: number | null } }[], where: string, F: BudgetFinding[]) {
  for (const h of lines.filter((x) => !x.leaf && x.budget.cost != null)) {
    const kids = lines.filter((x) => x.code.startsWith(h.code + '.') && x.code.split('.').length === h.code.split('.').length + 1);
    if (!kids.length) continue;
    const s = kids.reduce((a, x) => a + (x.budget.cost ?? 0), 0);
    if (!close(s, h.budget.cost!)) F.push({ level: 'bad', where, code: h.code, text: `Heading ${h.code} shows ${eur(h.budget.cost!)} but its lines add up to ${eur(s)}`, expected: s, found: h.budget.cost! });
  }
}

/** Unit rates of the same code and unit across projects: the median of the portfolio. */
export function rateMedians(P: Project[]): Map<string, { median: number; n: number }> {
  const m = new Map<string, number[]>();
  for (const p of P) for (const l of p.approvedBudget?.lines ?? []) if (n(l.unitRate) > 0 && l.unit) { const k = `${l.code}|${l.unit.toLowerCase()}`; m.set(k, [...(m.get(k) ?? []), n(l.unitRate)]); }
  return new Map([...m].filter(([, v]) => v.length >= 3).map(([k, v]) => { const s = [...v].sort((a, b) => a - b); return [k, { median: s[Math.floor(s.length / 2)], n: s.length }]; }));
}

export function budgetCheck(p: Project, medians = new Map<string, { median: number; n: number }>()): BudgetCheck {
  const F: BudgetFinding[] = [];
  const ab = p.approvedBudget, base = ab?.lines ?? [];
  const c = (p.contract ?? {}) as { total?: number; euMax?: number; contingencyPct?: number };
  // Approved budget
  if (base.length) {
    const W = `Approved budget (${ab!.source})`;
    lineChecks(base, W, F);
    const sum = base.reduce((a, l) => a + n(l.approved), 0);
    // The document total may be the direct costs only (without admin 10 and contingency 8).
    const direct = base.filter((l) => !/^(10|8)(\.|$)/.test(l.code)).reduce((a, l) => a + n(l.approved), 0);
    if (ab!.linesSum && !close(sum, ab!.linesSum) && !close(direct, ab!.linesSum)) F.push({ level: 'warn', where: W, text: `Lines add up to ${eur(sum)}, the document total is ${eur(ab!.linesSum)}`, expected: sum, found: ab!.linesSum });
    if (ab!.direct && ab!.admin / ab!.direct > 0.0705) F.push({ level: 'bad', where: W, text: `Administrative costs ${eur(ab!.admin)} are ${(ab!.admin / ab!.direct * 100).toFixed(2)}% of direct costs (max 7%)`, expected: ab!.direct * 0.07, found: ab!.admin });
    if (c.contingencyPct && ab!.contingency && ab!.direct && ab!.contingency / ab!.direct * 100 > c.contingencyPct + 0.05) F.push({ level: 'bad', where: W, text: `Contingency is ${(ab!.contingency / ab!.direct * 100).toFixed(1)}% of direct costs; the contract allows ${c.contingencyPct}%` });
    if (Number(c.total) && !close(ab!.total, Number(c.total))) F.push({ level: 'warn', where: W, text: `Budget total ${eur(ab!.total)} differs from the contract total ${eur(Number(c.total))}`, expected: Number(c.total), found: ab!.total });
    if (Number(c.euMax) && Number(c.total) && Number(c.euMax) > Number(c.total) + 1) F.push({ level: 'bad', where: 'Contract', text: `EU maximum ${eur(Number(c.euMax))} is above the total cost ${eur(Number(c.total))}` });
    // Rates far from the portfolio
    for (const l of base) {
      const md = l.unit ? medians.get(`${l.code}|${l.unit.toLowerCase()}`) : undefined, r = n(l.unitRate);
      if (md && r > 0 && (r > md.median * 1.5 || r < md.median * 0.5)) F.push({ level: 'warn', where: W, code: l.code, text: `Unit rate ${eur(r)} ${l.unit} is ${r > md.median ? Math.round((r / md.median - 1) * 100) + '% above' : Math.round((1 - r / md.median) * 100) + '% below'} the portfolio median ${eur(md.median)} (${md.n} projects) — check for a typing error`, expected: md.median, found: r });
    }
  }
  // Reports: every report against the approved budget, the latest one in detail
  const R = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.lines?.length).sort(byPeriodThenImport);
  const byCode = new Map(base.map((l) => [l.code, l]));
  R.forEach((r, i) => {
    const W = `Report ${r.name}`, L = r.snapshot!.lines, latest = i === R.length - 1;
    const wb = r.snapshot!.workbook;
    if (wb?.lines?.length && latest) headingSums(wb.lines, W, F);
    if (latest) lineChecks(L.filter((l) => l.code !== '10'), W, F);
    if (!base.length) return;
    for (const l of L) {
      if (l.code === '10' || /^\d+$/.test(l.code)) continue;
      const b = byCode.get(l.code);
      if (!b) { if (n(l.approved) || n(l.actual)) F.push({ level: latest ? 'warn' : 'info', where: W, code: l.code, text: `Line ${l.code} is not in the approved budget${l.description ? ` ("${l.description.slice(0, 50)}")` : ''}` }); continue; }
      if (latest && l.description && b.description && similar(l.description, b.description) < 0.34) F.push({ level: 'warn', where: W, code: l.code, text: `Description "${l.description.slice(0, 50)}" differs from the approved budget "${b.description.slice(0, 50)}" — wrong line used?` });
      if (latest && l.approved != null && !close(n(l.approved), n(b.approved))) F.push({ level: 'info', where: W, code: l.code, text: `Budget column ${eur(n(l.approved))} differs from the approved ${eur(n(b.approved))} — a transfer or a typing error`, expected: n(b.approved), found: n(l.approved) });
      if (latest && n(l.approved) > 0 && lineExposure(l) > n(l.approved) * 1.1 + 1) F.push({ level: 'warn', where: W, code: l.code, text: `Spent + committed ${eur(lineExposure(l))} is ${Math.round((lineExposure(l) / n(l.approved) - 1) * 100)}% above the line budget ${eur(n(l.approved))}` });
      if (latest && n(l.reportedUnitRate) > 0 && n(b.unitRate) > 0 && n(l.reportedUnitRate) > n(b.unitRate) * 1.15) F.push({ level: 'warn', where: W, code: l.code, text: `Actual unit rate ${eur(n(l.reportedUnitRate))} is ${Math.round((n(l.reportedUnitRate) / n(b.unitRate) - 1) * 100)}% above the budget rate ${eur(n(b.unitRate))}` });
    }
  });
  const order: Level[] = ['bad', 'warn', 'info'];
  F.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level) || (a.code ?? '').localeCompare(b.code ?? '', undefined, { numeric: true }));
  return { p, findings: F, bad: F.filter((f) => f.level === 'bad').length, warn: F.filter((f) => f.level === 'warn').length };
}
