import { describe, expect, it } from 'vitest';
import { chartTable } from './chartTable';

describe('a chart as a table', () => {
  it('bars over categories: one row per category, one column per series', () => {
    const t = chartTable({ xAxis: { type: 'category', data: ['A', 'B', 'C'] }, yAxis: { type: 'value' }, series: [{ name: 'Spent', type: 'bar', data: [1, { value: 2 }, null] }, { name: 'Committed', type: 'bar', data: [3, 4, 5] }] })!;
    expect(t.cols).toEqual(['', 'Spent', 'Committed']);
    expect(t.rows).toEqual([['A', 1, 3], ['B', 2, 4], ['C', null, 5]]);
  });
  it('horizontal bars read the category axis on y and drop rich-text markup', () => {
    const t = chartTable({ yAxis: { type: 'category', data: ['{b|BH1}', 'BH2'] }, xAxis: { type: 'value' }, series: [{ type: 'bar', data: [10, 20] }] })!;
    expect(t.rows).toEqual([['BH1', 10], ['BH2', 20]]);
    expect(t.cols[1]).toBe('Value');
  });
  it('lines over time: one row per date across series', () => {
    const d = (s: string) => Date.parse(s + 'T00:00:00Z');
    const t = chartTable({ xAxis: { type: 'time' }, yAxis: { type: 'value' }, series: [{ name: 'Spent', type: 'line', data: [[d('2026-01-01'), 5], [d('2026-02-01'), 7]] }, { name: 'Plan', type: 'line', data: [[d('2026-02-01'), 6]] }] })!;
    expect(t.time).toBe(true);
    expect(t.rows).toEqual([['2026-01-01', 5, null], ['2026-02-01', 7, 6]]);
  });
  it('pie: one row per slice; charts without data give none', () => {
    expect(chartTable({ series: [{ type: 'pie', name: 'Share', data: [{ name: 'X', value: 1 }, { name: 'Y', value: 2 }] }] })!.rows).toEqual([['X', 1], ['Y', 2]]);
    expect(chartTable({ series: [{ type: 'bar', data: [] }] })).toBeNull();
    expect(chartTable({ series: [{ type: 'graph', data: [1] }] })).toBeNull();
  });
});
