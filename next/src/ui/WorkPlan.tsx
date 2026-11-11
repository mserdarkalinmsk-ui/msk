import { useState } from 'preact/hooks';
import { updateProject } from '../data/store';
import { byLine, carriedFrom, rollover, snapshot, followUp, history, nextPlan, readWorkPlan, type WorkPlan as WP, type WpFollowUp } from '../domain/workplan';
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
    const w: WP = { ...base, from: got.from || base.from, to: got.to || base.to, planned: got.planned, acts: got.acts, file: file.name, snap: base.snap ?? snapshot(wb) };
    save(same ? plans.map((y) => (y.id === w.id ? w : y)) : [...plans, w]); setSel(w.id);
    setMsg(`${file.name}: WP ${w.no} · ${got.acts.length} activities · ${full(got.planned)}${got.bh && p.bh && !p.bh.includes(got.bh.replace(/\D/g, '')) ? ` · budget head ${got.bh} differs from ${p.bh}` : ''}`);
  };
  const picker = <label class="btn">⬆ Import WorkPlan file<input type="file" accept=".xlsx,.xlsm" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void importFile(f); (e.target as HTMLInputElement).value = ''; }} /></label>;
  const add = () => { const w = { ...nextPlan(plans, TODAY), snap: snapshot(wb) }; save([...plans, w]); setSel(w.id); };
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
        <button class="btn" onClick={() => window.print()}>🖨 Print</button>
        <button class="btn ghost" onClick={() => { if (confirm(`Delete WP ${wp.no}?`) && prompt('Admin password') === 'MSK') { save(plans.filter((x) => x.id !== wp.id)); setSel(''); } }}>Delete WP {wp.no}</button>
      </div>
      {msg && <p class="muted" style={{ padding: '0 20px 8px' }}>{msg}</p>}
      <div class="wp-edit">
        <label>WP No <input type="number" min={1} value={wp.no} onChange={(e) => upd({ no: Number((e.target as HTMLInputElement).value) || 1 })} /></label>
        <label>From <input type="date" value={wp.from} onChange={(e) => upd({ from: (e.target as HTMLInputElement).value })} /></label>
        <label>To <input type="date" value={wp.to} onChange={(e) => upd({ to: (e.target as HTMLInputElement).value })} /></label>
        <label title="Leave empty to use the budget: staff salaries (1.1.1 local team, 1.2.1 HQ team) + heading 4 local office">Staff salaries + office costs (€) <input type="number" step="0.01" placeholder={(f.staff + f.office).toFixed(2)} value={p.wpDeduct ?? ''} onChange={(e) => { const v = (e.target as HTMLInputElement).value; updateProject(p.id, { wpDeduct: v === '' ? undefined : Number(v) }); }} /></label>
        <label>Planned activity expenditure (€) <input type="number" step="0.01" value={wp.planned || ''} onChange={(e) => upd({ planned: Number((e.target as HTMLInputElement).value) || 0 })} /></label>
      </div>
      <WpHero p={p} f={f} dPct={dPct} ePct={ePct} remPct={remPct} />
      <table class="wp-t">
        <thead><tr><th colSpan={4}>{p.bh ? `${p.bh} — ` : ''}{p.name}<br /><b>WP No:{wp.no} — {date(wp.from)} / {date(wp.to)}</b></th></tr></thead>
        <tbody>
          <Row label="Total Project Budget" a={full(f.total)} cls="y" />
          <Row label="Total Eligible Budget (excl. 7% administrative costs)" a={full(f.eligible)} cls="y" />
          <Row label="Total Activity Budget (excl. staff salaries & office costs)" a={full(f.activity)} b={f.manual ? `deducted ${full(f.eligible - f.activity)} (typed)` : `staff salaries ${full(f.staff)}`} c={f.manual ? `budget: ${full(f.staff + f.office)}` : `office ${full(f.office)}`} cls="y" />
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
      <WpRollover wp={wp} wb={wb} onLock={() => upd({ snap: snapshot(wb) })} />
      <WpCompare plans={plans} wb={wb} sel={wp.id} onPick={setSel} />
      {wp.acts?.length ? <WpDetail wp={wp} plans={plans} wb={wb} /> : null}
      <div class="wp-notes">
        <label class="n1"><span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>FOMA notes<button type="button" class="btn ghost" style={{ padding: '2px 8px', fontSize: '12px' }} title="Draft the note from the figures, carried-over activities and lines above what is left" onClick={() => { const t = fomaDraft(f, wp, plans, wb); if (!wp.notes || confirm('Replace the FOMA notes with a draft from the figures?')) upd({ notes: t }); }}>✎ Draft from figures</button></span><textarea rows={3} value={wp.notes ?? ''} onChange={(e) => upd({ notes: (e.target as HTMLTextAreaElement).value })} /></label>
        <label>Project Teams — comments<textarea rows={3} value={wp.teams ?? ''} onChange={(e) => upd({ teams: (e.target as HTMLTextAreaElement).value })} /></label>
        <label>Head of Operations — comments<textarea rows={3} value={wp.hoo ?? ''} onChange={(e) => upd({ hoo: (e.target as HTMLTextAreaElement).value })} /></label>
      </div>
      <p class="muted" style={{ padding: '8px 20px 16px', fontSize: '12px' }}>Activity = all lines except staff salaries (1.1.1 local team, 1.2.1 HQ team), heading 4 (local office) and 10 (administrative costs); consultants and per diems count as activity. D sums the invoices and GL entries dated within the previous WP; E adds the open balance of POs raised in those dates.</p>
    </div>
  );
}

/** Verdict on the WP: delivery of the previous plan, and whether this plan keeps pace with what is left. */
export function verdict(f: WpFollowUp, dPct: number | null) {
  const need = f.remainingMonths > 0 ? (f.activity - f.sc) / (f.remainingMonths + Math.max(1, (Date.parse(f.wp.to) - Date.parse(f.wp.from)) / 86400000 / 30)) : 0;
  const wpMonth = f.wp.planned / Math.max(1, Math.round((Date.parse(f.wp.to) - Date.parse(f.wp.from)) / 86400000 / 30));
  const timeUsed = f.duration ? f.elapsed / f.duration : 0, used = f.activity ? f.sc / f.activity : 0;
  const flags: string[] = [];
  if (f.remaining < 0) flags.push('plan exceeds the activity budget left');
  if (dPct != null && dPct < 0.5) flags.push(`previous WP delivered only ${pct(dPct)}`);
  if (used + 0.15 < timeUsed) flags.push(`${pct(used)} of the activity budget used against ${pct(timeUsed)} of time`);
  if (need > 0 && wpMonth < need * 0.6) flags.push(`plan per month (${full(wpMonth)}) is well below the pace needed to use the budget (${full(need)})`);
  const level = f.remaining < 0 || flags.length >= 2 ? 'serious' : flags.length ? 'warning' : 'good';
  return { level, label: level === 'good' ? 'On track' : level === 'warning' ? 'Watch' : 'At risk', flags, need, wpMonth, timeUsed, used } as const;
}

function Ring({ v, label, sub, color }: { v: number; label: string; sub?: string; color: string }) {
  const R = 34, C = 2 * Math.PI * R, x = Math.max(0, Math.min(1, v));
  return <div class="wp-ring"><svg viewBox="0 0 84 84" width="84" height="84" role="img" aria-label={`${label} ${pct(v)}`}><circle cx="42" cy="42" r={R} fill="none" stroke="var(--border)" stroke-width="8" /><circle cx="42" cy="42" r={R} fill="none" stroke={color} stroke-width="8" stroke-linecap="round" stroke-dasharray={`${C * x} ${C}`} transform="rotate(-90 42 42)" /><text x="42" y="47" text-anchor="middle" font-size="16" font-weight="700" fill="currentColor">{pct(v)}</text></svg><b>{label}</b>{sub && <span>{sub}</span>}</div>;
}

function WpHero({ p, f, dPct, ePct, remPct }: { p: Project; f: WpFollowUp; dPct: number | null; ePct: number | null; remPct: number | null }) {
  const V = verdict(f, dPct), c = (t: string) => (t === 'good' ? 'var(--good)' : t === 'warning' ? 'var(--warning)' : t === 'serious' ? 'var(--critical)' : 'var(--c1)');
  return (
    <div class="wp-hero">
      <div class="wp-hero-h">
        <div><span class="eyebrow">{p.bh ? `${p.bh} · ` : ''}Work Plan follow-up</span><h3>{p.name}</h3>
          <div class="wp-period">WP No:{f.wp.no} <b>{f.wp.from ? date(f.wp.from) : '—'} → {f.wp.to ? date(f.wp.to) : '—'}</b> · report of {f.asAt ? date(f.asAt) : '—'}</div></div>
        <div class={`wp-verdict ${V.level}`}><b>{V.label}</b>{V.flags.length ? <ul>{V.flags.map((x) => <li>{x}</li>)}</ul> : <span>Previous plan delivered and this plan keeps pace with the budget left.</span>}</div>
      </div>
      <div class="wp-hero-b">
        <Ring v={V.used} label="Activity budget used" sub={`S&C ${full(f.sc)} of ${full(f.activity)}`} color={V.used + 0.15 < V.timeUsed ? c('warning') : c('')} />
        <Ring v={V.timeUsed} label="Time elapsed" sub={`${f.elapsed} of ${f.duration} months`} color="var(--muted)" />
        <Ring v={dPct ?? 0} label={f.prev ? `WP ${f.prev.no} delivered` : 'Previous WP'} sub={f.prev ? `spent ${f.prevSpent == null ? '—' : full(f.prevSpent)} of ${full(f.prev.planned)}` : 'first Work Plan'} color={c(tone(dPct, 0.8, 0.5) || 'x')} />
        <Ring v={ePct ?? 0} label={f.prev ? `WP ${f.prev.no} spent & committed` : '—'} sub={f.prev && f.prevSc != null ? full(f.prevSc) : ''} color={c(tone(ePct, 0.8, 0.5) || 'x')} />
        <div class="wp-fig"><span>This WP plans</span><b>{full(f.wp.planned)}</b><span>{full(V.wpMonth)} / month</span>
          <span>Needed pace {V.need ? `${full(V.need)} / month` : '—'}</span></div>
        <div class={`wp-fig ${f.remaining < 0 ? 'serious' : ''}`}><span>Left after this WP</span><b>{full(f.remaining)}</b><span>{remPct == null ? '' : pct(remPct)} of activity budget · {f.remainingMonths} months</span></div>
      </div>
    </div>);
}

/** A first draft of the FOMA note from the figures, for the finance officer to check and complete. */
export function fomaDraft(f: WpFollowUp, wp: WP, plans: WP[], wb: WorkbookSummary): string {
  const out: string[] = [], carried = carriedFrom(plans, wp), lines = byLine(wp, wb).filter((l) => l.after < 0);
  if (f.prev) out.push(`Previous WP No:${f.prev.no} (${date(f.prev.from)} / ${date(f.prev.to)}): ${f.prevSpent == null ? '—' : full(f.prevSpent)} spent of ${full(f.prev.planned)} planned${f.prevSpent != null && f.prev.planned ? ` (${pct(f.prevSpent / f.prev.planned)})` : ''}; spent & committed ${f.prevSc == null ? '—' : full(f.prevSc)}.`);
  if (carried.size) { const A = (wp.acts ?? []).filter((a) => carried.has(a.id)); out.push(`${A.length} activit${A.length === 1 ? 'y' : 'ies'} (${A.map((a) => a.id).join(', ')}), approximately ${full(A.reduce((s, a) => s + a.amount, 0))}, ${A.length === 1 ? 'was' : 'were'} included in the earlier Work Plan(s) and transferred to WP No:${wp.no}.`); }
  if (wp.snap) { const R = rollover(wp.snap, wb); if (R.from !== R.to && R.open) out.push(`Of ${full(R.open)} committed when WP No:${wp.no} was prepared, ${full(R.spentSince)} has been spent, ${full(R.stillOpen)} is still open and ${full(R.released)} was released.`); }
  for (const l of lines) out.push(`Line ${l.line}${l.description ? ` (${l.description})` : ''}: WP plan ${full(l.planned)} exceeds the ${full(l.left)} left on the line by ${full(-l.after)}.`);
  out.push(`Remaining activity budget after this WP: ${full(f.remaining)} (${f.activity ? pct(f.remaining / f.activity) : '—'}) for ${f.remainingMonths} months.`);
  return out.join('\n\n');
}

const KIND = { spent: ['Fully spent', 'good'], partly: ['Partly spent', 'warning'], open: ['Not spent yet', 'serious'], released: ['Released / cancelled', 'neutral'] } as const;
function WpRollover({ wp, wb, onLock }: { wp: WP; wb: WorkbookSummary; onLock: () => void }) {
  const [show, setShow] = useState<'all' | 'spent' | 'partly' | 'open' | 'released' | 'new'>('all');
  const asAt = wb.meta.situationDate || wb.meta.asAt || '';
  if (!wp.snap) return <div class="wp-sec"><p class="muted">No report is locked to WP {wp.no}. <button class="btn" onClick={onLock}>Lock to the current report ({asAt ? date(asAt) : 'latest'})</button> — the next report then shows what became of today's commitments.</p></div>;
  const R = rollover(wp.snap, wb), same = R.from === R.to;
  const share = (v: number) => (R.open ? pct(v / R.open) : '—');
  const rows = show === 'new' ? [] : R.rows.filter((r) => show === 'all' || r.kind === show);
  return (
    <div class="wp-sec"><h3>Commitments since WP {wp.no} was prepared <span class="muted">· report of {wp.snap.asAt ? date(wp.snap.asAt) : '—'} → {R.to ? date(R.to) : '—'}</span>
      <button class="btn ghost" style={{ marginLeft: '8px' }} title="Replace the locked report with the one loaded now" onClick={() => { if (confirm(`Lock WP ${wp.no} to the report of ${asAt ? date(asAt) : 'now'}?`)) onLock(); }}>Re-lock</button></h3>
      {same ? <p class="muted">Locked to the report loaded now. Import the next report (e.g. when preparing WP {wp.no + 1}) and this shows how much of the {full(R.open)} committed was spent, is still open or was released.</p> : <>
        <div class="wp-kpi" style={{ padding: '0 0 10px' }}>
          <div class="k"><span>Committed when WP {wp.no} was prepared</span><b>{full(R.open)}</b><i style={{ width: '100%', opacity: .3 }} /></div>
          <div class="k good"><span>Spent since</span><b>{full(R.spentSince)}</b><span>{share(R.spentSince)}</span><i style={{ width: `${R.open ? (R.spentSince / R.open) * 100 : 0}%` }} /></div>
          <div class={`k ${R.stillOpen > 0.5 ? 'serious' : ''}`}><span>Still not spent</span><b>{full(R.stillOpen)}</b><span>{share(R.stillOpen)}</span><i style={{ width: `${R.open ? (R.stillOpen / R.open) * 100 : 0}%` }} /></div>
          <div class="k"><span>Released / cancelled</span><b>{full(R.released)}</b><span>{share(R.released)}</span><i style={{ width: `${R.open ? (R.released / R.open) * 100 : 0}%`, background: 'var(--muted)' }} /></div>
          <div class="k"><span>New POs since · activity spent growth</span><b>{R.newPos.length} · {full(R.spentGrowth)}</b><span>S&C growth {full(R.scGrowth)}</span></div>
        </div>
        <div class="seg" style={{ marginBottom: '8px' }}>{(['all', 'spent', 'partly', 'open', 'released', 'new'] as const).map((k) => <button aria-pressed={show === k} onClick={() => setShow(k)}>{k === 'all' ? `All ${R.rows.length}` : k === 'new' ? `New POs ${R.newPos.length}` : `${KIND[k][0]} ${R.rows.filter((r) => r.kind === k).length}`}</button>)}</div>
        {show === 'new'
          ? <table class="wp-t"><thead><tr><th>PO</th><th>Line</th><th>Description</th><th>Supplier</th><th class="num">Spent</th><th class="num">Open</th></tr></thead>
              <tbody>{R.newPos.map((x) => <tr><td class="num">{x.po}</td><td class="num">{x.line}</td><td>{x.description}</td><td>{x.supplier}</td><td class="num">{full(x.spent)}</td><td class="num">{full(x.open)}</td></tr>)}</tbody></table>
          : <table class="wp-t"><thead><tr><th>PO</th><th>Line</th><th>Description</th><th>Supplier</th><th class="num">Committed then</th><th class="num">Spent since</th><th class="num">Still open</th><th class="num">Released</th><th>Status</th></tr></thead>
              <tbody>{rows.map((r) => <tr><td class="num">{r.po}</td><td class="num">{r.line}</td><td>{r.description}</td><td>{r.supplier}</td><td class="num">{full(r.open)}</td><td class="num">{full(r.spentSince)}</td><td class="num">{full(r.stillOpen)}</td><td class="num">{full(r.released)}</td><td><span class={`badge ${KIND[r.kind][1]}`}>{KIND[r.kind][0]}</span></td></tr>)}</tbody></table>}
      </>}
    </div>);
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
  const over = L.filter((l) => l.after < 0), unb = L.filter((l) => l.unbudgeted);
  return (
    <>
      <details class="wp-sec" open><summary>Activities in WP {wp.no} · {wp.acts!.length} · {full(wp.acts!.reduce((t, a) => t + a.amount, 0))}{carried.size ? ` · ${carried.size} carried over from earlier WPs` : ''}{wp.file ? ` · ${wp.file}` : ''}</summary>
        <table class="wp-t"><thead><tr><th>Ref.</th><th>Activity ID</th><th>Activity</th><th>Budget lines</th><th class="num">Estimated</th><th>Earlier WPs</th></tr></thead>
          <tbody>{[...wp.acts!].sort((a, b) => b.amount - a.amount).map((a) => { const c = carried.get(a.id); return (
            <tr class={c ? 'warning' : ''}><td>{a.ref}</td><td class="num">{a.id}</td><td>{a.name}</td><td><div class="wp-chips">{a.lines.filter((l) => l.amount).map((l) => <span title={l.text}><b>{l.line}</b> {full(l.amount)}</span>)}</div></td><td class="num">{full(a.amount)}</td>
              <td>{c ? <span class="badge warning">Also in WP {c.join(', ')}</span> : <span class="muted">new</span>}</td></tr>); })}</tbody></table></details>
      <details class="wp-sec" open><summary>By budget line · {L.length} lines{over.length ? ` · ${over.length} above what is left` : ''}{unb.length ? ` · ${unb.length} not in the budget (check the line codes or the budget loaded)` : ''}</summary>
        <table class="wp-t"><thead><tr><th>Line</th><th>Description</th><th class="num">Budget</th><th class="num">Spent & committed</th><th class="num">Left</th><th class="num">WP {wp.no} plan</th><th class="num">Left after WP</th></tr></thead>
          <tbody>{L.map((l) => <tr class={l.after < 0 ? 'serious' : ''}><td class="num">{l.line}</td><td>{l.description}{l.unbudgeted && <span class="badge warning" style={{ marginLeft: '6px' }}>not in the budget</span>}</td><td class="num">{full(l.budget)}</td><td class="num">{full(l.sc)}</td><td class="num">{full(l.left)}</td><td class="num">{full(l.planned)}</td><td class="num">{full(l.after)}</td></tr>)}</tbody></table></details>
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
  if (wp.snap) { const R = rollover(wp.snap, wb);
    out.push({ name: `WP ${wp.no} commitments`, widths: [12, 8, 50, 30, 15, 15, 15, 15, 20], rows: [
      [{ v: `Commitments open when WP ${wp.no} was prepared (report ${wp.snap.asAt ? date(wp.snap.asAt) : ''}) and what became of them by ${R.to ? date(R.to) : ''}`, st: 'title' }], [],
      ['PO', 'Line', 'Description', 'Supplier', 'Committed then', 'Spent since', 'Still open', 'Released', 'Status'].map(H),
      ...R.rows.map((r) => [r.po, r.line, r.description, r.supplier, M(r.open), M(r.spentSince), M(r.stillOpen), M(r.released), KIND[r.kind][0]]),
      [{ v: 'Total', st: 'bold' }, '', '', '', M(R.open), M(R.spentSince), M(R.stillOpen), M(R.released), ''],
      [], [{ v: 'New POs since', st: 'bold' }],
      ...R.newPos.map((x) => [x.po, x.line, x.description, x.supplier, '', M(x.spent), M(x.open), '', 'New'])] }); }
  return out;
}
