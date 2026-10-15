import { describe, expect, it } from 'vitest';
import { num, progress, tidy } from './logframe';
describe('logframe helpers', () => {
  it('cleans reading leftovers and measures progress', () => {
    expect(tidy(': 0 1.2.1 .1')).toBe('0');
    expect(num('60%')).toBe(60); expect(num('1,200 judges')).toBe(1200);
    expect(progress({ id: 'a', result: '', indicator: 'x', baseline: '0', target: '200', source: '', current: '50' })).toBe(0.25);
    expect(progress({ id: 'a', result: '', indicator: 'x', baseline: '0', target: 'all', source: '', current: '5' })).toBeNull();
  });
});
