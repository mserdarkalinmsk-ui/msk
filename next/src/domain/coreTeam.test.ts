import { describe, expect, it } from 'vitest';
import { countryPeople, coreDue, coreFromRows, onTeam, personKeyOf, sheetDate } from './coreTeam';

const T = new Date(Date.UTC(2026, 10, 19));
describe('core team', () => {
  it('warns on contracts ending as for providers, soonest first; no end date is no warning', () => {
    const D = coreDue([{ id: 'a', name: 'Alpha One', position: 'Head of office', end: '2027-06-30' }, { id: 'b', name: 'Beta Two', position: 'Driver', end: '2026-12-10' }, { id: 'c', name: 'Gamma Three', position: 'Assistant' }], T);
    expect(D.map((d) => [d.m.id, d.severity])).toEqual([['b', 'critical'], ['a', 'ok'], ['c', 'none']]);
  });
  it('is on the team between its start and its end', () => {
    expect(onTeam({ id: 'a', name: 'A', position: 'P', start: '2027-01-01' }, T)).toBe(false);
    expect(onTeam({ id: 'a', name: 'A', position: 'P', end: '2026-11-18' }, T)).toBe(false);
    expect(onTeam({ id: 'a', name: 'A', position: 'P', start: '2025-01-01', end: '2026-11-19' }, T)).toBe(true);
  });
  it('reads a core team list: the heading row found, dates in any spreadsheet form, the fund named', () => {
    const M = coreFromRows([['Office team 2026'], ['Name', 'Position', 'Grade', 'Start date', 'End date', 'Funded by'], ['Alpha, One', 'Head of Office', 'A3', '01/01/2025', '46387', 'Ordinary Budget'], ['Beta, Two', 'Driver', '', '2025-03-01', '', 'LS & Pagoda'], ['', '', '', '', '', '']]);
    expect(M.map((m) => [m.name, m.position, m.grade, m.start, m.end, m.fund])).toEqual([['Alpha, One', 'Head of Office', 'A3', '2025-01-01', '2026-12-31', 'ob'], ['Beta, Two', 'Driver', undefined, '2025-03-01', undefined, 'ls']]);
    expect(coreFromRows([['Amount', 'Line']])).toEqual([]);
    expect(sheetDate('31.12.2026')).toBe('2026-12-31');
  });
  it('lists each person once, core team and project contracts together, and flags a post paid twice', () => {
    expect(personKeyOf('ALPHA, Öne')).toBe(personKeyOf('One Alpha'));
    const prj = { id: 'p1', code: 'P1' };
    const L = countryPeople([{ id: 'c1', name: 'Alpha, One', position: 'Office assistant', fund: 'ob', end: '2027-01-31' }, { id: 'c2', name: 'Beta, Two', position: 'Driver', fund: 'project', project: 'p1', share: 50 }],
      [{ name: 'ALPHA,One', display: 'One ALPHA', position: 'Project assistant', end: '2026-12-31', status: 'Active', project: prj }, { name: 'BETA,Two', display: 'Two BETA', position: 'Driver', end: '2026-12-31', status: 'Active', project: prj }, { name: 'GAMMA,Three', display: 'Three GAMMA', position: 'Officer', end: '2027-06-30', status: 'Active', project: prj }], (p) => p.code);
    expect(L.map((x) => [x.name, x.roles.length, x.ends, !!x.check])).toEqual([['Alpha, One', 1, '2026-12-31', true], ['Beta, Two', 1, '2026-12-31', false], ['Three GAMMA', 1, '2027-06-30', false]]);
  });
  it('says why a person has no end date: the office post runs on, SxB staff carry no dates, else the dates are missing', () => {
    const prj = { id: 'p1', code: 'P1' };
    const L = countryPeople([{ id: 'c1', name: 'Alpha, One', position: 'Head of office', fund: 'ob' }],
      [{ name: 'BETA,Two', display: 'Two BETA', position: 'Expert', end: '', status: 'Dates missing', base: 'HQ', project: prj }, { name: 'GAMMA,Three', display: 'Three GAMMA', position: 'Officer', end: '', status: 'Dates missing', base: 'Local', project: prj }], (p) => p.code);
    expect(L.map((x) => x.noEnd)).toEqual(['open', 'missing', 'sxb']);
  });
});
