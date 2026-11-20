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
  it('reads amounts in either writing', () => {
    expect([money('1.133.553,63'), money('1,133,553.63'), money('1 133 553,63'), money('8000')]).toEqual([1133553.63, 1133553.63, 1133553.63, 8000]);
  });
  it('reads nothing from a scan (no text)', () => { expect(contractTerms('')).toEqual({}); });
});
