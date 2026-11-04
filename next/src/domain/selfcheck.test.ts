import { describe, expect, it } from 'vitest';
import seed from '../data/seed.json';
import demo from '../data/demo.json';
import { selfCheck } from './selfcheck';
import type { Project } from './types';

describe('self-check', () => {
  it('finds nothing on the sample portfolios', () => {
    for (const d of [seed, demo]) expect(selfCheck((d as { projects: Project[] }).projects).map((x) => `${x.project?.code} ${x.figure}`)).toEqual([]);
  });
});
