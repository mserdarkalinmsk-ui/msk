import { describe, expect, it } from 'vitest';
import { kindOf } from './providers';

describe('service provider kinds', () => {
  it('reads budget and PO wording', () => {
    expect(kindOf('Local 1.1.3 Local short-term consultant', '1.1.3')).toBe('consult');
    expect(kindOf('International short-term consultant', '1.2.3')).toBe('intl');
    expect(kindOf('5.5.2 Interpretation', '5.5.2')).toBe('interp');
    expect(kindOf('Simultaneous interpretation for the conference', '5.7.2')).toBe('interp');
    expect(kindOf('Translation of the manual', '5.5.1')).toBe('transl');
    expect(kindOf('Capacity building activities', '5.7.1')).toBe('events');
    expect(kindOf('Local project officer', '1.1.1')).toBeNull();
    expect(kindOf('Short-term', '1.1.3')).toBe('consult');
    expect(kindOf('Fees', '1.2.3')).toBe('intl');
    expect(kindOf('Services', '5.5.1')).toBe('transl');
    expect(kindOf('Services', '5.5.2')).toBe('interp');
    expect(kindOf('Office rent', '4.1')).toBeNull();
  });
});
