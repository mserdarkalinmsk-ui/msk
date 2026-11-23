import { describe, expect, it } from 'vitest';
import { contractTerms } from './contractRead';
import { applyAmendment, amendmentDiff, contractsDue, feeOn, type Contract } from './contracts';

// invented content in the wording of a lease amendment
const AM = `2ND AMENDMENT TO THE LEASE CONTRACT NO XY070/2030 between The Council (hereinafter the "Lessee") and Two BETA (hereinafter the "Lessor").
for the period from 1 January 2031 until 15 March 2031, the total monthly rent applicable to the full premises shall amount to: 50,000 TRY monthly rent and 12,500 TRY withholding tax.
As from 15 March 2031, the monthly rent shall be recalculated and shall amount to: 30,000 TRY monthly rent and 7,500 TRY withholding tax. This amendment enters into force on the day of its signature and it shall apply with effect from 1 January 2031.`;

describe('riders, amendments and addenda', () => {
  it('reads the kind, number, effective date and the fees by date of an amendment', () => {
    const t = contractTerms(AM);
    expect(t.amend).toEqual({ kind: 'amendment', no: 2, effective: '2031-01-01' });
    expect(t.ref).toBe('XY070/2030');
    expect(t.fees).toEqual([{ from: '2031-01-01', fee: 50000 }, { from: '2031-03-15', fee: 30000 }]);
    expect(contractTerms('RIDER TO THE LEASE CONTRACT Between … The Lease Agreement is extended for a fixed period starting from 1 December 2030 until 31 December 2030.').amend).toMatchObject({ kind: 'rider' });
  });
  it('applies an amendment as the next step of the contract: what it changes, the fee schedule, the original kept', () => {
    const c: Contract = { ref: 'XY070/2030', name: 'Two BETA', start: '2030-01-01', end: '2030-12-31', fee: 40000, cur: 'TRY' };
    const t = { ...contractTerms(AM), end: '2031-12-31' };
    expect(amendmentDiff(c, t).map((x) => [x.field, x.from, x.to])).toEqual([['end', '2030-12-31', '2031-12-31'], ['fee', 40000, 30000]]);
    const n = applyAmendment(c, t, { kind: 'amendment', no: 2, effective: '2031-01-01', at: '2031-01-20' });
    expect([n.end, n.fee, n.history?.map((h) => h.kind)]).toEqual(['2031-12-31', 30000, ['original', 'amendment']]);
    expect(n.fees).toEqual([{ from: '2030-01-01', fee: 40000 }, { from: '2031-01-01', fee: 50000 }, { from: '2031-03-15', fee: 30000 }]);
    expect([feeOn(n, '2030-06-01'), feeOn(n, '2031-02-01'), feeOn(n, '2031-06-01')]).toEqual([40000, 50000, 30000]);
  });
  it('warns on the last day to give notice while it is ahead, then on the end', () => {
    const C = { a: { name: 'A', end: '2031-12-31', noticeDays: 60 } };
    const ahead = contractsDue(C, new Date('2031-10-01T00:00:00Z'))[0], after = contractsDue(C, new Date('2031-11-15T00:00:00Z'))[0];
    expect([ahead.noticeBy, ahead.days, ahead.severity]).toEqual(['2031-11-01', 31, 'serious']);
    expect([after.noticeBy, after.days]).toEqual([undefined, 46]);
  });
});
