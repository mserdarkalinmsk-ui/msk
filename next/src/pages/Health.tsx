import { filtered, go, set, useStore } from '../data/store';
import { health, type Finding, type Level } from '../domain/health';
import { TODAY } from '../today';

const C: Record<Level, string> = { ok: '#30a46c', warn: '#f5a524', bad: '#e5484d' };
const W: Record<Level, string> = { ok: 'Healthy', warn: 'Check', bad: 'Fix' };
const ICON: Record<Level, string> = { ok: '✓', warn: '!', bad: '✕' };

export function HealthPage() {
  const s = useStore((x) => x);
  const H = filtered(s).map((p) => health(p, TODAY)).sort((a, b) => ['bad', 'warn', 'ok'].indexOf(a.level) - ['bad', 'warn', 'ok'].indexOf(b.level));
  const n = (l: Level) => H.filter((h) => h.level === l).length;
  const act = (id: string, f: Finding) => {
    if (f.fix === 'report') set({ drawer: { kind: 'report', projectId: id } });
    else if (f.fix === 'documents') set({ drawer: { kind: 'documents', projectId: id } });
    else if (f.fix === 'edit') set({ drawer: { kind: 'project', id } });
    else { go(`project/${id}`); setTimeout(() => dispatchEvent(new CustomEvent('pl-tab', { detail: 'Reports' })), 60); }
  };
  const label = (f: Finding) => (f.fix === 'report' ? 'Import report' : f.fix === 'documents' ? 'Add documents' : f.fix === 'edit' ? 'Edit details' : 'Open reports');
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
          <ul class="hl-l">{h.findings.map((f) => <li class={`hl-${f.level}`}><i style={{ background: C[f.level] }}>{ICON[f.level]}</i><span>{f.text}</span>{f.level !== 'ok' && f.fix && <button class="btn ghost" onClick={() => act(h.p.id, f)}>{label(f)} →</button>}</li>)}</ul>
        </section>))}</div>
      <p class="muted" style={{ fontSize: '12px', marginTop: '12px' }}>Checks: template rows recognised (direct · admin · total), lines add up to the totals, direct + admin = total, admin ≤ 7%, report and approved budget equal the project budget, admin not counted twice, heading flexibility, duplicate reports in one month, report age, dates.</p>
    </>
  );
}
