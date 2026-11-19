import { describe, expect, it } from 'vitest';
import { coverEnd, officeServices, serviceKind } from './officeServices';
import type { OfficeReport } from './office';

const e = (line: string, supplier: string, description: string, spent = 100, committed = 0) => ({ line, doc: 'd', description, supplier, amount: spent + committed, spent, committed, status: 'OPEN', date: '2026-02-01', fund: 'ob' as const, gl: false });
describe('office services', () => {
  it('names a service by what its orders say, else by its budget line', () => {
    expect(serviceKind('Office Rent - Main office - Jan-Feb-Mar 2026', 'Rent (and related charges, tax)')).toBe('Office rent');
    expect(serviceKind('Withholding tax payment and tax declaration service fee', 'Rent (and related charges, tax)')).toBe('Accounting and tax');
    expect(serviceKind('Car Rental and Petrol Cost for Q1', 'Vehicle costs')).toBe('Vehicle rental and fuel');
    expect(serviceKind('Something else', 'Postage (and courier)')).toBe('Postage');
    expect(serviceKind('Purchasing drinking water for the office', 'Office supplies')).toBe('Drinking water');
  });
  it('reads the period an order covers', () => {
    expect(coverEnd('Purchasing security guard service from Feb to Dec 2026')).toBe('2026-12-31');
    expect(coverEnd('Office Rent - Jan-Feb-Mar 2026')).toBe('2026-03-31');
    expect(coverEnd('DIRECT DEBIT_Electricity_Q1 2026')).toBe('2026-03-31');
    expect(coverEnd('Insurance services for the office for 2026')).toBe('2026-12-31');
    expect(coverEnd('Office repairs needs')).toBeUndefined();
  });
  it('groups the orders of a line by supplier and kind; petty cash, missions and regularisations are not contracts', () => {
    const r = { lines: [{ code: '1.1', description: 'Rent (and related charges, tax)' }, { code: '1.10', description: 'Security services' }], entries: [
      e('1.1', 'Alpha Landlord', 'Office Rent - Jan-Feb-Mar 2026', 9000), e('1.1', 'Alpha Landlord', 'Office Rent - Apr-May-Jun 2026', 0, 9000), e('1.1', 'Beta Advisers', 'Withholding tax declaration fee', 300),
      e('1.10', 'Gamma Guards', 'Security guard service from Feb to Dec 2026', 1000, 9000), e('1.10', '', 'DPC REGUL IMPUTATIONS', 50), e('1.10', 'COUNCIL OF EUROPE PROGRAMME OFFICE X', 'Petty cash advance', 20), e('1.10', 'MISSIONS Plan 01 General', 'OM26', 10)] } as unknown as OfficeReport;
    const S = officeServices(r);
    expect(S.map((s) => [s.line, s.supplier, s.kind, s.orders.length])).toEqual([['1.1', 'Alpha Landlord', 'Office rent', 2], ['1.1', 'Beta Advisers', 'Accounting and tax', 1], ['1.10', 'Gamma Guards', 'Security', 1]]);
    expect(S[0]).toMatchObject({ amount: 18000, open: 9000, covers: '2026-06-30' });
  });
});
