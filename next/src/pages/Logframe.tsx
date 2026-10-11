import { set, updateProject } from '../data/store';
import type { Indicator } from '../domain/documents';
import { num, progress, tidy } from '../domain/logframe';
export { num, progress, tidy };
import type { Project } from '../domain/types';
import { full } from '../ui/format';

const code = (s: string) => s.match(/^\s*(\d+(?:\.\d+)+)/)?.[1] ?? '';
const out = (c: string) => c.split('.').slice(0, 2).join('.');

export function Indicators({ p }: { p: Project }) {
  const I = p.indicators ?? [];
  if (!I.length) return <div class="card empty-page"><div><h2>No indicators yet</h2><p>Add the Description of Action or the logframe; indicators, baselines, targets and assumptions are read from it.</p><button class="btn primary" onClick={() => set({ drawer: { kind: 'documents', projectId: p.id } })}>Add documents</button></div></div>;
  const groups = new Map<string, Indicator[]>();
  for (const x of I) { const c = code(x.indicator); const k = x.result || (c ? `Output ${out(c)}` : x.level || 'Indicators'); groups.set(k, [...(groups.get(k) ?? []), x]); }
  const withTarget = I.filter((x) => tidy(x.target)).length;
  const P = I.map(progress).filter((v): v is number => v != null);
  const setCurrent = (x: Indicator, v: string) => updateProject(p.id, { indicators: I.map((y) => (y === x ? { ...y, current: v.trim(), asOf: new Date().toISOString().slice(0, 10) } : y)) });
  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <section class="hero" aria-label="Indicator summary">
        <div class="kpi lead"><span class="label">Indicators</span><span class="value">{I.length}</span><span class="ctx">in {groups.size} result{groups.size > 1 ? 's' : ''}</span></div>
        <div class="kpi"><span class="label">With a target</span><span class="value">{withTarget}</span><span class="ctx">{I.length - withTarget ? `${I.length - withTarget} to complete` : 'all set'}</span></div>
        <div class="kpi"><span class="label">Average progress</span><span class="value">{P.length ? `${Math.round(P.reduce((a, b) => a + Math.min(1, b), 0) / P.length * 100)}%` : '—'}</span><span class="ctx">{P.length ? `${P.length} indicators measured · ${P.filter((v) => v >= 1).length} reached` : 'type the current value per indicator'}</span></div>
        <div class="kpi"><span class="label">Source</span><span class="value" style={{ fontSize: '18px' }}>{p.documents?.at(-1)?.name.slice(0, 28) ?? '—'}</span><span class="ctx">latest document</span></div>
      </section>
      {[...groups].map(([g, xs]) => {
        const assumptions = [...new Set(xs.map((x) => tidy(x.assumptions)).filter(Boolean))];
        return (
          <section class="card lf">
            <div class="lf-h"><div>{xs[0].level && <span class="badge neutral">{xs[0].level}</span>}<h3>{tidy(g) || g}</h3></div><span class="muted num">{xs.length} indicator{xs.length > 1 ? 's' : ''}</span></div>
            <div class="lf-rows">
              {xs.map((x) => (
                <div class="lf-row">
                  <span class={code(x.indicator) ? "lf-code num" : ""}>{code(x.indicator)}</span>
                  <div class="lf-ind"><b>{x.indicator.replace(/^\s*\d+(?:\.\d+)+\s*/, '')}</b>{tidy(x.source) && <small>Source: {tidy(x.source)}</small>}</div>
                  <div class="lf-bt"><span><i>Baseline</i><b class="num">{tidy(x.baseline) || '—'}</b></span><span class="lf-arrow">→</span><span><i>Target</i><b class="num">{tidy(x.target) || '—'}</b></span></div>
                  <div class="lf-now">
                    <label><i>Now{x.asOf ? ` · ${x.asOf}` : ''}</i><input class="input num" value={x.current ?? ''} placeholder="—" aria-label={`Current value for ${x.indicator}`} onChange={(e) => setCurrent(x, (e.target as HTMLInputElement).value)} /></label>
                    {progress(x) != null && <div class="lf-prog"><span style={{ width: `${Math.min(100, Math.max(0, progress(x)! * 100))}%`, background: progress(x)! >= 1 ? 'var(--good)' : 'var(--c1)' }} /><b class="num">{Math.round(progress(x)! * 100)}%</b></div>}
                  </div>
                </div>
              ))}
            </div>
            {assumptions.length > 0 && <div class="lf-ass"><i>Assumptions</i>{assumptions.map((a) => <p>{a}</p>)}</div>}
          </section>
        );
      })}
    </div>
  );
}

export function Justification({ p }: { p: Project }) {
  const N = p.budgetNotes ?? {};
  const lines = p.approvedBudget?.lines ?? [];
  const codes = [...new Set([...lines.map((l) => l.code), ...Object.keys(N)])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const has = Object.keys(N).length;
  return (
    <section class="card">
      <div class="card-h"><div><h2>Budget justification</h2><p>{has ? `Clarification and justification for ${has} of ${codes.length} lines` : 'Add the budget annex with “Clarification of the budget items / Justification of the estimated costs” to fill this'}</p></div>
        <button class="btn primary" style={{ marginLeft: 'auto' }} onClick={() => set({ drawer: { kind: 'documents', projectId: p.id } })}>Add documents</button></div>
      <div class="jt">
        {codes.map((c) => {
          const l = lines.find((x) => x.code === c), n = N[c];
          return (
            <div class={`jt-row ${n ? '' : 'empty'}`}>
              <div class="jt-l"><span class="num">{c}</span><b>{l?.description ?? n?.description}</b>
                {l && <small class="num">{l.approvedUnits ? `${l.approvedUnits} × ${full(l.unitRate ?? 0)} ${l.unit ? l.unit.toLowerCase() : ''} = ` : ''}{full(l.approved ?? 0)}</small>}</div>
              <div class="jt-t">{n?.clarification && <p><i>Clarification</i>{n.clarification}</p>}{n?.justification && <p><i>Justification</i>{n.justification}</p>}{!n && <p class="muted">No justification on file</p>}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
