import { useState } from 'preact/hooks';
import { updateProject } from '../data/store';
import { followUp, nextPlan, readWorkPlan, type WorkPlan as WP, type WpFollowUp } from '../domain/workplan';
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
        <button class="btn primary" onClick={() => { if (exportOk(p, 'the Work Plan follow-up')) download(`${p.bh ?? p.code}-WP${wp.no}-follow-up.xlsx`, [wpSheet(p, f)]); }}>⬇ WP follow-up</button>
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
      {wp.acts?.length ? <details class="wp-acts" open><summary>Activities in WP {wp.no} · {wp.acts.length} · {full(wp.acts.reduce((t, a) => t + a.amount, 0))}{wp.file ? ` · ${wp.file}` : ''}</summary>
        <table class="wp-t"><thead><tr><th>Ref.</th><th>Activity ID</th><th>Activity</th><th>Budget lines</th><th class="num">Estimated</th></tr></thead>
          <tbody>{wp.acts.map((a) => <tr><td>{a.ref}</td><td class="num">{a.id}</td><td>{a.name}</td><td class="muted">{a.lines.filter((l) => l.amount).map((l) => l.line).join(', ')}</td><td class="num">{full(a.amount)}</td></tr>)}</tbody></table></details> : null}
      <div class="wp-notes">
        <label class="n1">FOMA notes<textarea rows={3} value={wp.notes ?? ''} onChange={(e) => upd({ notes: (e.target as HTMLTextAreaElement).value })} /></label>
        <label>Project Teams — comments<textarea rows={3} value={wp.teams ?? ''} onChange={(e) => upd({ teams: (e.target as HTMLTextAreaElement).value })} /></label>
        <label>Head of Operations — comments<textarea rows={3} value={wp.hoo ?? ''} onChange={(e) => upd({ hoo: (e.target as HTMLTextAreaElement).value })} /></label>
      </div>
      <p class="muted" style={{ padding: '8px 20px 16px', fontSize: '12px' }}>Activity = all lines except heading 1 (staff costs), heading 4 (local office) and 10 (administrative costs). D sums the invoices and GL entries dated within the previous WP; E adds the open balance of POs raised in those dates.</p>
    </div>
  );
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
