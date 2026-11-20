import { describe, expect, it } from 'vitest';
import { parseWorkbook, toBudgetLines } from './workbook';

// VC budget proposal: "Budget for all Years" next to "Secured budget (500K)", no actual block.
const R = [
  ['VC 4552 budget proposal'],
  [null, null, 'Budget for all Years', null, null, 'Secured budget\n(500K)'],
  ['Description', 'Unit', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)', '# of units', 'Unit rate \n(in EUR)', 'Cost \n(in EUR)'],
  ['1 Human resources'],
  ['1.1.1.3 Senior project officer', 'Per month', 24, 4961, 119064, 12, 4961, 59532],
  ['1.1.3 Local short-term consultant', 'Per day', 52, 200, 10400, 31, 200, 6200],
  ['5.7 Cost of conferences/seminars', 'Per event', 18, 22256.86, 400623.44, 10, 18872.97, 188729.72],
].map((r) => r.map((c) => (c == null ? '' : String(c))));

describe('budget proposal with a secured-funding block', () => {
  it('keeps the secured block out of spending', () => {
    const wb = parseWorkbook([{ name: 'Donor version', R }]);
    const L = toBudgetLines(wb);
    expect(L.reduce((a, l) => a + l.actual, 0)).toBe(0);
    expect(L.find((l) => l.code === '5.7')).toMatchObject({ approved: 400623.44 });
    expect(wb.meta.secured).toMatchObject({ '1.1.1.3': 59532, '5.7': 188729.72 });
  });
});
