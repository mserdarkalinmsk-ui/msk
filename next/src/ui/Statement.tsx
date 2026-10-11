import { useState } from 'preact/hooks';
import type { WbLine, WbTotals } from '../domain/workbook';
import { downloadCSV } from './DataTable';
import { pct } from './format';

const HEAD: Record<string, string> = { '1': 'Human resources', '2': 'Travel', '3': 'Equipment and supplies', '4': 'Local office', '5': 'Other costs, services', '6': 'Other' };
const v = (x: number | null | undefined) => x ?? 0;
const n0 = (x: number | null | undefined) => (x == null || x === 0 ? '' : Math.abs(x) < 100 && x % 1 ? x.toFixed(2) : Math.round(x).toLocaleString('en-GB'));
const money = (x: number | null | undefined) => (x == null || Math.abs(x) < 0.5 ? '–' : Math.round(x).toLocaleString('en-GB'));

interface Row { code: string; label: string; depth: number; leaf?: WbLine; sum: { b: number; a: number; sc: number; pl: number; pr: number } }

function build(lines: WbLine[]) {
  const leaf = lines.filter((l) => l.leaf);
  const all = new Map<string, Row>();
  const label = (code: string) => lines.find((l) => l.code === code)?.description ?? lines.find((l) => l.code === `${code}.0`)?.description.replace(/\s*\(not broken down\)$/, '') ?? (code.split('.').length === 1 ? HEAD[code] ?? '' : '');
  for (const l of leaf) {
    const parts = l.code.split('.');
    for (let i = 1; i <= parts.length; i++) {
      const code = parts.slice(0, i).join('.');
      const r = all.get(code) ?? { code, label: label(code), depth: i - 1, sum: { b: 0, a: 0, sc: 0, pl: 0, pr: 0 } };
      if (i === parts.length) r.leaf = l;
      r.sum.b += v(l.budget.cost); r.sum.a += v(l.actual.cost); r.sum.sc += v(l.sc ?? l.actual.cost); r.sum.pl += v(l.planned?.cost); r.sum.pr += v(l.rounded?.cost ?? l.proposal?.cost);
      all.set(code, r);
    }
  }
  const key = (c: string) => c.split('.').map((x) => x.padStart(3, '0')).join('.');
  return [...all.values()].sort((a, b) => key(a.code).localeCompare(key(b.code)));
}

/** Financial statement in the layout of the official report: hierarchy, two-level headers, subtotals and totals. */
export function Statement({ lines, totals, elapsed, title }: { lines: WbLine[]; totals: { direct?: WbTotals; admin?: WbTotals; eligible?: WbTotals }; elapsed: number; title: string }) {
  const [mode, setMode] = useState<'full' | 'compact'>('compact');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [hideEmpty, setHideEmpty] = useState(true);
  const rows = build(lines).filter((r) => !hideEmpty || r.sum.b || r.sum.a || r.sum.sc || r.sum.pl);
  const hasPlan = lines.some((l) => l.planned?.cost != null), hasProp = lines.some((l) => (l.rounded ?? l.proposal)?.cost != null);
  const visible = rows.filter((r) => ![...closed].some((c) => r.code !== c && r.code.startsWith(c + '.')));
  const full_ = mode === 'full';
  const toggle = (c: string) => setClosed((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const used = (r: Row) => (r.sum.b ? r.sum.sc / r.sum.b : 0);
  const exportCsv = () => downloadCSV(`${title}.csv`, [
    { key: 'c', label: 'Code', width: 0, value: (r: Row) => r.code }, { key: 'd', label: 'Description', width: 0, value: (r) => r.label },
    { key: 'u', label: 'Unit', width: 0, value: (r) => r.leaf?.unit ?? '' },
    { key: 'bu', label: 'Budget units', width: 0, value: (r) => r.leaf?.budget.units ?? '' }, { key: 'br', label: 'Budget rate', width: 0, value: (r) => r.leaf?.budget.rate ?? '' }, { key: 'b', label: 'Budget', width: 0, value: (r) => r.sum.b },
    { key: 'au', label: 'Actual units', width: 0, value: (r) => r.leaf?.actual.units ?? '' }, { key: 'ar', label: 'Actual rate', width: 0, value: (r) => r.leaf?.actual.rate ?? '' }, { key: 'a', label: 'Spent', width: 0, value: (r) => r.sum.a },
    { key: 'sc', label: 'Spent and committed', width: 0, value: (r) => r.sum.sc }, { key: 'pl', label: 'Planned 12 months', width: 0, value: (r) => r.sum.pl }, { key: 'pr', label: 'Budget proposal', width: 0, value: (r) => r.sum.pr },
  ], rows);
  const present = (['direct', 'admin', 'eligible'] as const).filter((k) => totals[k]);
  // Sticky offsets from the rows actually shown, so a report without admin/total rows leaves no gap.
  const T = (k: 'direct' | 'admin' | 'eligible', label: string, cls: string) => totals[k] && (
    <tr class={cls} style={{ ['--sb' as string]: `${(present.length - 1 - present.indexOf(k)) * 33}px` }}><td class="tl" colSpan={full_ ? 4 : 1}>{label}</td>
      <td class="r">{money(totals[k]!.budget)}</td>{full_ && <><td /><td /></>}<td class="r">{money(totals[k]!.actual)}</td><td class="r">{money(totals[k]!.sc)}</td>
      <td class="r">{pct(totals[k]!.budget ? totals[k]!.sc / totals[k]!.budget : 0)}</td>
      {hasPlan && <td class="r">{money(totals[k]!.planned)}</td>}{hasProp && <><td class="r">{money(totals[k]!.rounded ?? totals[k]!.proposal)}</td><td class="r">{money(v(totals[k]!.rounded ?? totals[k]!.proposal) - totals[k]!.budget)}</td></>}</tr>
  );
  return (
    <div class="stmt-wrap">
      <div class="dt-bar">
        <div class="seg"><button aria-pressed={mode === 'compact'} onClick={() => setMode('compact')}>Summary</button><button aria-pressed={mode === 'full'} onClick={() => setMode('full')}>Units & rates</button></div>
        <button class="btn ghost" onClick={() => setClosed(new Set(rows.filter((r) => r.depth === 0).map((r) => r.code)))}>Collapse all</button>
        <button class="btn ghost" onClick={() => setClosed(new Set())}>Expand all</button>
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px' }}><input type="checkbox" checked={hideEmpty} onChange={() => setHideEmpty(!hideEmpty)} />Hide empty lines</label>
        <span class="grow" />
        <button class="btn" onClick={() => print()}>Print</button><button class="btn" onClick={exportCsv}>Export CSV</button>
      </div>
      <div class="stmt-scroll">
        <table class="stmt">
          <thead>
            <tr class="g"><th rowSpan={2} class="pin">Line</th>{full_ && <th rowSpan={2}>Unit</th>}
              <th colSpan={full_ ? 3 : 1} class="gb">Budget for all years</th><th colSpan={full_ ? 3 : 1} class="ga">Actual expenditure</th><th rowSpan={2} class="r">Spent +<br />committed</th><th rowSpan={2}>Used</th>
              {hasPlan && <th rowSpan={2} class="r gp">Planned<br />12 months</th>}{hasProp && <th colSpan={2} class="gp">Budget proposal</th>}</tr>
            <tr class="s">{full_ && <><th class="r">Units</th><th class="r">Rate</th></>}<th class="r">€</th>{full_ && <><th class="r">Units</th><th class="r">Rate</th></>}<th class="r">€</th>{hasProp && <><th class="r">€</th><th class="r">vs budget</th></>}</tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const l = r.leaf, u = used(r), over = r.sum.b > 0 && r.sum.sc > r.sum.b;
              const rateUp = l?.budget.rate && l.actual.rate && l.actual.units ? l.actual.rate / l.budget.rate - 1 : 0;
              const d = r.sum.pr - r.sum.b, parent = !l;
              return (
                <tr class={`d${Math.min(r.depth, 3)} ${parent ? 'grp' : ''} ${over ? 'over' : ''}`}>
                  <td class="pin" style={{ paddingLeft: `${12 + r.depth * 14}px` }}>
                    {parent ? <button class="tw" aria-expanded={!closed.has(r.code)} onClick={() => toggle(r.code)}>{closed.has(r.code) ? '▸' : '▾'}</button> : <span class="tw" />}
                    <span class="num cd">{r.code}</span> {r.label}
                  </td>
                  {full_ && <td class="muted">{l?.unit}</td>}
                  {full_ && <><td class="r num">{n0(l?.budget.units)}</td><td class="r num">{n0(l?.budget.rate)}</td></>}
                  <td class="r num">{money(r.sum.b)}</td>
                  {full_ && <><td class="r num">{n0(l?.actual.units)}</td><td class={`r num ${rateUp > 0.15 ? 'warn' : ''}`} title={rateUp ? `${rateUp > 0 ? '+' : ''}${Math.round(rateUp * 100)}% vs budget rate` : ''}>{n0(l?.actual.rate)}</td></>}
                  <td class="r num">{money(r.sum.a)}</td>
                  <td class="r num">{money(r.sum.sc)}</td>
                  <td class="usedc"><div class="minibar"><span style={{ width: `${Math.min(100, u * 100)}%`, background: over ? 'var(--critical)' : 'var(--c1)' }} /><i style={{ left: `${elapsed * 100}%` }} /></div><span class="num">{r.sum.b ? pct(u) : ''}</span></td>
                  {hasPlan && <td class="r num">{money(r.sum.pl)}</td>}
                  {hasProp && <><td class="r num">{money(r.sum.pr)}</td><td class={`r num ${d > 0.5 ? 'up' : d < -0.5 ? 'down' : ''}`}>{Math.abs(d) < 0.5 ? '–' : `${d > 0 ? '+' : '−'}${Math.round(Math.abs(d)).toLocaleString('en-GB')}`}</td></>}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {T('direct', '7. Total direct eligible costs', 't1')}
            {T('admin', '10. Administrative costs (7%)', 't2')}
            {T('eligible', '11. Total eligible costs', 't3')}
          </tfoot>
        </table>
      </div>
      <div class="stmt-legend muted"><span><i class="lg over" />spent + committed above budget</span><span><i class="lg warn" />actual unit rate &gt; 15% above budget rate</span><span>│ tick = time elapsed</span></div>
    </div>
  );
}
