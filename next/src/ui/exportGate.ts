import { latestReport } from '../domain/calc';
import { health } from '../domain/health';
import { selfCheck } from '../domain/selfcheck';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { setStamp } from './stamp';

/**
 * Before a file for the donor or the auditors leaves the app: problems found by Data health (red) and figures the app
 * reads differently on two screens are listed, and the user decides. The file then carries, in its properties
 * (File › Info), which report its figures come from and when it was produced.
 */

export function exportOk(p: Project, what = 'this file'): boolean {
  const bad = health(p, TODAY).findings.filter((f) => f.level === 'bad'), self = selfCheck([p]);
  const items = [...self.map((x) => `${x.figure}: ${x.a.label} ${x.a.v.toFixed(2)} vs ${x.b.label} ${x.b.v.toFixed(2)}`), ...bad.map((f) => f.text)];
  if (items.length && !confirm(`${p.code}: ${items.length} problem${items.length > 1 ? 's' : ''} to fix before ${what} is used:\n\n• ${items.slice(0, 6).join('\n• ')}${items.length > 6 ? `\n• …and ${items.length - 6} more (Data health)` : ''}\n\nDownload anyway?`)) return false;
  const r = latestReport(p);
  setStamp(`${p.code} · figures from ${r ? `${r.name} (${r.date})${r.fileName ? `, ${r.fileName}` : ''}` : 'no report'} · produced ${TODAY.toISOString().slice(0, 10)}${items.length ? ` · ${items.length} open problem${items.length > 1 ? 's' : ''} at the time` : ''}`);
  return true;
}
