import { describe, expect, it } from 'vitest';
import { Mask } from './mask';

describe('Mask', () => {
  const m = new Mask(['Redacted,Mervenur', 'Redacted,Ayse Gunce']);
  it('replaces staff names in every written form and keeps one placeholder per person', () => {
    const t = m.hide('PAIE OCT-26 Redacted,Mervenur 15015 · Mervenur Redacted · OM26_1- Mrs Redacted Ayse Gunce - Agent');
    expect(t).not.toMatch(/Redacted|Mervenur|Redacted|Ayse/);
    expect(t).toBe('PAIE OCT-26 Person 1 15015 · Person 1 · OM26_1- Mrs Person 2 - Agent');
  });
  it('also hides titled names and SURNAME,Given forms it was not told about', () => {
    const t = m.hide('OM26_580981- Mr Redacted Donche; Redacted,Ezgi - A2/2');
    expect(t).not.toMatch(/Redacted|Donche|Redacted|Ezgi/);
  });
  it('puts the names back in the answer', () => {
    expect(m.show('Paid to Person 1 and Person 2.')).toBe('Paid to Redacted,Mervenur and Mrs Redacted Ayse Gunce.'.replace('Mrs ', ''));
  });
});
