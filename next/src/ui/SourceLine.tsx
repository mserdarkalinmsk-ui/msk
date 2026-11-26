import { latestReport } from '../domain/calc';
import { daysTo } from '../domain/contracts';
import { plabel } from '../domain/label';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { go } from '../data/store';
import { date } from './format';

/** Where the figures on the screen come from: the latest report of each project, its date, and the ones that are old. */
export function SourceLine({ P }: { P: Project[] }) {
  if (!P.length) return null;
  const R = P.map((p) => ({ p, r: latestReport(p) }));
  const dated = R.filter((x) => x.r?.date).sort((a, b) => a.r!.date.localeCompare(b.r!.date)), none = R.filter((x) => !x.r);
  const old = dated.filter((x) => daysTo(x.r!.date, TODAY) < -75);
  if (P.length === 1) { const r = R[0].r;
    return <p class="src-l">{r ? <>Figures from <b>{r.name || 'the latest report'}</b>{r.date ? <>, situation at {date(r.date)}</> : null}{r.fileName ? <span class="muted"> · {r.fileName}</span> : null}{old.length ? <span class="badge warning">over 2 months old</span> : null}</> : 'No report imported yet: figures are those of the approved budget only.'}</p>; }
  const lo = dated[0]?.r!.date, hi = dated.at(-1)?.r!.date;
  return <p class="src-l">Figures from the latest report of each project{lo ? <>, situations at {lo === hi ? date(lo) : <>{date(lo)} to {date(hi!)}</>}</> : null}
    {old.length > 0 && <> · <span class="badge warning" title={old.map((x) => `${plabel(x.p)}: ${date(x.r!.date)}`).join('\n')}>{old.length} over 2 months old</span> {old.slice(0, 3).map((x) => <button class="linkish" onClick={() => go(`project/${x.p.id}/reports`)}>{plabel(x.p)}</button>)}</>}
    {none.length > 0 && <> · <span class="muted">{none.length} without a report ({none.slice(0, 3).map((x) => plabel(x.p)).join(', ')}{none.length > 3 ? '…' : ''})</span></>}</p>;
}
