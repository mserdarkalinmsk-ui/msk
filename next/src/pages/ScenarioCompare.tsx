import { useState } from 'preact/hooks';
import { money } from '../domain/calc';
import { PRESETS, runScenario, type ScenarioIn } from '../domain/scenarios';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full } from '../ui/format';

const KEY = (id: string) => `pl-scn-${id}`;
const load = (id: string): ScenarioIn[] => { try { const v = JSON.parse(localStorage.getItem(KEY(id)) ?? ''); return Array.isArray(v) && v.length ? v : PRESETS; } catch { return PRESETS; } };
const save = (id: string, v: ScenarioIn[]) => { try { localStorage.setItem(KEY(id), JSON.stringify(v)); } catch { /* storage blocked */ } };
const TONE = { fits: 'var(--good)', underspend: 'var(--c4)', overrun: 'var(--critical)' } as const;
const WORD = { fits: 'uses the budget', underspend: 'money left unused', overrun: 'budget exceeded' } as const;

/** Side-by-side what-ifs for one project: extension, budget change, spending pace and staff cuts. */
export function ScenarioCompare({ p }: { p: Project }) {
  const [S, setS] = useState<ScenarioIn[]>(() => load(p.id));
  const upd = (v: ScenarioIn[]) => { setS(v); save(p.id, v); };
  const R = S.map((s) => runScenario(p, s, TODAY)), m = money(p);
  const field = (i: number, k: keyof ScenarioIn, min: number, max: number, step: number, unit: string) => (
    <label class="sc-f"><span>{({ extend: 'Extension', budgetPct: 'Budget change', pacePct: 'Spending pace', staffPct: 'Staff cost cut' } as Record<string, string>)[k]}</span>
      <input type="range" min={min} max={max} step={step} value={S[i][k] as number} onInput={(e) => upd(S.map((x, j) => (j === i ? { ...x, [k]: Number((e.target as HTMLInputElement).value) } : x)))} />
      <b class="num">{(S[i][k] as number) > 0 && k !== 'extend' && k !== 'staffPct' ? '+' : ''}{S[i][k]}{unit}</b></label>);
  const maxV = Math.max(...R.map((r) => Math.max(r.budget, r.projected)), 1);
  return (
    <section class="card">
      <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Compare scenarios</h2><p>Each column is projected to its end date from today's spent + committed ({full(m.exposure)}) and the forecast monthly rate · nothing changes the project data</p></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>{S.length < 4 && <button class="btn" onClick={() => upd([...S, { name: `Scenario ${S.length + 1}`, extend: 0, budgetPct: 0, pacePct: 0, staffPct: 0 }])}>+ Scenario</button>}<button class="btn ghost" onClick={() => upd(PRESETS)}>Reset</button></div></div>
      <div class="card-b sc-grid" style={{ gridTemplateColumns: `repeat(${S.length}, minmax(220px, 1fr))` }}>
        {R.map((r, i) => <div class="sc-col" style={{ borderTopColor: TONE[r.verdict] }}>
          <div class="sc-h"><input class="sc-name" value={S[i].name} aria-label="Scenario name" onChange={(e) => upd(S.map((x, j) => (j === i ? { ...x, name: (e.target as HTMLInputElement).value } : x)))} />{S.length > 1 && <button class="btn ghost" aria-label="Remove scenario" onClick={() => upd(S.filter((_, j) => j !== i))}>✕</button>}</div>
          {field(i, 'extend', 0, 24, 1, ' mo')}{field(i, 'budgetPct', -30, 30, 1, '%')}{field(i, 'pacePct', -50, 50, 5, '%')}{field(i, 'staffPct', 0, 50, 5, '%')}
          <dl class="sc-r">
            <dt>End date</dt><dd class="num">{date(r.end)}</dd>
            <dt>Budget</dt><dd class="num">{full(r.budget)}</dd>
            <dt>Monthly rate</dt><dd class="num">{full(r.rate)}</dd>
            <dt>Projected at end</dt><dd class="num"><b>{full(r.projected)}</b></dd>
            <dt>{r.balance >= 0 ? 'Unused' : 'Overrun'}</dt><dd class="num" style={{ color: TONE[r.verdict] }}><b>{full(Math.abs(r.balance))}</b></dd>
            <dt>Needed a month to use it all</dt><dd class="num">{full(r.need)}</dd>
          </dl>
          <div class="sc-bar" title="projected vs budget"><i style={{ width: `${Math.min(r.projected, r.budget) / maxV * 100}%`, background: 'var(--c1)' }} />{r.projected > r.budget && <i style={{ width: `${(r.projected - r.budget) / maxV * 100}%`, background: 'var(--critical)' }} />}<em style={{ left: `${r.budget / maxV * 100}%` }} /></div>
          <div class="sc-v" style={{ color: TONE[r.verdict] }}>● {Math.round(r.use * 100)}% — {WORD[r.verdict]}</div>
          {r.notes.length > 0 && <ul class="sc-n">{r.notes.map((n) => <li>{n}</li>)}</ul>}
        </div>)}
      </div>
      <p class="muted" style={{ fontSize: '12px', margin: '0 20px 16px' }}>An extension at unchanged pace spreads the remaining work over more months. Staff cut reduces the human-resources share of the monthly rate. Bar: blue = projected spend, line = budget, red = overrun.</p>
    </section>
  );
}
