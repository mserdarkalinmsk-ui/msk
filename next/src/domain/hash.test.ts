import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import { adminHash, sha256 } from './hash';

describe('sha256', () => {
  it('matches the standard digest, short and long texts, non-ASCII too', () => {
    for (const t of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'x'.repeat(200), 'Şifre ğüı']) expect(sha256(t)).toBe(createHash('sha256').update(t).digest('hex'));
  });
  it('keeps an admin password salted', () => {
    expect(adminHash('pw')).not.toBe(sha256('pw'));
    expect(adminHash('pw')).toHaveLength(64);
  });
});
