import { describe, expect, it } from 'vitest';
import { variances } from './variance';

describe('variance explanations', () => {
  it('drafts text for overspent, under-used and unit-cost lines only', () => {
    const V = variances([
      { code: '1.1', d: 'Staff', aA: 1000, act: 1200, use: 1.2, dRp: null, dU: null, unit: '' },
      { code: '2.1', d: 'Travel', aA: 1000, act: 50, use: 0.05, dRp: null, dU: null, unit: '' },
      { code: '3.1', d: 'Laptops', aA: 1000, act: 500, use: 0.5, dRp: 0.2, dU: null, unit: 'pc' },
      { code: '4.1', d: 'Rent', aA: 1000, act: 600, use: 0.6, dRp: 0.02, dU: null, unit: '' },
    ], 0.6, 10000, { '1.1': { description: '', clarification: '', justification: 'Project manager full time. Second sentence.' } });
    expect(V.map((v) => v.kind)).toEqual(['overspent', 'under-used', 'unit cost']);
    expect(V[0].draft).toContain('Project manager full time.');
  });
});
