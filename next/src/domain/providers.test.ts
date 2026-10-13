import { describe, expect, it } from 'vitest';
import { kindOf } from './providers';

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
    expect(kindOf('Office rent', '4.1')).toBeNull();
    expect(kindOf('Salary of the project officer', '1.1.1')).toBe('staff');
  });
});
