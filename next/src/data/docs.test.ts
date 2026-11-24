import { describe, expect, it } from 'vitest';
import { atts, docId, liftDocs, mapAtts } from './docs';

const b64 = (s: string) => btoa(s);
const att = (name: string, data?: string, id?: string) => ({ name, type: 'application/pdf', size: 10, at: '2026-11-24T00:00:00Z', ...(data ? { data } : {}), ...(id ? { id } : {}) });

describe('attached documents kept apart from the data', () => {
  it('finds attachments anywhere outside the large parts, and leaves untouched parts as they are', () => {
    const L = { projects: [{ doc: att('in-project.pdf', b64('x')) }], frameworks: { a: { doc: att('c.pdf', b64('one')), history: [{ doc: att('am.pdf', b64('two')) }] } }, coreTeam: { tr: [{ doc: att('e.pdf', undefined, 'abc') }] }, countries: [] };
    expect(atts(L).map((a) => a.name)).toEqual(['c.pdf', 'am.pdf', 'e.pdf']);
    const same = mapAtts(L, (a) => a);
    expect(same).toBe(L);
  });
  it('the same file gets the same id, another file another', async () => {
    expect(await docId(b64('one'))).toBe(await docId(b64('one')));
    expect(await docId(b64('one'))).not.toBe(await docId(b64('two')));
    expect(await docId(b64('one'))).toMatch(/^[0-9a-f]{24}$/);
  });
  it('lifts the files written into the ledger: references stay, each file once', async () => {
    const L = { projects: [], frameworks: { a: { doc: att('c.pdf', b64('one'.repeat(99))), history: [{ doc: att('copy.pdf', b64('one'.repeat(99))) }, { doc: att('am.pdf', b64('two')) }] }, b: { doc: att('kept.pdf', undefined, 'abc') } } };
    const { ledger, docs } = await liftDocs(L);
    const A = atts(ledger);
    expect(A.every((a) => !a.data && a.id)).toBe(true);
    expect(A[0].id).toBe(A[1].id);
    expect(docs.size).toBe(2);
    expect(docs.get(A[2].id!)).toBe(b64('two'));
    expect(ledger.frameworks.b).toBe(L.frameworks.b);
    expect(JSON.stringify(ledger).length).toBeLessThan(JSON.stringify(L).length);
  });
});
