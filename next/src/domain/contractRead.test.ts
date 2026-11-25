import { describe, expect, it } from 'vitest';
import { contractTerms, money } from './contractRead';

// the wording of an Act of Engagement, with invented content
const AOE = `Contract No. ► SC099/2026 Project ID / Sector ► PROGRAMME OFFICE ACT OF ENGAGEMENT (Direct Award / Framework contract)
Legal personality ☐ Natural person Name and address ► ALPHA ACCOUNTING SERVICES LTD. Example Mah. Test Bul. No:1, 06000 Ankara
Representative (for legal persons only) ► ONE ALPHA Type(s) of Units Deadline for delivery Price per month Tax declaration service fee End of each month 1.000,00 TRY
TOTAL FOR 12 MONTHS OF 2026 (including VAT) 123.456,78 TRY
This Framework Contract takes effect as from the date of its signature by both parties and is concluded until: 31/12/2026
The Framework Contract may be renewed [annually] with the written agreement of the parties. It may not be renewed beyond: 31/01/2027`;

describe('contract terms read from its text', () => {
  it('reads the reference, provider, end, renewal limit and total of an Act of Engagement', () => {
    expect(contractTerms(AOE)).toEqual({ ref: 'SC099/2026', provider: 'ALPHA ACCOUNTING SERVICES LTD.', end: '2026-12-31', renewBy: '2027-01-31', total: 123456.78, cur: 'TRY', renewEvery: 'year' });
  });
  it('finds the provider by its legal form when the label sits between the lines of the address', () => {
    expect(contractTerms('Legal personality Natural person DELTA UTILITIES LTD. ŞTİ. Example Mah. Test Bul. No:1, Name and address 06000 Ankara, Türkiye Representative ONE ALPHA').provider).toBe('DELTA UTILITIES LTD. ŞTİ.');
  });
  it('reads a lease amendment and a rider: the lessor, the period in words, the effect date and the rent in force', () => {
    const AM = `2ND AMENDMENT TO THE LEASE CONTRACT NO SC099/2025 between The Council (hereinafter the "Lessee"). Represented by One ALPHA, Head of Operations and Two BETA (hereinafter the "Lessor"). Article 3 – Rent Revision for 2026 for the period from 1 January 2026 until 18 February 2026 the total monthly rent shall amount to: 500,000 TRY monthly rent and 125,000 TRY withholding tax. As from 18 February 2026 the rent shall amount to: 300,000 TRY monthly rent and 75,000 TRY withholding tax. This amendment shall apply with effect from 1 January 2026.`;
    expect(contractTerms(AM)).toMatchObject({ ref: 'SC099/2025', provider: 'Two BETA', start: '2026-01-01', fee: 300000, cur: 'TRY' });
    const RI = `RIDER TO THE LEASE CONTRACT Between The Secretary General (hereinafter referred to as “the Lessee”), and Three GAMMA (hereinafter referred to as “the Lessor”), The Lease Agreement is extended for a fixed period starting from 1 December 2023 until 31 December 2023.`;
    expect(contractTerms(RI)).toMatchObject({ provider: 'Three GAMMA', start: '2023-12-01', end: '2023-12-31' });
  });
  it('takes the largest of several totals (purchase, monthly fees, all services)', () => {
    const t = contractTerms('Total for purchasing December 2025 (including VAT) 100.000,00 TRY Total for monthly fee December 2025 - December 2026 (including VAT) 10.000,00 TRY Total for all services until 10 December 2026 (including VAT) 110.000,00 TRY concluded until: 10/12/2026 may not be renewed beyond: 10/12/2028');
    expect([t.total, t.cur, t.end, t.renewBy]).toEqual([110000, 'TRY', '2026-12-10', '2028-12-10']);
  });
  it('reads amounts in either writing', () => {
    expect([money('1.133.553,63'), money('1,133,553.63'), money('1 133 553,63'), money('8000')]).toEqual([1133553.63, 1133553.63, 1133553.63, 8000]);
  });
  it('reads nothing from a scan (no text)', () => { expect(contractTerms('')).toEqual({}); });
});

describe('contract terms read from a scan', () => {
  // the kind of text a scan gives of an Act of Engagement — invented content, with a scan's typical mistakes
  const SCAN = `Contract No. > XY123/2031 | ACT OF ENGAGEMENT Name and address ALPHA SERVICES LTD. Example Mah. | Service fee End of each month 2.000,00 TRY |
: TOTAL FOR 12 MONTHS OF | | 2031 24.680,50 TRY | (including VAT) This Framework Contract takes effect as from the date of its signature by both parties and is 30/06/2031
concluded until: iy t The Framework Contract may be renewed [annually] with the written agreement of the parties. It 311112032 | may not be renewed beyond: } Contract No. > XY12312031 Contract No. > XYl23/2031 Contract No. > $Y999/2031 Contract No. > XY123/2031`;
  it('finds dates written before their labels, slashes read as digits, and the most frequent reading of the reference', () => {
    expect(contractTerms(SCAN)).toMatchObject({ ref: 'XY123/2031', end: '2031-06-30', total: 24680.5, cur: 'TRY' });
  });
  it('finds the provider when a scan cuts the label, or reads no label at all', () => {
    expect(contractTerms('Legal person | Name and = BETA ADVISORY SERVICES LTD. STi. address | Example Mah. No:1').provider).toBe('BETA ADVISORY SERVICES LTD. STi.');
    expect(contractTerms('COUNCIL OF EUROPE ACT OF ENGAGEMENT 0 Natural person GAMMA ALARM SYSTEMS A.S. Consortium Representative One ALPHA Account holder KE) GAMMA ALARM SYSTEMS A.S.').provider).toBe('GAMMA ALARM SYSTEMS A.S.');
  });
  it('reads a renewal limit whose slashes the scan turned into ones', () => {
    expect(contractTerms('may be renewed. It 150312032 | may not be renewed beyond: }').renewBy).toBe('2032-03-15');
  });
  it('never reads a year and an amount as one number, nor the total of the monthly fees as a monthly fee', () => {
    const t = contractTerms('Total for purchasing March 2031 4.200,00 TRY Total for monthly fee March 2031 - March 2032 900,00 TRY Total for all services | until 1 March 2032 | 5.100,00 TRY');
    expect([t.total, t.fee]).toEqual([5100, undefined]);
  });
  it('does not take a sub-period of a rent revision for the contract period, nor a monthly rent for a total', () => {
    const t = contractTerms('for the period from 1 January 2031 until 15 March 2031, the total monthly rent applicable to the full premises shall amount to: 70,000 TRY monthly rent. As from 15 March 2031 the monthly rent shall amount to 40,000 TRY monthly rent.');
    expect([t.end, t.total, t.fee]).toEqual([undefined, undefined, 40000]);
  });
});

describe('extension options', () => {
  it('reads the step of each renewal, an extension period, tacit renewal and the notice to give', () => {
    expect(contractTerms('The Framework Contract may be renewed [annually] with the written agreement of the parties.').renewEvery).toBe('year');
    expect(contractTerms('may be renewed [monthly] with the written agreement').renewEvery).toBe('month');
    expect(contractTerms('The lease may be extended for a further period of two (2) years.').renewEvery).toBe('24');
    const t = contractTerms('The contract shall be tacitly renewed for one year unless either party gives notice in writing at least sixty (60) days prior notice before the end.');
    expect([t.autoRenew, t.noticeDays]).toEqual([true, 60]);
    expect(contractTerms('with a notice period of 3 months').noticeDays).toBe(90);
    expect(contractTerms('Either party may terminate with 30 days’ written notice.').noticeDays).toBe(30);
    expect(contractTerms('The parties sign the act.')).toEqual({});
  });
  it('reads a provider printed in Title Case, wherever the label falls, and drops the marks a scan leaves', () => {
    const name = 'Gamma Uluslararası Turizm Kongre Organizasyon A.Ş.';
    for (const t of [`Name and address3 ${name} Delta Mah. Kappa Cad. No: 13`, `Name and ${name} address3 Delta Mah. Kappa Cad. No: 13`, `${name} Name and address3 Delta Mah. Kappa Cad. No: 13`])
      expect(contractTerms(t).provider).toBe(name);
    expect(contractTerms('Name and address ’ Omega Kongre Hizmetleri A.S. > ~ Delta Mah. No: 2').provider).toBe('Omega Kongre Hizmetleri A.S.');
  });
  it('reads a framework agreement that renews tacitly each year up to a last date, with notice before the renewal', () => {
    const t = contractTerms('This Framework Agreement takes effect as from the date of its signature by both parties and is concluded until: 30/06/2029 At the end of its initial term, the Framework Agreement shall be tacitly renewed for a further term of one year, and shall renew each year thereafter, unless either party notifies the other in writing of its intention to terminate the contract at the latest 3 months before the renewal date. The contract shall not be renewed beyond 30 June 2031 and shall end on this date.');
    expect(t).toMatchObject({ end: '2029-06-30', renewBy: '2031-06-30', renewEvery: '12', autoRenew: true, noticeDays: 90 });
  });
});

describe('a framework contract with a table of monthly fees, read from a scan', () => {
  // the layout of a car rental Act of Engagement: the currency heads the column, the rows carry none
  const scan = `A. Terms of reference/Table of unit fees The Council of Europe Programme Office in Alpha will rent a car for the use of the Office between the dates 01.07.2025 to 30.06.2027.
    Fees The fees indicated below will be applicable throughout the duration of the Framework Contract. Prices are indicated in Turkish Lira without VAT.
    The Provider shall indicate its proposed fee(s) in the box(es) below. Monthly fee Type(s) of Units ▼ (TRY)
    Car rental services for the period of 01.07.2025 — 30.06.2027 | 1,500
    Fuel chip provision for fuel consumption of 01.07.2025 – 30.06.2027 500
    Grand Total (Monthly) 2,000
    OPTION 3 This Framework Contract takes effect as from the date of its signature by both parties and is concluded until: 30/06/2027
    At the end of its initial term, the Framework Contract will be tacitly renewed every six months and shall renew each 6 (six) months thereafter, unless either party notifies the other in writing of its intention to terminate the contract at the latest 2 (two) months before the renewal date. The contract shall not be renewed beyond 30.06.2028 and shall end on this date.`;
  it('reads each fee of the table, the monthly total and its currency', () => {
    const t = contractTerms(scan);
    expect(t.fee).toBe(2000);
    expect(t.cur).toBe('TRY');
    expect(t.items).toEqual([{ label: 'Car rental services', fee: 1500 }, { label: 'Fuel chip provision for fuel consumption', fee: 500 }]);
  });
  it('reads the period, the renewal every six months and the notice written as "2 (two) months"', () => {
    const t = contractTerms(scan);
    expect(t).toMatchObject({ start: '2025-07-01', end: '2027-06-30', renewBy: '2028-06-30', autoRenew: true, renewEvery: '6', noticeDays: 60 });
  });
  it('adds the rows up when the total is not read', () => {
    const t = contractTerms(scan.replace('Grand Total (Monthly) 2,000', ''));
    expect(t.fee).toBe(2000);
    expect(t.items?.length).toBe(2);
  });
  it('a scan read column by column (labels, then amounts): the total is kept, rows that do not add up are not', () => {
    const t = contractTerms(scan.replace('Car rental services for the period of 01.07.2025 — 30.06.2027 | 1,500\n    Fuel chip provision for fuel consumption of 01.07.2025 – 30.06.2027 500',
      'Car rental services for the period of 01.07.2025 — 30.06.2027 Fuel chip provision for fuel consumption of 01.07.2025 – 30.06.2027 1,500 500'));
    expect(t.fee).toBe(2000);
    expect(t.items).toBeUndefined();
  });
});
