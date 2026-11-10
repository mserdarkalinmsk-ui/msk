import { useState } from 'preact/hooks';
import { updateProject } from '../data/store';
import { byLine, carriedFrom, followUp, history, nextPlan, readWorkPlan, type WorkPlan as WP, type WpFollowUp } from '../domain/workplan';
import type { Project } from '../domain/types';
import type { WorkbookSummary } from '../domain/workbook';
import { TODAY } from '../today';
import { exportOk } from './exportGate';
import { readXlsx } from './xlsx';
import { date, full, pct } from './format';
import { download, type SheetSpec, type XCell } from './xlsxwrite';

const r = (a: number | null, b: number) => (a == null || !b ? null : a / b);
const tone = (x: number | null, good: number, bad: number) => (x == null ? '' : x >= good ? 'good' : x < bad ? 'serious' : 'warning');

export function WorkPlanView({ p, wb }: { p: Project; wb: WorkbookSummary }) {
  const plans = [...(p.workPlans ?? [])].sort((a, b) => a.no - b.no);
  const [sel, setSel] = useState<string>(plans.at(-1)?.id ?? '');
  const save = (list: WP[]) => updateProject(p.id, { workPlans: list });
  const [msg, setMsg] = useState('');
  const importFile = async (file: File) => {
    const x = await readXlsx(await file.arrayBuffer());
    const got = x.sheets.map((n) => readWorkPlan(x.read(n))).find(Boolean);
    if (!got) { setMsg(`${file.name}: no WorkPlan table found (title "Work plan for project … from … to …" and the Estimated budget column).`); return; }
    const same = plans.find((w) => w.from === got.from);
    const base = same ?? nextPlan(plans, TODAY);
    const w: WP = { ...base, from: got.from || base.from, to: got.to || base.to, planned: got.planned, acts: got.acts, file: file.name };
    save(same ? plans.map((y) => (y.id === w.id ? w : y)) : [...plans, w]); setSel(w.id);
    setMsg(`${file.name}: WP ${w.no} · ${got.acts.length} activities · ${full(got.planned)}${got.bh && p.bh && !p.bh.includes(got.bh.replace(/\D/g, '')) ? ` · budget head ${got.bh} differs from ${p.bh}` : ''}`);
  };
  const picker = <label class="btn">⬆ Import WorkPlan file<input type="file" accept=".xlsx,.xlsm" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void importFile(f); (e.target as HTMLInputElement).value = ''; }} /></label>;
  const add = () => { const w = nextPlan(plans, TODAY); save([...plans, w]); setSel(w.id); };
  if (!plans.length) return (
    <div class="empty-page" style={{ padding: '32px' }}><div><h2>No Work Plan yet</h2>
      <p>Add the quarterly Work Plan the project team sent: its dates and planned activity expenditure. Budgets and spending come from this report.</p>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>{picker}<button class="btn primary" onClick={add}>+ Add Work Plan</button></div>{msg && <p>{msg}</p>}</div></div>
  );
  const wp = plans.find((x) => x.id === sel) ?? plans.at(-1)!;
  const f = followUp(p, wb, wp, plans);
  const upd = (patch: Partial<WP>) => save(plans.map((x) => (x.id === wp.id ? { ...x, ...patch } : x)));
  const dPct = r(f.prevSpent, f.prev?.planned ?? 0), ePct = r(f.prevSc, f.prev?.planned ?? 0), remPct = r(f.remaining, f.activity);
  const Row = ({ k, label, a, b, c, cls }: { k?: string; label: string; a?: string; b?: string; c?: string; cls?: string }) =>
    <tr class={cls}><th>{k && <span class="wp-k">{k}</span>}{label}</th><td class="num">{a ?? ''}</td><td class="num">{b ?? ''}</td><td class="num">{c ?? ''}</td></tr>;
  return (
    <div class="wp">
      <div class="tools" style={{ padding: '0 20px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div class="seg">{plans.map((x) => <button aria-pressed={x.id === wp.id} onClick={() => setSel(x.id)}>WP {x.no}</button>)}</div>
        {picker}<button class="btn" onClick={add}>+ Next Work Plan</button>
        <button class="btn primary" onClick={() => { if (exportOk(p, 'the Work Plan follow-up')) download(`${p.bh ?? p.code}-WP${wp.no}-follow-up.xlsx`, [wpSheet(p, f), ...wpExtraSheets(wp, plans, wb)]); }}>⬇ WP follow-up</button>
        <button class="btn ghost" onClick={() => { if (confirm(`Delete WP ${wp.no}?`) && prompt('Admin password') === 'MSK') { save(plans.filter((x) => x.id !== wp.id)); setSel(''); } }}>Delete WP {wp.no}</button>
      </div>
      {msg && <p class="muted" style={{ padding: '0 20px 8px' }}>{msg}</p>}
      <div class="wp-edit">
        <label>WP No <input type="number" min={1} value={wp.no} onChange={(e) => upd({ no: Number((e.target as HTMLInputElement).value) || 1 })} /></label>
        <label>From <input type="date" value={wp.from} onChange={(e) => upd({ from: (e.target as HTMLInputElement).value })} /></label>
        <label>To <input type="date" value={wp.to} onChange={(e) => upd({ to: (e.target as HTMLInputElement).value })} /></label>
        <label>Planned activity expenditure (€) <input type="number" step="0.01" value={wp.planned || ''} onChange={(e) => upd({ planned: Number((e.target as HTMLInputElement).value) || 0 })} /></label>
      </div>
      <div class="wp-kpi">
        <div class={`k ${tone(r(f.sc, f.activity), 0, 0)}`}><span>Activity spent & committed</span><b>{pct(r(f.sc, f.activity) ?? 0, 1)}</b><i style={{ width: `${Math.min(100, (r(f.sc, f.activity) ?? 0) * 100)}%` }} /></div>
        <div class={`k ${tone(dPct, 0.8, 0.5)}`}><span>Previous WP delivered (spent)</span><b>{dPct == null ? '—' : pct(dPct)}</b><i style={{ width: `${Math.min(100, (dPct ?? 0) * 100)}%` }} /></div>
        <div class={`k ${tone(ePct, 0.8, 0.5)}`}><span>Previous WP spent & committed</span><b>{ePct == null ? '—' : pct(ePct)}</b><i style={{ width: `${Math.min(100, (ePct ?? 0) * 100)}%` }} /></div>
        <div class={`k ${f.remaining < 0 ? 'serious' : ''}`}><span>Remaining after this WP · {f.remainingMonths} months</span><b>{full(f.remaining)}</b><i style={{ width: `${Math.max(0, Math.min(100, (remPct ?? 0) * 100))}%` }} /></div>
      </div>
      <table class="wp-t">
        <thead><tr><th colSpan={4}>{p.bh ? `${p.bh} — ` : ''}{p.name}<br /><b>WP No:{wp.no} — {date(wp.from)} / {date(wp.to)}</b></th></tr></thead>
        <tbody>
          <Row label="Total Project Budget" a={full(f.total)} cls="y" />
          <Row label="Total Eligible Budget (excl. 7% administrative costs)" a={full(f.eligible)} cls="y" />
          <Row label="Total Activity Budget (excl. staff salaries & office costs)" a={full(f.activity)} b={`staff ${full(f.staff)}`} c={`office ${full(f.office)}`} cls="y" />
          <Row label="Total Project Duration" a={date(f.start)} b={date(f.end)} c={`${f.duration} months`} cls="y" />
          <Row label={`WP No:${wp.no} — Activity Planned Expenditure`} a={full(wp.planned)} cls="b" />
          <Row label={`Total time elapsed until ${f.prev ? `WP No:${f.prev.no}` : 'this WP'}`} a={date(f.elapsedFrom)} b={f.elapsedTo ? date(f.elapsedTo) : ''} c={`${f.elapsed} months`} cls="g" />
          <Row k="A" label={`Total Activity Spent Amount (fin. rep. date ${f.asAt ? date(f.asAt) : '—'})`} a={full(f.spent)} b={pct(r(f.spent, f.activity) ?? 0, 1)} cls="g" />
          <Row k="B" label={`Total Activity Spent & Committed Amount (fin. rep. date ${f.asAt ? date(f.asAt) : '—'})`} a={full(f.sc)} b={pct(r(f.sc, f.activity) ?? 0, 1)} cls="g" />
          {f.prev ? <>
            <Row k="C" label={`Previous WP No:${f.prev.no} Planned Amount (${date(f.prev.from)} / ${date(f.prev.to)})`} a={full(f.prev.planned)} cls="g" />
            <Row k="D" label={`Previous WP No:${f.prev.no} Activity Spent Amount (${date(f.prev.from)} / ${date(f.prev.to)})`} a={f.prevSpent == null ? '—' : full(f.prevSpent)} c={dPct == null ? '' : pct(dPct)} cls={`g ${tone(dPct, 0.8, 0.5)}`} />
            <Row k="E" label={`Previous WP No:${f.prev.no} Activity Spent & Committed Amount (${date(f.prev.from)} / ${date(f.prev.to)})`} a={f.prevSc == null ? '—' : full(f.prevSc)} c={ePct == null ? '' : pct(ePct)} cls={`g ${tone(ePct, 0.8, 0.5)}`} />
          </> : <tr class="g"><th colSpan={4} class="muted">C–E appear once the previous Work Plan is entered.</th></tr>}
          <Row label="Remaining budget with WP" a={full(f.remaining)} b={pct(remPct ?? 0)} cls={`b ${f.remaining < 0 ? 'serious' : ''}`} />
          <Row label="Remaining months with WP" a={String(f.remainingMonths)} cls="b" />
        </tbody>
      </table>
      <WpCompare plans={plans} wb={wb} sel={wp.id} onPick={setSel} />
      {wp.acts?.length ? <WpDetail wp={wp} plans={plans} wb={wb} /> : null}
      <div class="wp-notes">
        <label class="n1">FOMA notes<textarea rows={3} value={wp.notes ?? ''} onChange={(e) => upd({ notes: (e.target as HTMLTextAreaElement).value })} /></label>
        <label>Project Teams — comments<textarea rows={3} value={wp.teams ?? ''} onChange={(e) => upd({ teams: (e.target as HTMLTextAreaElement).value })} /></label>
        <label>Head of Operations — comments<textarea rows={3} value={wp.hoo ?? ''} onChange={(e) => upd({ hoo: (e.target as HTMLTextAreaElement).value })} /></label>
      </div>
      <p class="muted" style={{ padding: '8px 20px 16px', fontSize: '12px' }}>Activity = all lines except heading 1 (staff costs), heading 4 (local office) and 10 (administrative costs). D sums the invoices and GL entries dated within the previous WP; E adds the open balance of POs raised in those dates.</p>
    </div>
  );
}

function WpCompare({ plans, wb, sel, onPick }: { plans: WP[]; wb: WorkbookSummary; sel: string; onPick: (id: string) => void }) {
  const H = history(plans, wb);
  if (H.length < 2) return null;
  const max = Math.max(...H.map((h) => Math.max(h.wp.planned, h.sc ?? 0)), 1);
  const done = H.filter((h) => h.spentPct != null && h.wp.to < (wb.meta.situationDate || wb.meta.asAt || '9'));
  const avg = done.length ? done.reduce((s, h) => s + (h.spentPct ?? 0), 0) / done.length : null;
  return (
    <div class="wp-sec"><h3>Comparison with previous Work Plans{avg != null ? <span class="muted"> · average delivery (spent / planned) of closed WPs {pct(avg)}</span> : null}</h3>
      <div class="wp-bars">{H.map((h) => <button class={`wp-bar ${h.wp.id === sel ? 'on' : ''}`} onClick={() => onPick(h.wp.id)} title={`WP ${h.wp.no}: planned ${full(h.wp.planned)} · spent ${h.spent == null ? '—' : full(h.spent)} · spent & committed ${h.sc == null ? '—' : full(h.sc)}`}>
        <div class="cols"><i class="pl" style={{ height: `${(h.wp.planned / max) * 100}%` }} /><i class="sc" style={{ height: `${((h.sc ?? 0) / max) * 100}%` }} /><i class="sp" style={{ height: `${((h.spent ?? 0) / max) * 100}%` }} /></div>
        <b>WP {h.wp.no}</b><span class={tone(h.spentPct, 0.8, 0.5)}>{h.spentPct == null ? '—' : pct(h.spentPct)}</span></button>)}</div>
      <div class="tools legend" style={{ padding: '4px 0 8px' }}><span><i style={{ background: 'var(--c3, #9aa4b2)' }} />Planned</span><span><i style={{ background: 'var(--c1)', opacity: .4 }} />Spent & committed</span><span><i style={{ background: 'var(--c1)' }} />Spent</span></div>
      <table class="wp-t"><thead><tr><th>WP</th><th>Period</th><th class="num">Planned</th><th class="num">Spent in period</th><th class="num">%</th><th class="num">Spent & committed</th><th class="num">%</th><th class="num">Change vs previous plan</th><th class="num">Activities · carried over</th></tr></thead>
        <tbody>{H.map((h, i) => { const d = i ? h.wp.planned - H[i - 1].wp.planned : null; return (
          <tr class={h.wp.id === sel ? 'sel' : ''}><td><b>WP {h.wp.no}</b></td><td>{h.wp.from ? `${date(h.wp.from)} – ${date(h.wp.to)}` : '—'}</td><td class="num">{full(h.wp.planned)}</td>
            <td class="num">{h.spent == null ? '—' : full(h.spent)}</td><td class={`num ${tone(h.spentPct, 0.8, 0.5)}`}>{h.spentPct == null ? '—' : pct(h.spentPct)}</td>
            <td class="num">{h.sc == null ? '—' : full(h.sc)}</td><td class={`num ${tone(h.scPct, 0.8, 0.5)}`}>{h.scPct == null ? '—' : pct(h.scPct)}</td>
            <td class="num">{d == null ? '' : `${d >= 0 ? '+' : ''}${full(d)}`}</td><td class="num">{h.acts ? `${h.acts} · ${h.carried}` : '—'}</td></tr>); })}</tbody></table>
    </div>);
}

function WpDetail({ wp, plans, wb }: { wp: WP; plans: WP[]; wb: WorkbookSummary }) {
  const carried = carriedFrom(plans, wp), L = byLine(wp, wb);
  const over = L.filter((l) => l.after < 0);
  return (
    <>
      <details class="wp-sec" open><summary>Activities in WP {wp.no} · {wp.acts!.length} · {full(wp.acts!.reduce((t, a) => t + a.amount, 0))}{carried.size ? ` · ${carried.size} carried over from earlier WPs` : ''}{wp.file ? ` · ${wp.file}` : ''}</summary>
        <table class="wp-t"><thead><tr><th>Ref.</th><th>Activity ID</th><th>Activity</th><th>Budget lines</th><th class="num">Estimated</th><th>Earlier WPs</th></tr></thead>
          <tbody>{[...wp.acts!].sort((a, b) => b.amount - a.amount).map((a) => { const c = carried.get(a.id); return (
            <tr class={c ? 'warning' : ''}><td>{a.ref}</td><td class="num">{a.id}</td><td>{a.name}</td><td class="muted">{a.lines.filter((l) => l.amount).map((l) => `${l.line} ${full(l.amount)}`).join(' · ')}</td><td class="num">{full(a.amount)}</td>
              <td>{c ? <span class="badge warning">Also in WP {c.join(', ')}</span> : <span class="muted">new</span>}</td></tr>); })}</tbody></table></details>
      <details class="wp-sec" open><summary>By budget line · {L.length} lines{over.length ? ` · ${over.length} above what is left` : ''}</summary>
        <table class="wp-t"><thead><tr><th>Line</th><th>Description</th><th class="num">Budget</th><th class="num">Spent & committed</th><th class="num">Left</th><th class="num">WP {wp.no} plan</th><th class="num">Left after WP</th></tr></thead>
          <tbody>{L.map((l) => <tr class={l.after < 0 ? 'serious' : ''}><td class="num">{l.line}</td><td>{l.description}</td><td class="num">{full(l.budget)}</td><td class="num">{full(l.sc)}</td><td class="num">{full(l.left)}</td><td class="num">{full(l.planned)}</td><td class="num">{full(l.after)}</td></tr>)}</tbody></table></details>
    </>);
}

export function wpSheet(p: Project, f: WpFollowUp): SheetSpec {
  const d = (s: string) => (s ? date(s) : ''), M = (v: number | null): XCell => ({ v: v == null ? '' : v, st: 'money' }), P = (v: number | null): XCell => ({ v: v == null ? '' : v, st: 'rPct' });
  const L = (v: string): XCell => ({ v, st: 'bold' }), wp = f.wp, pr = f.prev;
  const rows: (string | number | XCell | null)[][] = [
    [{ v: `${p.bh ? `${p.bh} - ` : ''}${p.name}`, st: 'title' }],
    [{ v: `WP No:${wp.no} - ${d(wp.from)} / ${d(wp.to)}`, st: 'title' }],
    [],
    [L('Total Project Budget'), M(f.total)],
    [L('Total Eligible Budget (Exc. 7% administrative cost)'), M(f.eligible)],
    [L('Total Activity Budget (Exc. Staff Salaries & Office Costs)'), M(f.activity)],
    [L('Total Project Duration'), d(f.start), d(f.end), f.duration],
    [],
    [L(`WP No:${wp.no} - Activity Planned Expenditure`), M(wp.planned)],
    [],
    [L(`Total time elapsed until ${pr ? `WP No:${pr.no}` : 'this WP'}`), d(f.elapsedFrom), d(f.elapsedTo), f.elapsed],
    [L(`A - Total Activity Spent Amount (by Fin. Rep. Date: ${d(f.asAt)})`), M(f.spent), P(f.activity ? f.spent / f.activity : 0)],
    [L(`B - Total Activity Spent & Committed Amount (by Fin. Rep. Date: ${d(f.asAt)})`), M(f.sc), P(f.activity ? f.sc / f.activity : 0)],
    ...(pr ? [
      [L(`C - Previous WP No:${pr.no} Planned Amount (${d(pr.from)} / ${d(pr.to)})`), M(pr.planned)],
      [L(`D - Previous WP No:${pr.no} Activity Spent Amount (${d(pr.from)} / ${d(pr.to)})`), M(f.prevSpent), P(r(f.prevSpent, pr.planned))],
      [L(`E - Previous WP No:${pr.no} Activity Spent & Committed Amount (${d(pr.from)} / ${d(pr.to)})`), M(f.prevSc), P(r(f.prevSc, pr.planned))],
    ] : []),
    [],
    [L('Remaining budget with WP :'), M(f.remaining), P(f.activity ? f.remaining / f.activity : 0)],
    [L('Remaining month with WP'), f.remainingMonths],
    [],
    [L('FOMA NOTES:'), { v: wp.notes ?? '', st: 'wrap' }],
    [L('Project Teams - Comments:'), { v: wp.teams ?? '', st: 'wrap' }],
    [L('Head of Operations - Comments:'), { v: wp.hoo ?? '', st: 'wrap' }],
  ];
  return { name: `WP ${wp.no}`, rows, widths: [70, 18, 14, 10], freeze: 0, portrait: true, onePage: true };
}

function wpExtraSheets(wp: WP, plans: WP[], wb: WorkbookSummary): SheetSpec[] {
  const H = (v: string): XCell => ({ v, st: 'head' }), M = (v: number | null): XCell => ({ v: v ?? '', st: 'money' }), P = (v: number | null): XCell => ({ v: v ?? '', st: 'rPct' });
  const hist = history(plans, wb), carried = carriedFrom(plans, wp), out: SheetSpec[] = [];
  out.push({ name: 'WP comparison', widths: [8, 26, 14, 16, 8, 18, 8, 12, 12], rows: [
    ['WP', 'Period', 'Planned', 'Spent in period', '%', 'Spent & committed', '%', 'Activities', 'Carried over'].map(H),
    ...hist.map((h) => [`WP ${h.wp.no}`, h.wp.from ? `${date(h.wp.from)} - ${date(h.wp.to)}` : '', M(h.wp.planned), M(h.spent), P(h.spentPct), M(h.sc), P(h.scPct), h.acts, h.carried])] });
  if (wp.acts?.length) {
    out.push({ name: `WP ${wp.no} activities`, widths: [10, 12, 60, 14, 16], rows: [['Ref.', 'Activity ID', 'Activity', 'Estimated', 'Earlier WPs'].map(H),
      ...wp.acts.map((a) => [a.ref, a.id, a.name, M(a.amount), carried.get(a.id)?.map((n) => `WP ${n}`).join(', ') ?? ''])] });
    out.push({ name: `WP ${wp.no} by line`, widths: [10, 50, 14, 18, 14, 14, 16], rows: [['Line', 'Description', 'Budget', 'Spent & committed', 'Left', `WP ${wp.no} plan`, 'Left after WP'].map(H),
      ...byLine(wp, wb).map((l) => [l.line, l.description, M(l.budget), M(l.sc), M(l.left), M(l.planned), M(l.after)])] });
  }
  return out;
}
