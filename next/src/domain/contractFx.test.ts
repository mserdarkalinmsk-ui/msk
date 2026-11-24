import { describe, expect, it } from 'vitest';
import { feeAt, impliedRate, orderPeriod, yearCost } from './contractFx';

describe('contracts in another currency against the office budget', () => {
  it('reads the period an order pays from its description', () => {
    expect(orderPeriod('Office Rent - Alpha Office - Jan-Feb-Mar 2026')).toEqual({ from: '2026-01', months: 3 });
    expect(orderPeriod('Office Rent - Alpha Office - Q2 2026')).toEqual({ from: '2026-04', months: 3 });
    expect(orderPeriod('Purchasing security guard service from Feb to Dec 2026 for Alpha office')).toEqual({ from: '2026-02', months: 11 });
    expect(orderPeriod('Car Rental and Petrol Cost for the 2nd Quarter of 2026')).toEqual({ from: '2026-04', months: 3 });
    expect(orderPeriod('Maintenance cost for January 2026')).toEqual({ from: '2026-01', months: 1 });
    expect(orderPeriod('Insurance services for the Alpha Office for 2026')).toEqual({ from: '2026-01', months: 12 });
    // "declaration" is not December, "maintenance" not March
    expect(orderPeriod('Withholding tax declaration and maintenance 2026')).toBeUndefined();
    expect(orderPeriod('Office rent')).toBeUndefined();
  });
  it('finds the rate the orders were booked at from the monthly fee', () => {
    const c = { cur: 'TRY', fee: 300000, fees: [{ from: '2026-01-01', fee: 300000 }, { from: '2026-04-01', fee: 360000 }] };
    expect(feeAt(c, '2026-03')).toBe(300000);
    expect(feeAt(c, '2026-05')).toBe(360000);
    // Q1 at 300,000 × 3 = 900,000 TRY for €20,000 → 45; Q2 at 360,000 × 3 for €24,000 → 45
    const r = impliedRate(c, [{ description: 'Rent Jan-Feb-Mar 2026', amount: 20000 }, { description: 'Rent Q2 2026', amount: 24000 }, { description: 'Rent', amount: 5 }]);
    expect(r).toEqual({ rate: 45, n: 2 });
    expect(impliedRate({ cur: 'EUR', fee: 100 }, [{ description: 'Rent Q1 2026', amount: 300 }])).toBeUndefined();
    expect(impliedRate({ cur: 'TRY', fee: 100 }, [{ description: 'Rent', amount: 300 }])).toBeUndefined();
  });
  it('costs a year at the fee in force each month, within the contract dates', () => {
    const c = { cur: 'TRY', fee: 360000, fees: [{ from: '2026-01-01', fee: 300000 }, { from: '2026-04-01', fee: 360000 }], start: '2026-01-01', end: '2026-12-31' };
    expect(yearCost(c, 2026)).toBe(3 * 300000 + 9 * 360000);
    expect(yearCost({ fee: 1000, start: '2026-02-01', end: '2027-06-30' }, 2026)).toBe(11000);
    expect(yearCost({ fee: 1000, start: '2026-02-01', end: '2027-06-30' }, 2027)).toBe(6000);
    expect(yearCost({ fee: 1000, start: '2026-02-01', end: '2026-06-30' }, 2027)).toBe(0);
    expect(yearCost({ total: 12000, start: '2026-07-01', end: '2027-06-30' }, 2026)).toBe(6000);
    expect(yearCost({ start: '2026-01-01', end: '2026-12-31' }, 2026)).toBeUndefined();
  });
});

describe('orders checked against the contract, and next year', () => {
  it('lists the orders that do not match the fee × the months they pay', async () => {
    const { orderChecks } = await import('./contractFx');
    const eur = { cur: 'EUR', fee: 1000 };
    expect(orderChecks(eur, [{ description: 'Guard service Q1 2026', amount: 3000 }, { description: 'Guard service Q2 2026', amount: 3600 }, { description: 'Guard extra', amount: 50 }]))
      .toEqual([{ description: 'Guard service Q2 2026', amount: 3600, expected: 3000 }]);
    const tl = { cur: 'TRY', fee: 90000 };
    expect(orderChecks(tl, [{ description: 'Rent Q1 2026', amount: 6000 }, { description: 'Rent Q2 2026', amount: 6050 }], 45)).toEqual([]);
    expect(orderChecks(tl, [{ description: 'Rent Q1 2026', amount: 6000 }], undefined)).toEqual([]);
  });
  it('costs next year at the fee in force, carried on when the contract is renewed', async () => {
    const { nextYearCost } = await import('./contractFx');
    expect(nextYearCost({ fee: 100, start: '2026-01-01', end: '2026-12-31' }, 2027)).toBe(0);
    expect(nextYearCost({ fee: 100, start: '2026-01-01', end: '2026-12-31', autoRenew: true }, 2027)).toBe(1200);
    expect(nextYearCost({ fee: 100, start: '2026-01-01', end: '2026-12-31', renewBy: '2027-06-30' }, 2027)).toBe(600);
    expect(nextYearCost({ fee: 100, start: '2026-01-01', end: '2028-12-31' }, 2027)).toBe(1200);
  });
});
