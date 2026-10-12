import { ADMIN_LINE } from './terms';
/**
 * Project documents (contract, Description of Action, action plan, logframe…) in any format are
 * reduced to plain paragraphs + tables, then analysed for facts the ledger uses.
 */
import type { Activity, Risk } from './types';
import { joinLines } from './notes';

export interface Doc { name: string; kind: 'pdf' | 'docx' | 'xlsx' | 'text'; paragraphs: string[]; tables: string[][][]; geometry?: Geometry; notes?: Record<string, BudgetNote> }
/** Results of the layout readers for PDFs (shaded action-plan cells, logframe columns, annex tables). */
export interface Geometry {
  acts: { code: string; name: string; group?: string; P?: number[]; E?: number[]; X?: number[] }[]; months: number; start?: string;
  indicators: { level?: string; result?: string; text: string; baseline?: string; target?: string; sources?: string; assumptions?: string }[];
  risks: { title: string; category?: string; likelihood?: string; impact?: string; mitigation?: string; owner?: string }[];
}
export interface Indicator { id: string; result: string; indicator: string; baseline: string; target: string; source: string; assumptions?: string; level?: string; current?: string; asOf?: string }
export interface BudgetNote { description: string; unit?: string; clarification: string; justification: string }
export interface ContractFacts {
  number?: string; title?: string; total?: number; euMax?: number; euShare?: number; start?: string; end?: string; months?: number;
  repMonths?: number; progDays?: number; finalMonths?: number; prefinancing?: number; flexPct?: number; contingencyPct?: number; jp?: string; bh?: string;
}
export interface DocFindings { contract: ContractFacts; acts: Activity[]; planMonths?: number; risks: Risk[]; indicators: Indicator[]; budget?: ApprovedBudget | null; notes?: Record<string, BudgetNote>; assumptions?: string[]; summary: string[] }

/* ---------- helpers ---------- */
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
// Word symbol-font bullets arrive as private-use glyphs (\uF0B7 …): drop them.
const clean = (s: string) => s.replace(/[\uE000-\uF8FF]/g, ' ').replace(/\s+/g, ' ').trim();
export function amount(s: string): number | null {
  const t = s.replace(/[€\s ]|EUR/gi, '').replace(/'/g, '');
  if (!/\d/.test(t)) return null;
  let v = t;
  if (/,\d{1,2}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{3}(\.|$)/.test(v) && !/\.\d{1,2}$/.test(v)) v = v.replace(/\./g, '');
  v = v.replace(/,/g, '');
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : null;
}
export function anyDate(s: string): string | undefined {
  let m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
  if (m && MONTHS.indexOf(m[2].toLowerCase()) >= 0) return `${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : undefined;
}
const addMonths = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00Z'); const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate() - 1)); return e.toISOString().slice(0, 10); };
const MONEY = String.raw`(?:EUR|€)\s*([\d][\d .,']*\d)|([\d][\d .,']*\d)\s*(?:EUR|€)`;

/* ---------- contract ---------- */
export function contractFacts(doc: Doc): ContractFacts {
  const T = clean(doc.paragraphs.join(' ') + ' ' + doc.tables.flat(2).join(' '));
  const f: ContractFacts = {};
  const pick = (re: RegExp) => { const m = T.match(re); return m ? (m.slice(1).find(Boolean) ?? '') : undefined; };
  f.number = pick(/(?:contract|grant agreement)\s*(?:no\.?|n°|nº|number)\s*[:.]?\s*([A-Z]{0,4}[-\/]?\d[\d\-\/]{4,})/i);
  const title = pick(/title of the action\s*[:\-–]?\s*[“"']?([^“”"'.]{8,160})/i); if (title) f.title = clean(title);
  const tot = pick(new RegExp(String.raw`total (?:estimated |eligible )*(?:cost|budget)s? of the action[^€\d]{0,120}?(?:${MONEY})`, 'i')); if (tot) f.total = amount(tot) ?? undefined;
  const eu = pick(new RegExp(String.raw`maximum (?:contribution|amount)[^€\d]{0,160}?(?:${MONEY})`, 'i')); if (eu) f.euMax = amount(eu) ?? undefined;
  const share = pick(/(\d{1,3}(?:[.,]\d+)?)\s*%\s*of the total (?:estimated )?eligible costs/i); if (share) f.euShare = parseFloat(share.replace(',', '.'));
  const mo = pick(/(?:implementation (?:period|duration)|duration of (?:the )?(?:action|implementation)|period of implementation)[^.]{0,80}?(\d{1,3})\s*months/i); if (mo) f.months = +mo;
  const st = pick(/(?:implementation (?:period )?shall start|shall (?:commence|start)|start date|commencement date|starting on)[^.]{0,80}?((?:\d{1,2}[./]\d{1,2}[./]\d{4})|(?:\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})|\d{4}-\d{2}-\d{2})/i); if (st) f.start = anyDate(st);
  const en = pick(/(?:end date|shall end|until|ending on)[^.]{0,40}?((?:\d{1,2}[./]\d{1,2}[./]\d{4})|(?:\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}))/i); if (en) f.end = anyDate(en);
  // EU Contribution Agreement wording (patterns from the previous app, tested on real agreements)
  const ca = pick(/CONTRIBUTION AGREEMENT\s+(?:EUROPEAN UNION\s+)?N°\s*(\d{5,})/i); if (ca && !f.number) f.number = ca;
  const ct = pick(/title of this Contribution Agreement[^:]{0,40}is:\s*[“"]([^”"]{10,300})[”"]/i); if (ct) f.title = clean(ct);
  const em = pick(/maximum total contribution of the contracting authority is EUR\s*([\d .,]+?\d)(?=\s*\()/i); if (em) f.euMax = amount(em) ?? f.euMax;
  const ip = T.match(/implementation period of this Contribution Agreement is (\d+)\s*month\(?s?\)? from the (\d{2}\/\d{2}\/\d{4})/i); if (ip) { f.months = +ip[1]; f.start = anyDate(ip[2]); }
  const tc = pick(/total cost of the Action is estimated at EUR\s*([\d.,]+\d)/i); if (tc) f.total = amount(tc) ?? f.total;
  const pr = pick(/pre-financing rate is (\d+)\s*%/i); if (pr) f.prefinancing = +pr;
  const fx = pick(/variation \(as the case may be in cumulative terms\) of (\d+)\s*% or less of the amount originally entered/i); if (fx) f.flexPct = +fx;
  const cr = pick(/reserve for contingencies[^.]{0,140}?not exceeding (\d+)\s*%/i); if (cr) f.contingencyPct = +cr;
  const sh = T.match(/(\d{1,3})\s*%\s*EU,\s*(\d{1,3})\s*%\s*([A-Za-z]{2,10})/i); if (sh) f.euShare = +sh[1];
  const W: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, eighteen: 18, thirty: 30, sixty: 60, ninety: 90 };
  const pdm = T.match(/progress reports shall be submitted within ([a-z]+|\d+)\s*\(?(\d+)?\)?\s*Days after the period/i); if (pdm) f.progDays = +(pdm[2] || W[pdm[1].toLowerCase()] || pdm[1]);
  const fm = T.match(/final report shall be submitted, at the latest, ([a-z]+|\d+)\s*\(?(\d+)?\)?\s*months after the end of the Implementation Period/i); if (fm) f.finalMonths = +(fm[2] || W[fm[1].toLowerCase()] || fm[1]);
  const rm = pick(/forecast budget for the subsequent (\d+) months/i); if (rm) f.repMonths = +rm;
  if (f.start && f.months && !f.end) f.end = addMonths(f.start, f.months);
  const rep = pick(/(?:report|reports)[^.]{0,80}?every\s+(\d{1,2})\s+months/i) ?? pick(/every\s+(\d{1,2})\s+months[^.]{0,60}?report/i); if (rep) f.repMonths = +rep;
  const pd = pick(/within\s+(\d{2,3})\s+days[^.]{0,80}?(?:end of|after)[^.]{0,40}?(?:reporting )?period/i); if (pd) f.progDays = +pd;
  const jp = pick(/\bJP\s*[:n°#]*\s*(\d{3,5})\b/); if (jp) f.jp = jp;
  const bh = pick(/\bBH\s*[:n°#]*\s*(\d{3,})\b/); if (bh) f.bh = bh;
  if (!f.title && doc.paragraphs[0] && /\b(?:in|for)\s+[A-ZÇİÖŞÜ]/.test(doc.paragraphs[0]) && doc.paragraphs[0].length < 160 && /budget/i.test(doc.paragraphs.slice(0, 8).join(' ') + doc.tables.flat(2).slice(0, 20).join(' '))) f.title = clean(doc.paragraphs[0]);
  const pf = pick(/pre-?financing[^.]{0,80}?(\d{1,3})\s*%/i); if (pf) f.prefinancing = +pf;
  for (const k of Object.keys(f) as (keyof ContractFacts)[]) if (f[k] == null || f[k] === '') delete f[k];
  return f;
}

/* ---------- action plan (activities × months) ---------- */
const MARK = /^(x|✓|✔|●|■|•|p|e|ex|1|yes|\*)$/i;
function monthHeader(row: string[]) {
  // "M1 M2…", "1 2 3 … 36", or "Jan-25 Feb-25…" — returns column index → month number (1-based)
  const map = new Map<number, number>();
  row.forEach((c, i) => {
    const t = clean(c);
    let m = t.match(/^(?:m|month)\s*(\d{1,2})$/i); if (m) { map.set(i, +m[1]); return; }
    if (/^\d{1,2}$/.test(t) && +t >= 1 && +t <= 72) { map.set(i, +t); return; }
    m = t.match(/^([A-Za-z]{3})[a-z]*[-\s'’]?(\d{2,4})$/); if (m && MONTHS.some((x) => x.startsWith(m![1].toLowerCase()))) map.set(i, -1);
  });
  // calendar month headers: number them in order
  let k = 0; for (const [i, v] of [...map]) if (v === -1) map.set(i, ++k);
  // a real timeline has several consecutive month columns (1 2 3 … or Jan Feb Mar …)
  const v = [...map.values()];
  const consecutive = v.filter((x, i) => i && x === v[i - 1] + 1).length;
  return map.size >= 3 && consecutive >= map.size - 1 ? map : null;
}
export function actionPlan(doc: Doc): { acts: Activity[]; months: number } | null {
  for (const T of doc.tables) {
    for (let h = 0; h < Math.min(6, T.length); h++) {
      const cols = monthHeader(T[h]); if (!cols) continue;
      const first = Math.min(...cols.keys());
      const acts: Activity[] = []; let group = '';
      for (const r of T.slice(h + 1)) {
        const lead = r.slice(0, first).map(clean).filter(Boolean);
        const text = lead.join(' ');
        const code = text.match(/^(?:activity\s*)?(\d+(?:\.\d+)+)\.?\s*(.*)$/i);
        const marks = [...cols].filter(([i]) => MARK.test(clean(r[i] ?? '')) || /^(p|e)$/i.test(clean(r[i] ?? '')));
        if (!code) { if (text && !marks.length) group = text.slice(0, 80); continue; }
        const P: number[] = [], E: number[] = [];
        for (const [i, mo] of marks) (/^p$/i.test(clean(r[i])) ? P : E).push(mo);
        const name = clean(code[2] || lead[1] || '');
        acts.push({ id: 'a' + acts.length, code: code[1], name: name || `Activity ${code[1]}`, group: group || `Output ${code[1].split('.')[0]}`, P, E, status: '' });
      }
      if (acts.length >= 2) return { acts, months: Math.max(...cols.values()) };
    }
  }
  return null;
}

/* ---------- risks & indicators ---------- */
const LEVEL: Record<string, string> = { 'very high': '5', high: '4', medium: '3', moderate: '3', low: '2', 'very low': '1' };
const level = (s: string) => { const t = clean(s).toLowerCase(); return /^[1-5]$/.test(t) ? t : LEVEL[t] ?? ''; };
function findTable(doc: Doc, test: (h: string[]) => boolean) {
  for (const T of doc.tables) for (let i = 0; i < Math.min(3, T.length); i++) { const h = T[i].map((c) => clean(c).toLowerCase()); if (test(h)) return { T, i, h }; }
  return null;
}
export function risks(doc: Doc): Risk[] {
  const f = findTable(doc, (h) => h.some((x) => x.includes('risk')) && h.some((x) => /likelihood|probability/.test(x)) && h.some((x) => x.includes('impact')));
  if (!f) return [];
  const col = (re: RegExp) => f.h.findIndex((x) => re.test(x));
  const ti = col(/risk/), li = col(/likelihood|probability/), ii = col(/impact/), mi = col(/mitigat|response|measure/), ci = col(/categor|type/), oi = col(/owner|responsib/);
  return f.T.slice(f.i + 1).map((r, k) => ({
    id: 'd' + k + Math.random().toString(36).slice(2, 6), title: clean(r[ti] ?? ''), category: ci >= 0 ? clean(r[ci] ?? '') : 'Operational',
    likelihood: level(r[li] ?? ''), impact: level(r[ii] ?? ''), mitigation: mi >= 0 ? clean(r[mi] ?? '') : '', owner: oi >= 0 ? clean(r[oi] ?? '') : '', status: 'Open', source: doc.name,
  } as Risk)).filter((r) => r.title && r.likelihood && r.impact);
}
export function indicators(doc: Doc): Indicator[] {
  const f = findTable(doc, (h) => h.some((x) => x.includes('indicator')) && h.some((x) => /target|baseline/.test(x)));
  if (!f) return [];
  const col = (re: RegExp) => f.h.findIndex((x) => re.test(x));
  const ri = col(/result|outcome|output|objective|level|intervention logic|results chain/), ii = col(/indicator/), bi = col(/baseline/), ti = col(/target/), si = col(/source|verification|means/), ai = col(/assumption/);
  // Logframe levels: impact / overall objective → outcome / specific objective → outputs
  const levelOf = (t: string) => /overall objective|impact/i.test(t) ? 'Impact' : /specific objective|outcome/i.test(t) ? 'Outcome' : /output|result\s*\d/i.test(t) ? 'Output' : /activit/i.test(t) ? 'Activity' : '';
  let result = '', level = '', assumptions = '';
  return f.T.slice(f.i + 1).flatMap((r, k) => {
    if (ri >= 0 && clean(r[ri] ?? '')) { result = clean(r[ri]); level = levelOf(result) || level; }
    if (ai >= 0 && clean(r[ai] ?? '')) assumptions = clean(r[ai]);
    const ind = clean(r[ii] ?? ''); if (!ind) return [];
    return [{ id: 'i' + k, result, indicator: ind, baseline: bi >= 0 ? clean(r[bi] ?? '') : '', target: ti >= 0 ? clean(r[ti] ?? '') : '', source: si >= 0 ? clean(r[si] ?? '') : '', ...(ai >= 0 ? { assumptions } : {}), ...(level ? { level } : {}) }];
  });
}

export function analyse(doc: Doc): DocFindings {
  const G = doc.geometry;
  const gPlan = G?.acts.length ? { acts: G.acts.map((a, i) => ({ id: 'g' + i, code: a.code, name: a.name, group: a.group || `Output ${a.code.split('.')[0]}`, P: a.P ?? [], E: a.E ?? [], X: a.X ?? [], status: '' })), months: G.months } : null;
  const gInd: Indicator[] = (G?.indicators ?? []).map((x, i) => ({ id: 'gi' + i, result: x.result ?? '', indicator: x.text, baseline: x.baseline ?? '', target: x.target ?? '', source: x.sources ?? '', assumptions: x.assumptions, level: x.level }));
  const gRisk: Risk[] = (G?.risks ?? []).filter((r) => r.title).map((r, i) => ({ id: 'gr' + i, title: r.title, category: r.category || 'Operational', likelihood: r.likelihood ?? '', impact: r.impact ?? '', mitigation: r.mitigation ?? '', owner: r.owner ?? '', status: 'Open' }));
  const tPlan = actionPlan(doc), tRisk = risks(doc), tInd = indicators(doc);
  const plan = gPlan && gPlan.acts.length >= (tPlan?.acts.length ?? 0) ? gPlan : tPlan;
  const NR = narrativeRisks(doc);
  const R0 = gRisk.length > tRisk.length ? gRisk : tRisk;
  const R = NR.risks.length > R0.length ? NR.risks : R0, I = gInd.length > tInd.length ? gInd : tInd;
  const contract = contractFacts(doc), budget = approvedBudget(doc), notes = { ...budgetNotes(doc), ...(doc.notes ?? {}) };
  const nn = Object.keys(notes).length;
  const summary = [
    nn && `justification for ${nn} budget lines`,
    budget && `approved budget €${Math.round(budget.total).toLocaleString('en-GB')} (${budget.lines.length} lines)`,
    Object.keys(contract).length && `${Object.keys(contract).length} contract facts`,
    plan && `${plan.acts.length} activities over ${plan.months} months`,
    R.length && `${R.length} risks`, NR.assumptions.length && `${NR.assumptions.length} assumptions`, I.length && `${I.length} indicators`,
  ].filter(Boolean) as string[];
  return { contract, acts: plan?.acts ?? [], planMonths: plan?.months, risks: R, indicators: I, budget, notes, assumptions: NR.assumptions, summary };
}

/* ---------- approved budget (CoE "Budget for all years" template, DoA annex) ---------- */
export interface ApprovedBudget { lines: import('./types').BudgetLine[]; /** names of every coded row, heading rows included (1.1 Local, 1.1.1 Local team) */ names?: Record<string, string>; direct: number; admin: number; contingency: number; total: number; source: string; linesSum: number; importedAt?: string }

const NUM = /^-?[\d][\d.,' ]*$/;
/**
 * Reads budget rows "code description | unit | # units | unit rate | cost | (forecast year …)".
 * Only the first unit/rate/cost group (all years) is used. Sub-total rows are skipped;
 * rows 8 (contingency) and 10 (administrative costs) are kept as lines '8' and '10'.
 */
export function approvedBudget(doc: Doc): ApprovedBudget | null {
  const lines: import('./types').BudgetLine[] = [];
  let admin = 0, contingency = 0, direct = 0, total = 0;
  const subs = new Map<string, number>(), names: Record<string, string> = {};
  for (const T of doc.tables) for (const raw of T) {
    const r = raw.map((c) => clean(c ?? '')).filter(Boolean);
    if (!r.length) continue;
    let head = r[0], rest = r.slice(1);
    // code may be its own cell ("1.1.2" | "Project manager")
    if (/^\d+(\.\d+)*\.?$/.test(head) && rest.length && !NUM.test(rest[0])) { head = `${head} ${rest[0]}`; rest = rest.slice(1); }
    const st = head.match(/^sub-?total\s+(\d{1,2})\b/i);
    if (st) { const v = rest.filter((c) => NUM.test(c) || c === '-').map((c) => (c === '-' ? 0 : amount(c) ?? 0)); if (!subs.has(st[1])) subs.set(st[1], v[0] ?? 0); continue; }
    const m = head.match(/^(\d{1,2}(?:\.\d{1,2}){0,4})\.?\s+(.{2,})$/); if (!m) continue;
    const code = m[1], desc = m[2];
    if (!names[code] && !/^sub-?total|^total/i.test(desc)) names[code] = desc.split(/\n/)[0].trim();
    const nums = rest.filter((c) => NUM.test(c) || c === '-').map((c) => (c === '-' ? 0 : amount(c) ?? 0));
    const unit = rest.find((c) => /^per\b/i.test(c));
    if (/^sub-?total|^total/i.test(desc)) {
      if (/^7$/.test(code) || /direct eligible/i.test(desc)) direct = direct || nums[0] || 0;
      if (/^11$/.test(code) || /total eligible costs/i.test(desc)) total = total || nums[0] || 0;
      continue;
    }
    // Admin is row 10 in templates with a contingency row and row 8 without one: classify by wording, not number.
    if (/administrative costs|indirect costs/i.test(desc)) { admin = admin || (nums[0] ?? 0); continue; }
    if (/contingency/i.test(desc)) { contingency = nums[0] ?? 0; continue; }
    if (/^(8|9|10|11)$/.test(code)) continue;
    if (!code.includes('.') && !unit) continue; // heading row ("1 Human resources")
    if (unit && nums.length >= 3) lines.push({ code, description: desc, unit, approvedUnits: nums[0], unitRate: nums[1], approved: nums[2] });
    else if (unit && nums.length === 0) continue; // unused template row
    else if (!unit && nums.length >= 1 && code.split('.').length >= 2) lines.push({ code, description: desc, approved: nums.at(-1) });
  }
  // Each heading's own sub-total wins: rows under a heading whose sub-total is nil are template/other-table noise.
  // The same line often appears on several sheets/tables (budget + justification): keep its first occurrence.
  const seen = new Set<string>();
  const uniq = lines.filter((l) => (seen.has(l.code) ? false : (seen.add(l.code), true)));
  lines.length = 0; lines.push(...uniq);
  const leaves = lines.filter((l) => (l.approved ?? 0) > 0 && !lines.some((x) => x !== l && x.code.startsWith(l.code + '.')) && subs.get(l.code.split('.')[0]) !== 0);
  if (leaves.length < 3) return null;
  const sum = leaves.reduce((s, l) => s + (l.approved ?? 0), 0);
  if (!direct) direct = sum;
  if (contingency && admin && Math.abs(contingency - admin) < 1) contingency = 0; // the 7% row read twice, not a reserve
  if (!admin && total > direct) admin = Math.round((total - direct - contingency) * 100) / 100;
  const out = [...leaves];
  if (contingency) out.push({ code: '8', description: 'Contingency reserve', approved: contingency });
  if (admin) out.push({ code: ADMIN_LINE, description: 'Administrative costs', unit: '7%', approved: admin });
  return { lines: out, names, direct, admin, contingency, total: direct + contingency + admin, source: doc.name, linesSum: sum };
}

/* ---------- budget clarification & justification annex ---------- */
/** Rows "code description | unit | clarification of the budget item | justification of the estimated costs", keyed by line code. */
export function budgetNotes(doc: Doc): Record<string, BudgetNote> {
  const out: Record<string, BudgetNote> = {};
  for (const T of doc.tables) {
    const hi = T.findIndex((r) => r.some((c) => /justification|clarification/i.test(c ?? '')));
    if (hi < 0 || hi > 6) continue;
    const h = T[hi].map((c) => clean(c ?? '').toLowerCase());
    const ci = h.findIndex((x) => x.includes('clarification')), ji = h.findIndex((x) => x.includes('justification')), ui = h.findIndex((x) => x === 'unit');
    for (const r of T.slice(hi + 1)) {
      const m = clean(r[0] ?? '').match(/^(\d{1,2}(?:\.\d{1,2}){0,4})\.?\s+(.+)$/); if (!m) continue;
      const clarification = ci >= 0 ? clean(r[ci] ?? '') : '', justification = ji >= 0 ? clean(r[ji] ?? '') : '';
      if (!clarification && !justification) continue;
      out[m[1]] = { description: m[2], unit: ui >= 0 ? clean(r[ui] ?? '') || undefined : undefined, clarification, justification };
    }
  }
  return out;
}

/* ---------- justification table from PDF layout ---------- */
export interface PdfItem { s: string; x: number; y: number; w: number; h: number }
export interface NoteColumns { unit: number; clar: number; just: number }

/**
 * Reads "Description | Unit | Clarification | Justification" from positioned PDF text. Cell text is wrapped
 * and vertically centred, so each column's lines are grouped into blocks (split at gaps wider than a line)
 * and every block is given to the line code whose row centre is nearest. Columns found on one page are
 * reused on following pages without a header.
 */
export function notesFromLayout(items: PdfItem[], prev?: NoteColumns): { notes: Record<string, BudgetNote>; cols?: NoteColumns } {
  const find = (re: RegExp) => items.find((i) => re.test(i.s));
  const hc = find(/^clarification/i), hj = find(/^justification/i), hu = find(/^unit$/i);
  const cols = hc && hj ? { unit: hu ? hu.x - 4 : hc.x - 60, clar: hc.x - 4, just: hj.x - 4 } : prev;
  if (!cols) return { notes: {} };
  const top = hc && hj ? Math.min(hc.y, hj.y) - 1 : Infinity;
  const body = items.filter((i) => i.y < top && i.s.trim());
  const anchors = body.filter((i) => i.x < cols.unit && /^\d{1,2}(?:\.\d{1,2}){1,4}\.?\s+\S/.test(i.s)).sort((a, b) => b.y - a.y);
  if (!anchors.length) return { notes: {}, cols };
  const blocks = (inCol: (i: PdfItem) => boolean) => {
    const L = body.filter(inCol).sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: { y: number; h: number; t: string }[] = [];
    for (const it of L) { const l = lines.find((x) => Math.abs(x.y - it.y) < Math.max(1.5, it.h * 0.4)); if (l) l.t += ' ' + it.s; else lines.push({ y: it.y, h: it.h || 7, t: it.s }); }
    const out: { lines: typeof lines }[] = [];
    for (const l of lines) { const b = out.at(-1); if (b && b.lines.at(-1)!.y - l.y < l.h * 1.9) b.lines.push(l); else out.push({ lines: [l] }); }
    return out.map((b) => ({ y: (b.lines[0].y + b.lines.at(-1)!.y) / 2, t: joinLines(b.lines.map((x) => x.t)) }));
  };
  const near = (y: number) => anchors.reduce((a, b) => (Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a));
  const notes: Record<string, BudgetNote> = {};
  const get = (a: PdfItem) => { const m = a.s.match(/^(\d{1,2}(?:\.\d{1,2}){1,4})\.?\s+(.*)$/)!; return (notes[m[1]] ??= { description: clean(m[2]), clarification: '', justification: '' }); };
  for (const a of anchors) get(a);
  // description continuation lines (e.g. "80%)") join the nearest code
  for (const b of blocks((i) => i.x < cols.unit && !anchors.includes(i))) { const n = get(near(b.y)); n.description = clean(`${n.description} ${b.t}`); }
  for (const b of blocks((i) => i.x >= cols.clar && i.x < cols.just)) { const n = get(near(b.y)); n.clarification = clean(`${n.clarification} ${b.t}`); }
  for (const b of blocks((i) => i.x >= cols.just)) { const n = get(near(b.y)); n.justification = clean(`${n.justification} ${b.t}`); }
  for (const [k, v] of Object.entries(notes)) if (!v.clarification && !v.justification) delete notes[k];
  return { notes, cols };
}

/* ---------- narrative risks & assumptions ("The risks are as follows: - … (medium)") ---------- */
const BULLET = /^\s*(?:[-–—•▪◦●]|\d{1,2}[.)])\s+/;
/** Bulleted items under a lead-in like "The risks are as follows:"; wrapped lines are joined, the list ends at the next prose line. */
function listAfter(paras: string[], lead: RegExp): string[] {
  const out: string[] = [];
  for (let i = 0; i < paras.length; i++) {
    if (!lead.test(paras[i])) continue;
    let cur = '';
    const first = paras.slice(i + 1).find((x) => x.trim());
    if (first && !BULLET.test(first)) { // Word lists carry no bullet character: one paragraph per item
      for (let j = i + 1; j < paras.length && j < i + 40; j++) {
        const l = paras[j].trim(); if (!l) continue;
        if (/:\s*$/.test(l) || /^\d+(\.\d+)*\s+[A-Z]/.test(l) || /^As regards/i.test(l) || l.length > 400) break;
        out.push(l);
      }
      if (out.length) break; else continue;
    }
    for (let j = i + 1; j < paras.length && j < i + 80; j++) {
      const l = paras[j].trim(); if (!l) continue;
      if (BULLET.test(l)) { if (cur) out.push(cur); cur = l.replace(BULLET, ''); continue; }
      if (/^\d{1,3}$/.test(l)) continue; // page number between pages
      if (cur && !/[.;:]$/.test(cur) && /^[a-z(]/.test(l)) { cur = joinLines([cur, l]); continue; } // wrapped line
      if (cur && /^[a-z]/.test(l)) { cur = joinLines([cur, l]); continue; }
      break;
    }
    if (cur) out.push(cur);
    if (out.length) break;
  }
  return out.map((x) => x.replace(/[;,]?\s*(?:and)?\s*$/, '').replace(/\s*;\s*and$/, '').trim()).filter((x) => x.length > 3);
}
const RATE: Record<string, string> = { 'very low': '1', low: '2', medium: '3', moderate: '3', high: '4', 'very high': '5' };
export function narrativeRisks(doc: Doc): { risks: Risk[]; assumptions: string[]; mitigation: string[] } {
  const P = doc.paragraphs;
  const mitigation = listAfter(P, /mitigation measures (?:are|include)[^:]*:\s*$/i);
  const risks = listAfter(P, /\b(?:the )?(?:main )?risks (?:are|include)[^:]*:\s*$/i).map((t, k) => {
    const m = t.match(/\((very low|low|medium|moderate|high|very high)\)\s*\.?$/i);
    const lvl = m ? RATE[m[1].toLowerCase()] : '3';
    const title = t.replace(/\s*\((?:very low|low|medium|moderate|high|very high)\)\s*\.?$/i, '').replace(/\.$/, '');
    return { id: 'n' + k, title, category: /pandemic|covid|earthquake|disaster|flood/i.test(title) ? 'External' : /financ|fund|budget/i.test(title) ? 'Financial' : /communicat|co-?operation|interest|stakeholder|commitment/i.test(title) ? 'Institutional' : 'Operational', likelihood: lvl, impact: lvl, mitigation: mitigation.join(' · '), owner: '', status: 'Open', rating: m?.[1].toLowerCase() ?? '' } as Risk;
  });
  const assumptions = listAfter(P, /assumptions (?:are|include)[^:]*:\s*$/i);
  return { risks, assumptions, mitigation };
}
