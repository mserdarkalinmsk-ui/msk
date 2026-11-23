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
    expect(contractTerms(AOE)).toEqual({ ref: 'SC099/2026', provider: 'ALPHA ACCOUNTING SERVICES LTD.', end: '2026-12-31', renewBy: '2027-01-31', total: 123456.78, cur: 'TRY' });
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
