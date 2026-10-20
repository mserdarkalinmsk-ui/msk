import { useState } from 'preact/hooks';
import { updateProject } from '../data/store';
import { againstOriginal, versionSteps } from '../domain/budgetVersions';
import { letterLabel } from '../domain/letters';
import type { Project } from '../domain/types';
import { full } from './format';

const pc = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(2)}%`;

/**
 * The budget's history: original, each notification and addendum, the one in force. Headings per version against the
 * original (the agreement) with the flexibility, the lines that moved at each step, and the letter on file for each.
 */
export function BudgetVersions({ p }: { p: Project }) {
  const V = p.budgetVersions ?? [], [step, setStep] = useState(V.length - 2);
  if (V.length < 2) return null;
  const S = versionSteps(V), O = againstOriginal(V);
  const flex = (Number((p.contract as { flexPct?: number } | undefined)?.flexPct) || 25) / 100;
  const head = (i: number, h: string) => V[i].budget.lines.filter((l) => l.code.split('.')[0] === h && l.code.includes('.')).reduce((a, l) => a + (l.approved ?? 0), 0);
  const letter = (v: (typeof V)[number]) => (p.budgetLetters ?? []).find((l) => l.kind === v.kind && (v.no == null || l.no == null || l.no === v.no));
  const setDate = (file: string, date: string) => updateProject(p.id, { budgetLetters: (p.budgetLetters ?? []).map((l) => (l.file === file ? { ...l, date: date || undefined } : l)) });
  const s = S[Math.max(0, Math.min(step, S.length - 1))];
  return (
    <section class="card span-12 bv">
      <div class="card-h"><div><h2>Budget versions</h2><p>{V.length} versions · in force: <b>{V.at(-1)!.label}</b> · headings against the original agreement, ±{Math.round(flex * 100)}% flexibility</p></div></div>
      <div class="card-b" style={{ display: 'grid', gap: '14px' }}>
        <ol class="bv-tl">{V.map((v, i) => { const L = v.kind === 'original' ? undefined : letter(v); return (
          <li class={i === V.length - 1 ? 'now' : ''}>
            <b>{v.label}</b><span class="num">{full(v.budget.total)}</span>
            {L ? <span class="muted">{letterLabel(L)} · {L.scanned ? <input type="date" aria-label={`Date of ${letterLabel(L)}`} value={L.date ?? ''} onChange={(e) => setDate(L.file, (e.target as HTMLInputElement).value)} /> : L.date ?? 'no date'}{L.outcome ? ` · ${L.outcome}` : ''}</span>
              : v.kind !== 'original' && <span class="muted">no letter on file</span>}
          </li>); })}</ol>
        <div style={{ overflowX: 'auto' }}>
          <table class="mini">
            <thead><tr><th>Heading</th>{V.map((v) => <th class="r">{v.label}</th>)}<th class="r">In force vs original</th><th /></tr></thead>
            <tbody>{O.map((h) => { const over = Math.abs(h.pct) > flex + 1e-9 && h.from > 0; return (
              <tr class={over ? 'bv-over' : ''}><td>{h.code}. {h.label}</td>{V.map((_, i) => <td class="r num">{full(head(i, h.code))}</td>)}
                <td class="r num">{h.from ? pc(h.pct) : 'new'}</td><td>{over ? <span class="badge critical">beyond {Math.round(flex * 100)}% — addendum</span> : <span class="badge good">within</span>}</td></tr>); })}
              <tr><td><b>Total eligible costs</b></td>{V.map((v) => <td class="r num"><b>{full(v.budget.total)}</b></td>)}<td /><td /></tr></tbody>
          </table>
        </div>
        <div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: '13px' }}>Lines that moved</b>
            <div class="seg">{S.map((x, i) => <button aria-pressed={x === s} onClick={() => setStep(i)}>{x.from} → {x.to}</button>)}</div></div>
          <table class="mini" style={{ marginTop: '8px' }}>
            <thead><tr><th>Line</th><th>Description</th><th class="r">{s.from}</th><th class="r">{s.to}</th><th class="r">Change</th></tr></thead>
            <tbody>{s.lines.map((l) => <tr><td class="num">{l.code}</td><td>{l.description}</td><td class="r num">{full(l.from)}</td><td class="r num">{full(l.to)}</td>
              <td class="r num" style={{ color: l.to < l.from ? 'var(--critical)' : 'var(--good)' }}>{l.to >= l.from ? '+' : '−'}{full(Math.abs(l.to - l.from))}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
