import { saveFile } from './save';
import type PptxGenJS from 'pptxgenjs';
import { byCategory, elapsed, lineRows, money, riskScore } from '../domain/calc';
import type { ResultRow } from '../domain/results';
import type { Project, Risk } from '../domain/types';
import { TODAY } from '../today';
import { date, month, pct, short } from './format';

/** Everything the deck shows, computed once on the Presentation screen. */
export interface DeckModel {
  aud: 'management' | 'donor'; scope: string; logo?: string; cname: (id: string) => string; lab: (p: Project) => string;
  P: Project[]; T: { budget: number; spent: number; committed: number; exposure: number; remaining: number; elapsed: number; burn: number };
  perf: number; band: string; bandWord: (b: string) => string; PL: number; final: number | null;
  series: { t: number; actual: number | null; plan: number; mid: number | null }[];
  points: { label: string; text: string }[];
  H: { key: string; approved: number; actual: number; exposure: number }[];
  C: { key: string; count: number; budget: number; spent: number }[];
  moves: { p: Project; perf: number; prev: number | null; now: string }[];
  results: ResultRow[]; risks: { p: Project; r: Risk; sc: number }[];
  alerts: { projectId: string; severity: string; title: string }[];
  staff: { display: string; position: string; project: Project; end?: string | null }[]; renewals: number;
  offices: { name: string; ob: number; sc: number; end: number; request: number }[];
  events: { day: string; p: Project; title: string; sub?: string }[];
  catchUp: { p: Project; perf: number; rate: number; need: number }[];
  steps: string[]; pages: Project[];
  MS: Record<string, string>; NS: Record<string, string>;
}

const COL: Record<string, string> = { blue: '3B82C4', green: '30A46C', amber: 'F5A524', red: 'E5484D' };
const INK = '1B1D21', MUTED = '6B6F76', LINE = 'E3E4E8', ACCENT = '2F6FB3';
const F = 'Calibri';

/** Builds an editable PowerPoint deck (native tables and charts) and downloads it. */
export async function exportPptx(m: DeckModel) {
  const { default: Pptx } = await import('pptxgenjs');
  const ppt: PptxGenJS = new Pptx();
  ppt.layout = 'LAYOUT_WIDE'; // 13.33 × 7.5 in
  ppt.title = `${m.scope} — ${m.aud === 'donor' ? 'Progress report' : 'Management review'}`;
  const mg = m.aud === 'management';
  let n = 0;
  const total = 0;
  const slides: { s: PptxGenJS.Slide; n: number }[] = [];
  const page = (kicker: string, msg: string, sub?: string, notes?: string) => {
    const s = ppt.addSlide(); n += 1;
    s.background = { color: 'FFFFFF' };
    s.addShape('rect', { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: ACCENT }, line: { color: ACCENT } });
    s.addText(kicker.toUpperCase(), { x: 0.5, y: 0.3, w: 10, h: 0.3, fontFace: F, fontSize: 11, color: MUTED, bold: true, charSpacing: 1 });
    s.addText(msg, { x: 0.5, y: 0.6, w: 12.3, h: 0.8, fontFace: F, fontSize: 24, bold: true, color: INK, valign: 'top', fit: 'shrink' });
    if (sub) s.addText(sub, { x: 0.5, y: 1.35, w: 12.3, h: 0.3, fontFace: F, fontSize: 12, color: MUTED });
    s.addShape('line', { x: 0.5, y: 1.72, w: 12.33, h: 0, line: { color: LINE, width: 1 } });
    if (notes) s.addNotes(notes);
    slides.push({ s, n });
    return s;
  };
  const kpis = (s: PptxGenJS.Slide, y: number, K: [string, string, string?, string?][]) => {
    const w = (12.33 - 0.2 * (K.length - 1)) / K.length;
    K.forEach(([l, v, sm, c], i) => {
      const x = 0.5 + i * (w + 0.2);
      s.addShape('roundRect', { x, y, w, h: 1.15, fill: { color: 'F3F6FA' }, line: { color: 'DCE4EE' }, rectRadius: 0.08 });
      s.addText(l, { x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.28, fontFace: F, fontSize: 11, color: MUTED });
      s.addText(v, { x: x + 0.15, y: y + 0.36, w: w - 0.3, h: 0.45, fontFace: F, fontSize: 24, bold: true, color: c ?? INK });
      if (sm) s.addText(sm, { x: x + 0.15, y: y + 0.8, w: w - 0.3, h: 0.27, fontFace: F, fontSize: 10, color: MUTED });
    });
  };
  type Row = (string | number)[];
  const table = (s: PptxGenJS.Slide, head: string[], rows: Row[], o: { x?: number; y?: number; w?: number; colW?: number[]; right?: number[]; fill?: (string | undefined)[] } = {}) => {
    const R = (o.right ?? []);
    const hd = head.map((h, i) => ({ text: h, options: { bold: true, color: MUTED, fontSize: 10, align: (R.includes(i) ? 'right' : 'left') as 'right' | 'left', border: [{ type: 'none' }, { type: 'none' }, { pt: 1, color: LINE }, { type: 'none' }] } }));
    const body = rows.map((r, ri) => r.map((c, i) => ({ text: String(c), options: { fontSize: 10.5, color: INK, align: (R.includes(i) ? 'right' : 'left') as 'right' | 'left', ...(i === 0 && o.fill?.[ri] ? { border: [{ type: 'none' }, { type: 'none' }, { pt: 0.5, color: LINE }, { pt: 4, color: o.fill[ri] }] } : { border: [{ type: 'none' }, { type: 'none' }, { pt: 0.5, color: LINE }, { type: 'none' }] }) } })));
    s.addTable([hd, ...body] as PptxGenJS.TableRow[], { x: o.x ?? 0.5, y: o.y ?? 1.95, w: o.w ?? 12.33, colW: o.colW, fontFace: F, autoPage: false, rowH: 0.3 });
  };
  const bullets = (s: PptxGenJS.Slide, items: string[], o: { x?: number; y?: number; w?: number; h?: number } = {}) =>
    s.addText(items.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), { x: o.x ?? 0.5, y: o.y ?? 2, w: o.w ?? 12.3, h: o.h ?? 4.8, fontFace: F, fontSize: 14, color: INK, valign: 'top', paraSpaceAfter: 6 });
  const cut = (s: string, k: number) => (s.length > k ? s.slice(0, k - 1) + '…' : s);
  const T = m.T, today = TODAY.toISOString().slice(0, 10);

  // 1 Cover
  { const s = ppt.addSlide(); n += 1; slides.push({ s, n });
    s.background = { color: '0E1A2B' };
    if (m.logo?.startsWith('data:')) { const im = new Image(); im.src = m.logo; await im.decode().catch(() => {}); const h = 0.9, w = im.naturalHeight ? Math.min(3.5, (h * im.naturalWidth) / im.naturalHeight) : h;
      s.addShape('roundRect', { x: 0.65, y: 0.45, w: w + 0.3, h: h + 0.2, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.08 }); s.addImage({ data: m.logo, x: 0.8, y: 0.55, w, h }); }
    s.addText(`${mg ? 'Management review' : 'Progress report to the donor'} · ${date(today)}`.toUpperCase(), { x: 0.8, y: 1.6, w: 11, h: 0.4, fontFace: F, fontSize: 13, color: '9FB0C8', bold: true, charSpacing: 1 });
    s.addText(m.scope === 'Portfolio' ? 'Joint programme portfolio' : m.scope, { x: 0.8, y: 2.1, w: 11.5, h: 1.2, fontFace: F, fontSize: 40, bold: true, color: 'FFFFFF' });
    s.addText(`Financial and operational status of ${m.P.length} projects in ${new Set(m.P.map((p) => p.country)).size} countries`, { x: 0.8, y: 3.3, w: 11, h: 0.5, fontFace: F, fontSize: 16, color: 'C9D4E3' });
    [[short(T.budget), 'total budget'], [short(T.spent), 'spent to date'], [pct(m.perf), 'of planned spending']].forEach(([v, l], i) => {
      s.addText(v, { x: 0.8 + i * 3.4, y: 4.6, w: 3.2, h: 0.7, fontFace: F, fontSize: 32, bold: true, color: i === 2 ? COL[m.band] : 'FFFFFF' });
      s.addText(l, { x: 0.8 + i * 3.4, y: 5.3, w: 3.2, h: 0.4, fontFace: F, fontSize: 12, color: '9FB0C8' });
    });
  }

  // 2 Executive summary
  { const s = page('Executive summary', m.MS.executive, 'The position in one page', m.NS.executive);
    s.addShape('roundRect', { x: 0.5, y: 1.95, w: 12.33, h: 0.9, fill: { color: 'FFFFFF' }, line: { color: COL[m.band], width: 2 }, rectRadius: 0.1 });
    s.addText([{ text: m.bandWord(m.band) + '  ', options: { bold: true, color: COL[m.band] } }, { text: m.points[0]?.text ?? '' }], { x: 0.7, y: 2, w: 12, h: 0.8, fontFace: F, fontSize: 14, color: INK, valign: 'middle' });
    table(s, ['', ''], m.points.slice(1, 7).map((t) => [t.label.toUpperCase(), t.text]), { y: 3.1, colW: [2.2, 10.13] });
  }

  // 3 Financial position
  { const s = page('Financial position', m.MS.financial, `Budget-weighted time elapsed ${pct(T.elapsed)}`, m.NS.financial);
    kpis(s, 1.95, [['Budget', short(T.budget), `${m.P.length} projects`], ['Spent', short(T.spent), `${pct(T.burn)} of budget`], ['Committed', short(T.committed), 'open contracts and orders'], ['Uncommitted', short(T.remaining), `${pct(T.budget ? T.remaining / T.budget : 0)} still free`]]);
    s.addChart('bar', [{ name: 'Spent', labels: ['Budget'], values: [T.spent] }, { name: 'Committed', labels: ['Budget'], values: [T.committed] }, { name: 'Uncommitted', labels: ['Budget'], values: [Math.max(0, T.remaining)] }],
      { x: 0.5, y: 3.4, w: 12.33, h: 1.6, barDir: 'bar', barGrouping: 'percentStacked', chartColors: [ACCENT, '9CC0E6', 'E3E4E8'], showLegend: true, legendPos: 'b', legendFontSize: 10, catAxisHidden: true, valAxisHidden: true, valGridLine: { style: 'none' }, showValue: true, dataLabelFormatCode: '#,##0', dataLabelFontSize: 10 });
    s.addText(`Time elapsed ${pct(T.elapsed)} · spent + committed ${pct(T.budget ? T.exposure / T.budget : 0)} of budget · spent vs planned to date ${pct(m.perf)}`, { x: 0.5, y: 5.3, w: 12.3, h: 0.4, fontFace: F, fontSize: 13, color: INK });
  }

  // 4 Spending over time — native line chart
  { const s = page('Spending over time', m.MS.spending, 'Cumulative actual spend against the linear plan and the forecast at the recent pace', m.NS.spending);
    const S = m.series.filter((_, i, a) => i % Math.max(1, Math.ceil(a.length / 40)) === 0 || i === a.length - 1), L = S.map((x) => month(x.t));
    s.addChart('line', [{ name: 'Actual', labels: L, values: S.map((x) => x.actual ?? null) as number[] }, { name: 'Linear plan', labels: L, values: S.map((x) => x.plan) }, { name: 'Forecast', labels: L, values: S.map((x) => (x.actual == null ? x.mid : null) ?? null) as number[] }],
      { x: 0.5, y: 1.9, w: 8.8, h: 5, chartColors: [ACCENT, '8B8D98', 'F5A524'], lineSize: 2, lineDataSymbol: 'none', showLegend: true, legendPos: 'b', valAxisLabelFormatCode: '#,##0', catAxisLabelFontSize: 9, valAxisLabelFontSize: 9, catAxisLabelRotate: -45, valGridLine: { color: 'EEEEEE', size: 0.5 } });
    kpisCol(s, [['Planned by now', short(m.PL)], ['Actually spent', short(T.spent)], ['Gap to plan', short(T.spent - m.PL)], ...(m.final != null ? [['Forecast at end', short(m.final)] as [string, string]] : [])]);
  }
  function kpisCol(s: PptxGenJS.Slide, K: [string, string][]) {
    K.forEach(([l, v], i) => { s.addText(l, { x: 9.7, y: 2 + i * 1.15, w: 3.1, h: 0.3, fontFace: F, fontSize: 11, color: MUTED }); s.addText(v, { x: 9.7, y: 2.3 + i * 1.15, w: 3.1, h: 0.55, fontFace: F, fontSize: 24, bold: true, color: INK }); });
  }

  // 5 Budget by heading — clustered bars
  { const s = page('Budget by heading', m.MS.budget, 'Approved budget and use (spent + committed) per cost heading', m.NS.budget);
    if (m.H.length) {
      const L = m.H.map((h) => cut(h.key, 28));
      s.addChart('bar', [{ name: 'Approved', labels: L, values: m.H.map((h) => h.approved) }, { name: 'Spent + committed', labels: L, values: m.H.map((h) => h.exposure) }],
        { x: 0.5, y: 1.9, w: 6.6, h: 5.1, barDir: 'bar', chartColors: ['C9D4E3', ACCENT], showLegend: true, legendPos: 'b', valAxisLabelFormatCode: '#,##0', catAxisLabelFontSize: 9, valAxisLabelFontSize: 9 });
      table(s, ['Heading', 'Approved', 'Used'], m.H.map((h) => [cut(h.key, 30), short(h.approved), pct(h.approved ? h.exposure / h.approved : 0)]), { x: 7.4, w: 5.43, colW: [3.03, 1.3, 1.1], right: [1, 2] });
    } else s.addText('No financial reports with budget lines yet.', { x: 0.5, y: 2, w: 12, h: 0.4, fontFace: F, fontSize: 14, color: MUTED, italic: true });
  }

  // 6 Countries
  { const s = page('Where the money goes', m.MS.where, 'Budget and spending by country', m.NS.where);
    const L = m.C.map((c) => m.cname(c.key));
    s.addChart('bar', [{ name: 'Budget', labels: L, values: m.C.map((c) => c.budget) }, { name: 'Spent', labels: L, values: m.C.map((c) => c.spent) }], { x: 0.5, y: 1.9, w: 6.2, h: 5, barDir: 'col', chartColors: ['C9D4E3', ACCENT], showLegend: true, legendPos: 'b', valAxisLabelFormatCode: '#,##0', valAxisLabelFontSize: 9 });
    table(s, ['Country', 'Projects', 'Budget', 'Share', 'Spent'], m.C.map((c) => [m.cname(c.key), c.count, short(c.budget), pct(T.budget ? c.budget / T.budget : 0), short(c.spent)]), { x: 7, w: 5.83, right: [1, 2, 3, 4] });
  }

  // 7 Project status
  { const s = page('Project status', m.MS.project, 'Spending against plan to date — weakest first', m.NS.project);
    const M = m.moves.slice(0, 14);
    table(s, ['Project', 'Country', 'Budget', 'Spent', 'vs plan', 'Trend', 'Status'], M.map((x) => { const mm = money(x.p); return [`${m.lab(x.p)} ${cut(x.p.name, 55)}`, m.cname(x.p.country), short(mm.budget), short(mm.spent), `${Math.round(x.perf * 100)}%`, x.prev == null ? '—' : `${x.perf - x.prev >= 0 ? '+' : ''}${Math.round((x.perf - x.prev) * 100)} pp`, m.bandWord(x.now)]; }),
      { colW: [5.4, 1.4, 1.1, 1.1, 1, 1, 1.33], right: [2, 3, 4, 5], fill: M.map((x) => COL[x.now]) });
  }

  // Results (donor)
  if (!mg) {
    const R = m.results, I = R.reduce((a, r) => a + r.measured, 0);
    const s = page('Results', m.MS.results, 'Logframe indicators against their targets, by project', m.NS.results);
    if (I) s.addChart('doughnut', [{ name: 'Indicators', labels: ['Reached', 'Other measured', 'Behind'], values: [R.reduce((a, r) => a + r.reached, 0), Math.max(0, I - R.reduce((a, r) => a + r.reached + r.behind, 0)), R.reduce((a, r) => a + r.behind, 0)] }], { x: 0.5, y: 1.9, w: 3.6, h: 3.6, chartColors: ['30A46C', '3B82C4', 'E5484D'], showLegend: true, legendPos: 'b', holeSize: 60, showPercent: true });
    table(s, ['Project', 'Indicators', 'Measured', 'Reached', 'Behind', 'Results', 'Note'], R.map((r) => [`${m.lab(r.p)} ${cut(r.p.name, 34)}`, r.n, r.measured, r.reached, r.behind, r.results == null ? '—' : pct(r.results), r.flag ?? '']), { x: I ? 4.4 : 0.5, w: I ? 8.43 : 12.33, right: [1, 2, 3, 4, 5] });
  }

  // 8 Risks
  { const s = page('Risks and issues', m.MS.risks, 'Open risks from the registers and the most serious alerts', m.NS.risks);
    if (m.risks.length) table(s, ['Project', 'Risk', 'Mitigation', 'Score'], m.risks.map((x) => [m.lab(x.p), cut(x.r.title, 70), cut(x.r.mitigation ?? '', 80), x.sc]), { w: mg ? 8 : 12.33, colW: mg ? [1.1, 3.2, 3.1, 0.6] : [1.3, 5, 5.3, 0.73], right: [3] });
    else s.addText('No open risks recorded.', { x: 0.5, y: 2, w: 7, h: 0.4, fontFace: F, fontSize: 14, color: MUTED, italic: true });
    if (mg) { s.addText('Alerts', { x: 8.8, y: 1.9, w: 4, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: INK }); bullets(s, m.alerts.slice(0, 9).map((a) => `${m.lab(m.P.find((p) => p.id === a.projectId)!)} — ${a.title}`), { x: 8.8, y: 2.3, w: 4.03, h: 4.6 }); }
  }

  // 9 Staff
  { const s = page('Staff', mg ? `${m.staff.length} active staff; ${m.renewals} contract${m.renewals === 1 ? '' : 's'} end within 90 days` : `${m.staff.length} staff paid from ${new Set(m.staff.map((a) => a.project.id)).size} projects`, 'Staff paid from the projects');
    if (mg && m.staff.length) {
      const L = [...m.staff].sort((a, b) => m.lab(a.project).localeCompare(m.lab(b.project))), half = L.length > 14 ? Math.ceil(L.length / 2) : L.length;
      const rows = (X: typeof L) => X.map((a) => [a.display, cut(a.position, 34), m.lab(a.project), a.end ? date(a.end) : '—']);
      table(s, ['Name', 'Position', 'Project', 'Ends'], rows(L.slice(0, half)), { w: half < L.length ? 6.05 : 12.33, colW: half < L.length ? [1.7, 2.3, 0.95, 1.1] : undefined });
      if (half < L.length) table(s, ['Name', 'Position', 'Project', 'Ends'], rows(L.slice(half)), { x: 6.78, w: 6.05, colW: [1.7, 2.3, 0.95, 1.1] });
    } else s.addText(mg ? 'No active staff on file.' : 'Names and contract details are in the management version.', { x: 0.5, y: 2, w: 12, h: 0.4, fontFace: F, fontSize: 14, color: MUTED, italic: true });
  }

  // Offices (management)
  if (mg && m.offices.length) {
    const s = page('Office running costs', `${m.offices.length} office${m.offices.length > 1 ? 's' : ''}: ordinary budget ${short(m.offices.reduce((a, o) => a + o.ob, 0))}, year-end outlook ${short(m.offices.reduce((a, o) => a + o.end, 0))}`, 'Ordinary Budget — latest situation and year-end outlook');
    table(s, ['Office', 'Ordinary budget', 'Spent + committed', 'Year-end outlook', 'Request'], m.offices.map((o) => [o.name, short(o.ob), short(o.sc), short(o.end), o.request > 0 ? short(o.request) : '—']), { right: [1, 2, 3, 4] });
  }

  // Milestones
  { const s = page('Upcoming milestones', m.MS.upcoming, 'Next 90 days: reports due, planned activity ends and project end dates', m.NS.upcoming);
    if (m.events.length) table(s, ['Date', 'Project', 'Milestone', ''], m.events.map((e) => [date(e.day), m.lab(e.p), cut(e.title, 70), cut(e.sub ?? '', 50)]), { colW: [1.4, 1.3, 5.6, 4.03] });
    else s.addText('Nothing due in the next 90 days.', { x: 0.5, y: 2, w: 12, h: 0.4, fontFace: F, fontSize: 14, color: MUTED, italic: true });
  }

  // Next steps
  { const s = page('Next steps', m.MS.next, mg ? 'What is needed to get back on plan within three months' : 'Agreed actions', m.NS.next);
    let y = 1.95;
    if (mg && m.catchUp.length) { table(s, ['Project', 'Now', 'Current pace / month', 'Needed / month', 'Factor'], m.catchUp.map((c) => [`${m.lab(c.p)} ${cut(c.p.name, 50)}`, `${Math.round(c.perf * 100)}%`, short(c.rate), short(c.need), c.rate ? `×${(c.need / c.rate).toFixed(1)}` : '—']), { right: [1, 2, 3, 4], colW: [6.33, 1.2, 1.8, 1.8, 1.2] }); y = 2.4 + 0.3 * m.catchUp.length; }
    bullets(s, m.steps, { y, h: 6.9 - y });
  }

  // One page per project
  for (const p of m.pages) {
    const mm = money(p), el = elapsed(p, TODAY), mv = m.moves.find((x) => x.p === p), b = mv?.now ?? 'green', rr = m.results.find((r) => r.p === p);
    const s = page(`${m.lab(p)} · ${m.cname(p.country)}`, p.name, `${date(p.start)} → ${date(p.end)} · ${pct(el)} of time elapsed`, `${m.bandWord(b)}: ${short(mm.spent)} spent of ${short(mm.budget)}, ${short(mm.committed)} committed.`);
    kpis(s, 1.95, [['Budget', short(mm.budget), p.approvedBudget ? 'approved budget' : 'project amount'], ['Spent', short(mm.spent), `${pct(mm.budget ? mm.spent / mm.budget : 0)} at ${pct(el)} of time`], ['Committed', short(mm.committed), `uncommitted ${short(mm.remaining)}`], ['Status', m.bandWord(b), mv ? `${Math.round(mv.perf * 100)}% of planned spending` : '', COL[b]]]);
    const hp = byCategory(lineRows([p])).filter((h) => h.approved > 0);
    if (hp.length) s.addChart('bar', [{ name: 'Approved', labels: hp.map((h) => cut(h.key, 26)), values: hp.map((h) => h.approved) }, { name: 'Spent + committed', labels: hp.map((h) => cut(h.key, 26)), values: hp.map((h) => h.exposure) }], { x: 0.5, y: 3.3, w: 7, h: 3.7, barDir: 'bar', chartColors: ['C9D4E3', ACCENT], showLegend: true, legendPos: 'b', valAxisLabelFormatCode: '#,##0', catAxisLabelFontSize: 9, valAxisLabelFontSize: 9 });
    else s.addText('No financial report yet.', { x: 0.5, y: 3.4, w: 7, h: 0.4, fontFace: F, fontSize: 13, color: MUTED, italic: true });
    const rk = (p.riskRegister ?? []).filter((r) => (r.status ?? 'Open') === 'Open').sort((a, c) => riskScore(c) - riskScore(a)).slice(0, 3);
    s.addText('Results and risks', { x: 7.9, y: 3.3, w: 4.9, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: INK });
    bullets(s, [rr && rr.n ? `${rr.n} indicators, ${rr.measured} measured, ${rr.reached} reached${rr.behind ? `, ${rr.behind} behind` : ''}` : 'No logframe indicators on file', ...(rk.length ? rk.map((r) => `Risk: ${cut(r.title, 70)}`) : ['No open risks recorded'])], { x: 7.9, y: 3.7, w: 4.93, h: 3.2 });
  }

  // Annex
  { const s = page('Annex', 'Method and definitions');
    table(s, ['Term', 'Definition'], [
      ['Planned to date', 'Budget × share of the implementation period elapsed (linear plan).'],
      ['Spent vs planned', 'Actual spending ÷ planned to date. Blue ≥ 100%, green 90–100%, amber 70–90%, red below 70%.'],
      ['Committed', 'Open contracts and purchase orders not yet paid, from the latest financial report.'],
      ['Forecast', "Recent monthly spending rate continued to the end date, ±20% band; capped at each project's budget."],
      ['Trend', 'Change in spent vs planned since the previous financial report, in percentage points.'],
      ['Risk score', 'Likelihood × impact (1–5 each) from the project risk registers.'],
      ['Source', `Financial report workbooks and contract documents loaded in the Portfolio Ledger; figures at ${date(today)}.`],
    ], { colW: [2.4, 9.93] });
  }

  // Footers once the count is known.
  void total;
  for (const { s, n: k } of slides) if (k > 1) s.addText([{ text: `${m.scope} · ${mg ? 'Management review' : 'Progress report'} · ${month(TODAY.getTime())}` }], { x: 0.5, y: 7.0, w: 9, h: 0.3, fontFace: F, fontSize: 9, color: MUTED }), s.addText(`${k} / ${n}`, { x: 11.3, y: 7.0, w: 1.53, h: 0.3, fontFace: F, fontSize: 9, color: MUTED, align: 'right' });
  const blob = (await ppt.write({ outputType: 'blob' })) as Blob;
  await saveFile(`${m.scope.replace(/\s+/g, '-')}-${mg ? 'management' : 'donor'}-${today}.pptx`, blob);
}
