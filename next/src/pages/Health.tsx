import { emptyTrash, filtered, fixProject, go, restoreTrash, set, useStore } from '../data/store';
import { date } from '../ui/format';
import { applyFix, health, type AutoFix, type Finding, type Level } from '../domain/health';
const AUTO: Record<AutoFix, string> = { 'use-approved': 'Use the approved budget', 'dedupe-docs': 'Keep the latest copy', 'dedupe-reports': 'Keep the latest of each month' };
import { TODAY } from '../today';
import { useEffect, useState } from 'preact/hooks';
import type { Project } from '../domain/types';
import { full } from '../ui/format';

const C: Record<Level, string> = { ok: 'var(--good)', warn: 'var(--c4)', bad: 'var(--critical)' };
const W: Record<Level, string> = { ok: 'Healthy', warn: 'Check', bad: 'Fix' };
const ICON: Record<Level, string> = { ok: '✓', warn: '!', bad: '✕' };

export function HealthPage() {
  const s = useStore((x) => x);
  const H = filtered(s).map((p) => health(p, TODAY)).sort((a, b) => ['bad', 'warn', 'ok'].indexOf(a.level) - ['bad', 'warn', 'ok'].indexOf(b.level));
  const n = (l: Level) => H.filter((h) => h.level === l).length;
  const [open, setOpen] = useState<{ p: Project; f: Finding } | null>(null);
  const tabOf = (f: Finding) => f.tab ?? (f.fix === 'reports' ? 'Financial report' : undefined);
  const goTab = (id: string, tab: string) => { setOpen(null); go(`project/${id}`); setTimeout(() => dispatchEvent(new CustomEvent('pl-tab', { detail: tab })), 60); };
  const act = (id: string, f: Finding) => {
    if (f.fix && f.fix in AUTO) fixProject(id, f.fix as AutoFix, applyFix);
    else if (f.fix === 'report') set({ drawer: { kind: 'report', projectId: id } });
    else if (f.fix === 'documents') set({ drawer: { kind: 'documents', projectId: id } });
    else if (f.fix === 'edit') set({ drawer: { kind: 'project', id } });
    else goTab(id, tabOf(f) ?? 'Reports');
  };
  const label = (f: Finding) => (f.fix && f.fix in AUTO ? AUTO[f.fix as AutoFix] : f.fix === 'report' ? 'Import report' : f.fix === 'documents' ? 'Add documents' : f.fix === 'edit' ? 'Edit details' : `Open ${TAB[tabOf(f) ?? 'Reports'] ?? tabOf(f)}`);
  return (
    <>
      <section class="hero" aria-label="Data health">
        <div class="kpi lead"><span class="label">Data health</span><span class="value" style={{ color: n('bad') ? C.bad : n('warn') ? C.warn : C.ok }}>{n('bad') ? `${n('bad')} to fix` : n('warn') ? `${n('warn')} to check` : 'All good'}</span><span class="ctx">consistency of reports, totals and budgets per project</span></div>
        <div class="kpi"><span class="label">Fix</span><span class="value" style={{ color: C.bad }}>{n('bad')}</span><span class="ctx">wrong or missing totals</span></div>
        <div class="kpi"><span class="label">Check</span><span class="value" style={{ color: C.warn }}>{n('warn')}</span><span class="ctx">differences to look at</span></div>
        <div class="kpi"><span class="label">Healthy</span><span class="value" style={{ color: C.ok }}>{n('ok')}</span><span class="ctx">all checks pass</span></div>
      </section>
      <div class="hl-grid">{H.map((h) => (
        <section class="card hl" style={{ borderTopColor: C[h.level] }}>
          <div class="hl-h"><button class="linkish" onClick={() => go(`project/${h.p.id}`)}><b>{h.p.bh ? `BH ${h.p.bh}` : h.p.code}</b> <span class="muted">{h.p.name}</span></button><span class="hl-pill" style={{ background: C[h.level] }}>{W[h.level]}</span></div>
          <ul class="hl-l">{h.findings.map((f) => <li class={`hl-${f.level}`}><i style={{ background: C[f.level] }}>{ICON[f.level]}</i><span>{f.text}</span>{f.level !== 'ok' && f.detail?.rows.length ? <button class="btn ghost hl-show" onClick={() => setOpen({ p: h.p, f })}>Show {f.detail.rows.length} →</button>
            : f.level !== 'ok' && f.fix && <button class="btn ghost" onClick={() => act(h.p.id, f)}>{label(f)} →</button>}</li>)}</ul>
        </section>))}</div>
      {open && <FindingDialog p={open.p} f={open.f} tab={tabOf(open.f)} close={() => setOpen(null)} goTab={goTab} />}
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h"><div><h2>Deleted items</h2><p>Projects, countries, reports, documents, risks and office reports that were deleted — put any of them back</p></div>
          {!!s.ledger.trash?.length && <div class="tools"><button class="btn ghost danger" onClick={() => confirm('Empty the trash for good?') && emptyTrash()}>Empty trash</button></div>}</div>
        <ul class="att" style={{ marginTop: '8px' }}>{(s.ledger.trash ?? []).map((t) => <li style={{ cursor: 'default' }}><span class="badge neutral">{t.kind}</span><div><div class="t">{t.label}</div><div class="d">deleted {date(t.at.slice(0, 10))} {t.at.slice(11, 16)}{t.projects?.length ? ` · with ${t.projects.length} project${t.projects.length > 1 ? 's' : ''}` : ''}</div></div><button class="btn ghost" onClick={() => restoreTrash(t.id)}>Restore</button></li>)}
          {!s.ledger.trash?.length && <li style={{ cursor: 'default' }}><span /><div class="d">Nothing deleted</div><span /></li>}</ul>
      </section>
      <p class="muted" style={{ fontSize: '12px', marginTop: '12px' }}>Checks: system extractions reconcile entry by entry, template rows recognised (direct · admin · total), lines add up to the totals, direct + admin = total, admin ≤ 7%, report and approved budget equal the project budget, admin not counted twice, heading flexibility, duplicate reports in one month, documents uploaded twice, report age, dates.</p>
    </>
  );
}

const TAB: Record<string, string> = { Summary: 'project summary', 'Financial report': 'financial report', 'Budget lines': 'budget lines', Reports: 'reports', Staff: 'staff' };

/** The records behind a finding, with the project tab where they are. */
function FindingDialog({ p, f, tab, close, goTab }: { p: Project; f: Finding; tab?: string; close: () => void; goTab: (id: string, tab: string) => void }) {
  const d = f.detail!;
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && close(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  const cell = (v: string | number, i: number) => (d.num?.includes(i) && typeof v === 'number' ? full(v) : String(v));
  return (
    <>
      <div class="scrim" onClick={close} />
      <div class="fc-dlg card hl-dlg" role="dialog" aria-label={d.title}>
        <div class="card-h"><div><div class="num muted" style={{ fontSize: '12px' }}>{p.bh ? `BH ${p.bh}` : p.code} · {p.name}</div><h2>{d.title}</h2><p>{f.text.replace(/^[^:]+:\s*/, '')}</p></div>
          <button class="btn ghost" aria-label="Close" style={{ marginLeft: 'auto' }} onClick={close}>✕</button></div>
        <div class="card-b" style={{ overflow: 'auto', maxHeight: '60vh', paddingTop: 0 }}>
          <table class="mini">
            <thead><tr>{d.cols.map((c, i) => <th class={d.num?.includes(i) ? 'r' : ''}>{c}</th>)}</tr></thead>
            <tbody>{d.rows.map((r, k) => <tr class={k > 0 && r[0] === d.rows[k - 1][0] ? 'hl-same' : ''}>{r.map((v, i) => <td class={d.num?.includes(i) ? 'r num' : i === 0 ? 'num' : ''}>{cell(v, i)}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div class="card-b" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--line)' }}>
          <button class="btn" onClick={close}>Close</button>
          {tab && <button class="btn primary" onClick={() => goTab(p.id, tab)}>Open {TAB[tab] ?? tab} →</button>}
        </div>
      </div>
    </>
  );
}
