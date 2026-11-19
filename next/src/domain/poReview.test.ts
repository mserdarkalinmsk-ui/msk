import { describe, expect, it } from 'vitest';
import { contractMonths, gradeOf, poReview, PO_KIND, unitKind, type PoReport } from './poReview';
import type { PO, WorkbookSummary } from './workbook';

const po = (x: Partial<PO>): PO => ({ po: '1', line: '2.1', description: 'Travel One', nature: '', supplier: 'Alpha Ltd', amount: 100, spent: 0, balance: 100, sc: 100, status: 'OPEN', date: '2026-01-01', units: 1, unitType: 'Per Travel', ...x });
const line = (code: string, unit: string, rate: number | null, units: number | null = 10) => ({ code, description: code, unit, level: 2, leaf: true, budget: { units, rate, cost: (units ?? 1) * (rate ?? 0) }, actual: { units: null, rate: null, cost: 0 }, sc: 0 });
const LINES = [line('2.1', 'Per return flight', 150), line('1.1.1', 'Per month', 3000), line('5.7.1', 'Per event', 4000, 2), line('5.7.2', 'Per event', 4000, 2)];
const rep = (label: string, pos: PO[], lines = LINES): PoReport => ({ date: label, label, wb: { meta: {}, lines, totals: {}, situation: [], pos, monthly: [], movements: [], sheets: [], checks: [] } as unknown as WorkbookSummary });
const kinds = (r: PoReport[]) => poReview(r).findings.map((f) => f.kind).sort();

describe('PO review', () => {
  it('a clean order gives no finding', () => {
    expect(kinds([rep('A', [po({})])])).toEqual([]);
  });
  it('flags spending above the order, a unit not counted like its line, and a unit cost far above the budget rate', () => {
    const F = poReview([rep('A', [po({ po: '1', spent: 160, balance: 0, sc: 160, amount: 100 }), po({ po: '2', unitType: 'Per month' }), po({ po: '3', amount: 900, units: 2 })])]).findings;
    expect(F.find((f) => f.po === '1')?.kind).toBe('over');
    expect(F.find((f) => f.po === '2')?.kind).toBe('unit');
    expect(F.find((f) => f.po === '3')).toMatchObject({ kind: 'rate', level: 'warn' });
  });
  it('an order on a heading names the lines it should be on; a line outside the budget is said so', () => {
    const F = poReview([rep('A', [po({ po: '1', line: '5.7', unitType: 'Per event' }), po({ po: '2', line: '9.9' })])]).findings.filter((f) => f.kind === 'no-line');
    expect(F[0].text).toContain('5.7.1, 5.7.2');
    expect(F[1].text).toContain('not a line of the budget');
  });
  it('amount typed as units, the same order twice, a closed order with a balance', () => {
    expect(kinds([rep('A', [po({ amount: 1100, sc: 1100, units: 1100, unitType: 'Per item', line: '2.1' })])])).toContain('typed');
    expect(kinds([rep('A', [po({ po: '1' }), po({ po: '2' })])])).toContain('dup');
    expect(kinds([rep('A', [po({ po: '1', line: '2.1', description: 'x' }), po({ po: '1', line: '2.1', description: 'x' })])])).not.toContain('dup');
    expect(kinds([rep('A', [po({ status: 'FINALLY CLOSED', balance: 40, spent: 60 })])])).toContain('closed-balance');
  });
  it('follows every pair of reports: a move to another line is caught even when it was not in the latest report', () => {
    const F = poReview([rep('A', [po({ line: '2.1' })]), rep('B', [po({ line: '1.1.1', unitType: 'Per month', units: 1, amount: 100 })]), rep('C', [po({ line: '1.1.1', unitType: 'Per month', units: 1, amount: 100 })])]).findings;
    const m = F.find((f) => f.kind === 'moved')!;
    expect(m.level).toBe('bad');
    expect(m.text).toContain('line 2.1 in A');
    expect(m.text).toContain('line 1.1.1 in B');
  });
  it('raised, spent going down, gone, unit and units changed; a PO closed down to its spending is not a change', () => {
    const k = kinds([rep('A', [po({ po: '1', amount: 100, spent: 50 }), po({ po: '2' }), po({ po: '3', amount: 100, spent: 60 }), po({ po: '4', units: 2 })]),
      rep('B', [po({ po: '1', amount: 180, spent: 20 }), po({ po: '3', amount: 60, spent: 60, balance: 0, sc: 60, status: 'FINALLY CLOSED' }), po({ po: '4', units: 3, unitType: 'Per trip' }), po({ po: '5', description: 'Travel Two' })])]);
    expect(k).toEqual(expect.arrayContaining(['raised', 'spent-down', 'gone', 'units-changed', 'new']));
    expect(k).not.toContain('reduced');
    expect(k).not.toContain('unit-changed'); // "Per Travel" → "Per trip": the same unit written another way
  });
  it('every kind has a label and a group', () => {
    for (const v of Object.values(PO_KIND)) { expect(v.label).toBeTruthy(); expect(['line', 'unit', 'amount', 'change']).toContain(v.group); }
  });
  it('a per diem is not a fee day: "Per Day" on a subsistence line or order is a wrong unit, with the right one proposed', () => {
    const L = [line('1.3.1', 'Per diem', 100)];
    const F = poReview([rep('A', [po({ line: '1.3.1', unitType: 'Per Day', nature: 'Missions - subsistence' })], L)]).findings;
    expect(F[0]).toMatchObject({ kind: 'unit', fix: 'Per diem' });
    expect(unitKind('Per Day')).not.toBe(unitKind('Per Diem'));
    expect(unitKind('Per person/day')).toBe(unitKind('Per Day'));
    expect(unitKind('Per return flight')).toBe(unitKind('Per Travel'));
  });
  it('the line\'s unit is taken from the approved budget when the report leaves it out, else from what its orders say', () => {
    const L = [line('2.1', '', 150)];
    expect(poReview([rep('A', [po({ unitType: 'Per month' })], L)], [{ code: '2.1', unit: 'Per return flight' }]).findings[0]).toMatchObject({ kind: 'unit', fix: 'Per return flight' });
    const P = [1, 2, 3, 4].map((i) => po({ po: String(i), description: 'Travel ' + i })).concat(po({ po: '9', unitType: 'Per month', description: 'Travel Nine' }));
    expect(poReview([rep('A', P, L)]).findings.find((f) => f.po === '9')?.text).toContain('on 4 of its 5 orders');
  });
  it('"Per item" where the line counts something specific is flagged as a generic unit', () => {
    const F = poReview([rep('A', [po({ line: '5.7.1', unitType: 'Per item', amount: 4000, units: 1 })])]).findings;
    expect(F[0]).toMatchObject({ kind: 'generic', fix: 'Per event' });
    expect(kinds([rep('A', [po({ line: '5.8', unitType: 'Per unit' })], [line('5.8', 'Per item', 100)])])).toEqual([]);
  });
  it('an order of one kind on a line of another: travel on an event line, a line code named on the order', () => {
    const F = poReview([rep('A', [po({ po: '1', line: '5.7.1', nature: 'Missions - travel', unitType: 'Per Travel' }), po({ po: '2', line: '2.1', nature: '5.7 - Framework agreement', unitType: 'Per Travel' })])]).findings;
    expect(F.find((f) => f.po === '1')).toMatchObject({ kind: 'line-kind', fix: '2.1' });
    expect(F.find((f) => f.po === '2')).toMatchObject({ kind: 'line-named', fix: '5.7', level: 'bad' });
  });
  it('a subsistence order counted per trip, and a staff contract whose months do not match its dates', () => {
    expect(poReview([rep('A', [po({ line: '1.3.1', unitType: 'Per Travel', nature: 'Experts - subsistence' })], [line('1.3.1', '', 100)])]).findings[0].kind).toBe('unit-kind');
    expect(contractMonths('One,Alpha - B2/1 - 100% - from 01/09/2024 to 31/12/2024')).toBeCloseTo(4, 0);
    expect(contractMonths('from 01/01/2026 to 30/06/2026 and 01/09/2026 to 31/12/2026')).toBeCloseTo(10, 0);
    const F = poReview([rep('A', [po({ line: '1.1.1', unitType: 'Per month', units: 6, amount: 12000, description: 'Alpha,One - B2/1 - 100% - Ankara from 01/09/2024 to 31/12/2024' })])]).findings;
    expect(F.find((f) => f.kind === 'unit-count')?.fix).toBe('4');
  });
  it('a staff contract on the line of another grade is flagged with the line its grade uses', () => {
    const L = [line('1.1.1.2', 'Per month', 5000), line('1.1.1.7', 'Per month', 3000)];
    const s = (n: string, g: string, l: string) => po({ po: n, line: l, unitType: 'Per month', units: 1, amount: 3000, description: `Alpha,${n} - ${g}/1 - 100% - from 01/01/2026 to 31/01/2026` });
    const F = poReview([rep('A', [s('1', 'B2', '1.1.1.7'), s('2', 'B2', '1.1.1.7'), s('3', 'A2', '1.1.1.2'), s('4', 'A2', '1.1.1.7')], L)]).findings.filter((f) => f.kind === 'line-grade');
    expect(F.map((f) => f.po)).toEqual(['4']);
    expect(F[0].fix).toBe('1.1.1.2');
    expect(gradeOf('Alpha,One - B4/1 - 100% - Ankara')).toBe('B4');
  });
});
