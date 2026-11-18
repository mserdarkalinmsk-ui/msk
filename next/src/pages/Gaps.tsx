import { plabel } from '../domain/label';
import { filtered, go, useStore } from '../data/store';
import { latestReport } from '../domain/calc';
import { programmeOf } from '../domain/flex';
import { readiness } from '../domain/insights';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date } from '../ui/format';
import { download } from '../ui/xlsxwrite';

/** What a project file needs, where to get it, and the screen it is added on. */
interface Need { key: string; label: string; hint: string; slug: string; ok: (p: Project) => boolean | 'n/a' }
const age = (p: Project) => { const r = latestReport(p); return r ? (TODAY.getTime() - Date.parse(r.date)) / 86_400_000 : Infinity; };
const R = (p: Project, k: string) => readiness(p).items.find((i) => i.key === k)?.done ?? false;
export const NEEDS: Need[] = [
  { key: 'bh', label: 'Budget head', hint: 'BH number (Edit details)', slug: 'summary', ok: (p) => !!p.bh },
  { key: 'ids', label: 'Contract / JP', hint: 'contract or JP number', slug: 'summary', ok: (p) => !!(p.contractNo || p.jp) || (programmeOf(p) === 'VC' ? 'n/a' : false) },
  { key: 'dates', label: 'Dates', hint: 'implementation period from the DoA or contract', slug: 'summary', ok: (p) => R(p, 'dates') },
  { key: 'budget', label: 'Approved budget', hint: 'budget annex (Add documents)', slug: 'budget', ok: (p) => !!p.approvedBudget },
  { key: 'contract', label: 'Contract terms', hint: 'reporting, flexibility, pre-financing (contract PDF)', slug: 'docs', ok: (p) => R(p, 'contract') },
  { key: 'report', label: 'Report', hint: 'latest financial report or system extraction', slug: 'finance', ok: (p) => R(p, 'report') },
  { key: 'fresh', label: 'Report < 45 days', hint: 'a newer extraction', slug: 'finance', ok: (p) => (R(p, 'report') ? age(p) <= 45 : 'n/a') },
  { key: 'wp', label: 'Work Plan', hint: 'quarterly Work Plan (WorkPlan file or follow-up table)', slug: 'wp', ok: (p) => !!p.workPlans?.length },
  { key: 'wpnow', label: 'Current WP', hint: 'a Work Plan covering today', slug: 'wp', ok: (p) => (p.workPlans?.length ? p.workPlans.some((w) => w.from <= TODAY.toISOString().slice(0, 10) && w.to >= TODAY.toISOString().slice(0, 10)) : 'n/a') },
  { key: 'plan', label: 'Activity plan', hint: 'action plan from the DoA', slug: 'docs', ok: (p) => R(p, 'plan') },
  { key: 'logframe', label: 'Logframe', hint: 'indicators from the DoA', slug: 'docs', ok: (p) => R(p, 'logframe') },
  { key: 'risks', label: 'Risks', hint: 'risk register', slug: 'risks', ok: (p) => R(p, 'risks') },
];

/** Every project against what its file should hold — the gaps first, each opening the screen where it is added. */
export function Gaps() {
  const P = useStore((s) => filtered(s)).filter((p) => !/closed/i.test(p.status ?? ''));
  const rows = P.map((p) => ({ p, v: NEEDS.map((n) => n.ok(p)) })).map((r) => ({ ...r, miss: r.v.filter((x) => x === false).length })).sort((a, b) => b.miss - a.miss);
  const total = rows.reduce((a, r) => a + r.miss, 0), complete = rows.filter((r) => !r.miss).length;
  const byNeed = NEEDS.map((n, i) => ({ n, c: rows.filter((r) => r.v[i] === false).length })).filter((x) => x.c).sort((a, b) => b.c - a.c);
  const xlsx = () => download(`missing-data-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Missing data', widths: [12, 50, 10, ...NEEDS.map(() => 14)], rows: [
    ['BH', 'Project', 'Missing', ...NEEDS.map((n) => n.label)].map((v) => ({ v, st: 'head' as const })),
    ...rows.map((r) => [plabel(r.p), r.p.name, r.miss, ...r.v.map((x) => (x === 'n/a' ? '—' : x ? 'yes' : 'MISSING'))])] }]);
  return (
    <>
      <section class="hero" aria-label="Missing data">
        <div class="kpi lead"><span class="label">Missing items</span><span class="value" style={{ color: total ? 'var(--serious)' : 'var(--good)' }}>{total}</span><span class="ctx">across {rows.length} active project{rows.length === 1 ? '' : 's'}</span></div>
        <div class="kpi"><span class="label">Complete files</span><span class="value">{complete}</span><span class="ctx">nothing missing</span></div>
        <div class="kpi"><span class="label">Most often missing</span><span class="value" style={{ fontSize: '24px' }}>{byNeed[0]?.n.label ?? '—'}</span><span class="ctx">{byNeed[0] ? `${byNeed[0].c} project${byNeed[0].c > 1 ? 's' : ''} · ${byNeed[0].n.hint}` : 'every file complete'}</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h"><div><h2>What each project file is missing</h2><p>✕ missing · ✓ on file · — does not apply · click a cell to open the screen where it is added</p></div><button class="btn" onClick={xlsx}>⤓ Excel</button></div>
        <div class="table-scroll"><table class="gap-t">
          <thead><tr><th>Project</th><th class="r">Missing</th>{NEEDS.map((n) => <th title={n.hint}>{n.label}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr>
            <td><b>{plabel(r.p)} · </b><span class="gap-n">{r.p.name}</span><small>{programmeOf(r.p) === 'VC' ? 'Voluntary Contribution' : 'Joint Programme'}{latestReport(r.p) ? ` · report ${date(latestReport(r.p)!.date)}` : ''}</small></td>
            <td class="r num"><b style={{ color: r.miss ? 'var(--serious)' : 'var(--good)' }}>{r.miss}</b></td>
            {r.v.map((x, i) => <td class={`gap-c ${x === 'n/a' ? 'na' : x ? 'yes' : 'no'}`}><button title={`${NEEDS[i].label}: ${x === 'n/a' ? 'does not apply' : x ? 'on file' : `missing — ${NEEDS[i].hint}`}`} onClick={() => go(`project/${r.p.id}/${NEEDS[i].slug}`)}>{x === 'n/a' ? '—' : x ? '✓' : '✕'}</button></td>)}
          </tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}
