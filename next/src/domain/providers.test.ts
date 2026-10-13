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
  it('falls back to the line', () => {
    expect(kindOf('PO 1234', '1.2.3')).toBe('intl');
    expect(kindOf('PO 1234', '5.7.3')).toBe('events');
    expect(kindOf('Services', '5.2', 'Visibility actions')).toBe('visibility');
    expect(kindOf('Petty cash advance request - 1/2026 Petty cash multiple BLs', '5.7')).toBeNull();
    expect(kindOf('Office rent', '4.1')).toBeNull();
    expect(kindOf('Salary of the project officer', '1.1.1')).toBeNull();
  });
});
