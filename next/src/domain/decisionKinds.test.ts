import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KIND_INFO, kindSay, kindUnit } from './decisions';

describe('decision kinds', () => {
  it('every kind the decisions list can produce says what its count counts', () => {
    const src = readFileSync(new URL('./decisions.ts', import.meta.url), 'utf8');
    const kinds = [...new Set([...src.matchAll(/kind: '([^']+)'/g)].map((m) => m[1]))];
    expect(kinds.length).toBeGreaterThan(3);
    for (const k of kinds) { expect(KIND_INFO[k], k).toBeTruthy(); expect(KIND_INFO[k].note.length).toBeGreaterThan(10); }
  });
  it('counts read with their unit, singular and plural', () => {
    expect(kindUnit('Staff contract', 1)).toBe('contract');
    expect(kindUnit('Staff contract', 20)).toBe('contracts');
    expect(kindUnit('Addendum', 1)).toBe('heading');
    expect(kindSay('Staff contract', 20)).toBe('20 staff contracts ending');
    expect(kindSay('Addendum', 2)).toBe('2 addenda');
  });
});
