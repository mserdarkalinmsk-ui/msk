import { describe, expect, it } from 'vitest';
import { kindOf, supKey } from './providers';

describe('service provider kinds', () => {
  it('reads the PO wording first', () => {
    expect(kindOf('Organisation of the national conference, catering and venue', '5.7.2')).toBe('events');
    expect(kindOf('National consultant for the baseline study', '1.1.3')).toBe('consult');
    expect(kindOf('International expert fees', '5.7.1')).toBe('intl');
    expect(kindOf('Printing of the handbook', '5.1')).toBe('publication');
    expect(kindOf('Roll-up banners and leaflets', '5.8')).toBe('visibility');
    expect(kindOf('Needs assessment survey', '5.8')).toBe('research');
    expect(kindOf('Danışmanlık hizmeti', '5.7.1')).toBe('consult');
    expect(kindOf('Kitap basımı', '5.1')).toBe('publication');
  });
  it('knows interpretation', () => {
    expect(kindOf('interpretation service and technical equipment for the Launching Conf', '5.7')).toBe('interp');
    expect(kindOf('Interpretation_Project kick-off meeting', '5.5.2')).toBe('interp');
    expect(kindOf('Services', '5.5.2')).toBe('interp');
  });
  it('falls back to the line', () => {
    expect(kindOf('PO 1234', '1.2.3')).toBe('intl');
    expect(kindOf('PO 1234', '5.7.3')).toBe('events');
    expect(kindOf('Services', '5.2', 'Visibility actions')).toBe('visibility');
    expect(kindOf('Petty cash advance request - 1/2026 Petty cash multiple BLs', '5.7')).toBe('petty');
    expect(kindOf('DSA for participants of the conference', '5.7.1')).toBe('perdiem');
    expect(kindOf('Per diem national consultant', '1.1.3')).toBe('perdiem');
    expect(kindOf('PAIE TEMPORAIRE Plan 01 General', '1.1.1.4')).toBe('staff');
    expect(kindOf('Grant to CSO for awareness campaign', '6.1')).toBe('grants');
    expect(kindOf('Sub-grant research', '6.2.1')).toBe('grants');
    expect(kindOf('Consultant travel', '1.3.1')).toBe('perdiem');
    expect(kindOf('Meeting', '1.3.2')).toBe('perdiem');
    expect(kindOf('OM 2024-123 Ankara', '1.3.1')).toBe('perdiem');
    expect(kindOf('Travel of the expert to Ankara', '1.3.2')).toBe('perdiem');
    expect(kindOf('Organisation of the launching conference in Ankara', '1.3.2')).toBe('events');
    expect(kindOf('Travel of participants', '1.3.1', '', 'SERENAS INTERNATIONAL TOURISM CONGRESS ORGANIZATION INC.')).toBe('events');
    expect(kindOf('Travel PO for 3 international consultants_Izmir_25-29 Aug 2025', '2.1', '', 'EXPERTS Plan 01 General')).toBe('perdiem');
    expect(kindOf('Organization of the launching conference in Ankara on 4 December 2024', '2.1', '', 'SERENAS INTERNATIONAL TOURISM CONGRESS ORGANIZATION INC.- ANKARA')).toBe('events');
    expect(kindOf('Flight tickets for the expert', '5.7.1')).toBe('perdiem');
    expect(kindOf('Event Management for the ACT A.2.2.1 Planning and conducting try-out studies for language proficiency tests', '5.8')).toBe('events');
    expect(kindOf('Complementary PO for PO882359-additional fee for interpretation', '5.5.2')).toBe('interp');
    expect(kindOf('Printing of banners', '5.1', '', 'SERVICE INTERNE PLAN 01 GENERAL')).toBe('petty');
    expect(kindOf('Mobile line', '4.3', '', 'TURKCELL ILETISIM HIZMETLERI A.S. (Fournisseur Direct Debit)')).toBe('petty');
    expect(kindOf('Office rent', '4.1')).toBeNull();
    expect(kindOf('Salary of the project officer', '1.1.1')).toBe('staff');
  });
  it('merges spellings of one company', () => {
    expect(supKey('SERENAS INTERNATIONAL TOURISM CONGRESS ORGANIZATION INC.- ANKARA')).toBe(supKey('Serenas International Tourism Congress Organization Inc.'));
    expect(supKey('MATBUU PRINT AND INTERNET SERVICES ORG.LTD.STI.')).toBe(supKey('Matbuu Print and Internet Services Org. Ltd. Şti'));
    expect(supKey('TURKCELL ILETISIM HIZMETLERI A.S. (Fournisseur Direct Debit)')).toBe(supKey('Turkcell Iletisim Hizmetleri AS'));
    expect(supKey('FLAP CONGRESS MEETING SERVICES')).not.toBe(supKey('SERENAS INTERNATIONAL TOURISM CONGRESS ORGANIZATION INC.'));
  });
});

import { providerSummary } from './providers';
describe('provider summary', () => {
  it('counts the main kinds only, by country and provider', () => {
    const po = (po: string, line: string, description: string, supplier: string, sc: number) => ({ po, line, description, nature: '', supplier, amount: sc, spent: sc, balance: 0, sc, status: 'OPEN', date: '2026-03-01', units: null, unitType: '' });
    const wb = { pos: [po('1', '5.7', 'Organisation of the conference', 'FLAP CONGRESS', 1000), po('2', '5.5.2', 'Interpretation', 'ENTERKON AS', 300), po('3', '1.1.1', 'Salary', 'PAIE TEMPORAIRE', 5000)] };
    const p = { id: 'a', code: 'A', name: 'A', country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 1, reportingPeriods: [{ id: 'r', name: 'r', type: 'x', date: '2026-03-31', snapshot: { lines: [], workbook: wb } }] } as never;
    const S = providerSummary([p]);
    expect(S.total).toBe(1300);
    expect(S.kinds.map((k) => k.k)).toEqual(['events', 'interp']);
    expect(S.countries).toEqual([{ c: 'tr', v: 1300 }]);
    expect(S.top[0].supplier).toBe('FLAP CONGRESS');
  });
});
