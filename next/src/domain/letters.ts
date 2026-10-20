import type { Doc } from './documents';

/**
 * A notification or addendum letter (or the signed annex it encloses): which change, its number, date, reference and
 * what the Contracting Authority did with it. Read from the text when there is one; a scanned letter gives only its
 * file name, and the date is then for the user to fill in.
 */
export interface Letter { kind: 'notification' | 'addendum'; no?: number; date?: string; ref?: string; outcome?: 'recorded' | 'approved' | 'rejected'; file: string; scanned: boolean }

const iso = (d: string, m: string, y: string) => `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

export function letterFacts(doc: Doc): Letter | null {
  if (doc.kind === 'xlsx') return null;
  const name = doc.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '), text = doc.paragraphs.slice(0, 80).join('\n');
  const both = `${name}\n${text}`;
  const kind = /addendum|amendment|rider/i.test(both.slice(0, 2000)) ? 'addendum' : /notification/i.test(both.slice(0, 2000)) ? 'notification' : null;
  if (!kind) return null;
  // Only a file that is a letter or a signed annex — not a report that mentions a notification.
  if (!/notification|addendum|amendment|rider/i.test(name) && !/dear\s|yours (sincerely|faithfully)|subject\s*:/i.test(text)) return null;
  const no = both.match(new RegExp(`${kind === 'addendum' ? '(?:addendum|amendment|rider)' : 'notifications?'}\\s*(?:no\\.?|n°|nr\\.?|number)?\\s*[:.]?\\s*(\\d{1,2})(?![\\d.])`, 'i'));
  const dm = text.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
  const ref = text.match(/\b([A-Z]{2}\d{4}\/[A-Z]{2,4}\/\d{2}\/[A-Z0-9.\-]+\/\d{3})\b/)?.[1];
  const outcome = /\bnot (be )?(recorded|accepted|approved)|reject/i.test(text) ? 'rejected' : /\brecorded\b/i.test(text) ? 'recorded' : /\bapproved?\b|\bsigned\b/i.test(text) ? 'approved' : undefined;
  return { kind, no: no ? +no[1] : undefined, date: dm ? iso(dm[1], dm[2], dm[3]) : undefined, ref, outcome, file: doc.name, scanned: !text.trim() };
}

export const letterLabel = (l: Pick<Letter, 'kind' | 'no'>) => `${l.kind === 'addendum' ? 'Addendum' : 'Notification'}${l.no ? ` No. ${l.no}` : ''}`;
