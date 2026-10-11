/** Approximate country centroids [lon, lat] for Europe and neighbouring regions (ISO 3166-1 alpha-3). */
export const CENTROIDS: Record<string, [number, number, string]> = {
  ALB: [20.0, 41.1, 'Albania'], AND: [1.6, 42.5, 'Andorra'], ARM: [44.9, 40.2, 'Armenia'], AUT: [14.6, 47.6, 'Austria'], AZE: [47.6, 40.3, 'Azerbaijan'],
  BEL: [4.6, 50.6, 'Belgium'], BGR: [25.2, 42.7, 'Bulgaria'], BIH: [17.8, 44.2, 'Bosnia and Herzegovina'], BLR: [28.0, 53.5, 'Belarus'], CHE: [8.2, 46.8, 'Switzerland'],
  CYP: [33.2, 35.0, 'Cyprus'], CZE: [15.3, 49.8, 'Czechia'], DEU: [10.4, 51.1, 'Germany'], DNK: [9.3, 56.0, 'Denmark'], ESP: [-3.6, 40.2, 'Spain'],
  EST: [25.5, 58.7, 'Estonia'], FIN: [26.0, 64.5, 'Finland'], FRA: [2.4, 46.6, 'France'], GBR: [-2.0, 53.5, 'United Kingdom'], GEO: [43.4, 42.2, 'Georgia'],
  GRC: [22.6, 39.3, 'Greece'], HRV: [16.4, 45.1, 'Croatia'], HUN: [19.4, 47.2, 'Hungary'], IRL: [-8.1, 53.2, 'Ireland'], ISL: [-18.6, 64.9, 'Iceland'],
  ITA: [12.6, 42.8, 'Italy'], KAZ: [67.0, 48.0, 'Kazakhstan'], KGZ: [74.6, 41.5, 'Kyrgyzstan'], LIE: [9.6, 47.2, 'Liechtenstein'], LTU: [23.9, 55.3, 'Lithuania'],
  LUX: [6.1, 49.8, 'Luxembourg'], LVA: [24.9, 56.9, 'Latvia'], MCO: [7.4, 43.7, 'Monaco'], MDA: [28.5, 47.2, 'Moldova'], MKD: [21.7, 41.6, 'North Macedonia'],
  MLT: [14.4, 35.9, 'Malta'], MNE: [19.3, 42.8, 'Montenegro'], NLD: [5.6, 52.2, 'Netherlands'], NOR: [9.0, 61.0, 'Norway'], POL: [19.4, 52.1, 'Poland'],
  PRT: [-8.0, 39.6, 'Portugal'], ROU: [24.9, 45.9, 'Romania'], RUS: [40.0, 56.0, 'Russia'], SMR: [12.5, 43.9, 'San Marino'], SRB: [20.8, 44.2, 'Serbia'],
  SVK: [19.5, 48.7, 'Slovakia'], SVN: [14.8, 46.1, 'Slovenia'], SWE: [15.5, 62.0, 'Sweden'], TUR: [35.2, 39.0, 'Türkiye'], UKR: [31.2, 49.0, 'Ukraine'],
  XKX: [20.9, 42.6, 'Kosovo'], MAR: [-6.3, 31.8, 'Morocco'], TUN: [9.5, 34.0, 'Tunisia'], DZA: [2.6, 32.0, 'Algeria'], EGY: [30.8, 26.8, 'Egypt'],
  JOR: [36.2, 31.2, 'Jordan'], LBN: [35.9, 33.9, 'Lebanon'], ISR: [34.9, 31.4, 'Israel'], PSE: [35.2, 31.9, 'Palestine'], LBY: [17.2, 27.0, 'Libya'],
  UZB: [64.6, 41.4, 'Uzbekistan'], TJK: [71.3, 38.9, 'Tajikistan'], TKM: [59.6, 39.0, 'Turkmenistan'], MNG: [103.8, 46.9, 'Mongolia'], IRQ: [43.7, 33.2, 'Iraq'],
};
const byName = new Map(Object.entries(CENTROIDS).map(([k, v]) => [v[2].toLowerCase(), k]));
/** Resolves a country to ISO3 from its iso3 field or its name. */
export function iso3Of(c: { iso3?: string; name: string }): string | undefined {
  const k = c.iso3?.toUpperCase();
  if (k && CENTROIDS[k]) return k;
  return byName.get(c.name.toLowerCase()) ?? (c.name.toLowerCase() === 'turkey' ? 'TUR' : undefined);
}
