/**
 * Co-ordinating Committee on Remuneration (CCR): annual adjustment of salaries of the Co-ordinated Organisations at
 * 1 January 2027 — 362nd report, CM(2026)136 (Ministers' Deputies, 1573rd meeting, 21 October 2026), Annexes 1 and 1a.
 * Kept for the member States of the Council of Europe only (the CCR also covers non-member countries).
 * Index 100 = no change; applied to the salary scale in force at 31 December 2026.
 */
export const CCR_SOURCE = 'CM(2026)136 — CCR 362nd report, annual adjustment at 1 January 2027';
export interface CcrIndex { country: string; iso3: string; cpi: number; ppp?: number; index: number; /** special and extraordinary adjustments already granted in the reference period (01.07.2025–01.07.2026) */ special?: number; /** what is applied at 1 January once the special adjustments are deducted */ net: number }
export const CCR_2027: CcrIndex[] = [
  ['Austria', 'AUT', 103.2, undefined, 103.2], ['Belgium', 'BEL', 103.3, undefined, 103.3], ['Denmark', 'DNK', 101.8, undefined, 101.8],
  ['Estonia', 'EST', 102.0, -2.7, 99.2], ['Finland', 'FIN', 102.7, -0.5, 102.2], ['France', 'FRA', 102.0, undefined, 102.0], ['Germany', 'DEU', 102.4, undefined, 102.4],
  ['Greece', 'GRC', 103.9, undefined, 103.9], ['Hungary', 'HUN', 102.1, -1.3, 100.8], ['Iceland', 'ISL', 105.1, undefined, 105.1], ['Ireland', 'IRL', 103.2, undefined, 103.2],
  ['Italy', 'ITA', 103.0, undefined, 103.0], ['Latvia', 'LVA', 103.3, -2.1, 101.1], ['Lithuania', 'LTU', 105.4, -1.4, 103.9], ['Luxembourg', 'LUX', 103.7, undefined, 103.7],
  ['Netherlands', 'NLD', 102.5, undefined, 102.5], ['Norway', 'NOR', 102.6, 0.2, 102.8], ['Poland', 'POL', 103.0, undefined, 103.0], ['Portugal', 'PRT', 103.1, undefined, 103.1],
  ['Spain', 'ESP', 103.6, undefined, 103.6], ['Sweden', 'SWE', 101.0, undefined, 101.0], ['Switzerland', 'CHE', 100.7, undefined, 100.7],
  ['Türkiye', 'TUR', 132.1, 2.0, 134.8, 122.5], ['United Kingdom', 'GBR', 102.6, -0.2, 102.4],
].map(([country, iso3, cpi, ppp, index, special]) => {
  const ix = index as number, sp = special as number | undefined;
  // Türkiye: 134.8 ÷ 122.5 = 110.0 (rounded) — the special adjustments of 1 Oct 2025, 1 Feb 2026 and 1 May 2026 are deducted.
  return { country: country as string, iso3: iso3 as string, cpi: cpi as number, ppp: ppp as number | undefined, index: ix, special: sp, net: sp ? Math.round((ix / sp) * 1000) / 10 : ix };
});
export const ccrOf = (iso3?: string, name?: string) => CCR_2027.find((c) => (iso3 && c.iso3 === iso3.toUpperCase()) || (name && c.country.toLowerCase() === name.toLowerCase()) || (name && /t[üu]rkiye|turkey/i.test(name) && c.iso3 === 'TUR'));

/** Salary adjustments already decided for Türkiye, by month: they replace what the CPI rule would project for that month. */
export const OFFICIAL_TR: Record<string, { pct: number; ref: string }> = {
  '2027-01': { pct: Math.round((CCR_2027.find((c) => c.iso3 === 'TUR')!.net - 100) * 10) / 10, ref: `${CCR_SOURCE}: index 134.8 less the special adjustments granted (122.5)` },
};
