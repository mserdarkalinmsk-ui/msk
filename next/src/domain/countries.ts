/** Council of Europe member states (46) and frequent cooperation partners: name, ISO3, region. */
export const COUNTRY_LIST: { name: string; iso3: string; region: string; member: boolean }[] = [
  ...([
    ['Albania', 'ALB', 'South-East Europe'], ['Andorra', 'AND', 'Western Europe'], ['Armenia', 'ARM', 'Eastern Partnership'], ['Austria', 'AUT', 'Central Europe'],
    ['Azerbaijan', 'AZE', 'Eastern Partnership'], ['Belgium', 'BEL', 'Western Europe'], ['Bosnia and Herzegovina', 'BIH', 'South-East Europe'], ['Bulgaria', 'BGR', 'South-East Europe'],
    ['Croatia', 'HRV', 'South-East Europe'], ['Cyprus', 'CYP', 'Southern Europe'], ['Czechia', 'CZE', 'Central Europe'], ['Denmark', 'DNK', 'Northern Europe'],
    ['Estonia', 'EST', 'Northern Europe'], ['Finland', 'FIN', 'Northern Europe'], ['France', 'FRA', 'Western Europe'], ['Georgia', 'GEO', 'Eastern Partnership'],
    ['Germany', 'DEU', 'Central Europe'], ['Greece', 'GRC', 'Southern Europe'], ['Hungary', 'HUN', 'Central Europe'], ['Iceland', 'ISL', 'Northern Europe'],
    ['Ireland', 'IRL', 'Western Europe'], ['Italy', 'ITA', 'Southern Europe'], ['Latvia', 'LVA', 'Northern Europe'], ['Liechtenstein', 'LIE', 'Central Europe'],
    ['Lithuania', 'LTU', 'Northern Europe'], ['Luxembourg', 'LUX', 'Western Europe'], ['Malta', 'MLT', 'Southern Europe'], ['Republic of Moldova', 'MDA', 'Eastern Partnership'],
    ['Monaco', 'MCO', 'Western Europe'], ['Montenegro', 'MNE', 'South-East Europe'], ['Netherlands', 'NLD', 'Western Europe'], ['North Macedonia', 'MKD', 'South-East Europe'],
    ['Norway', 'NOR', 'Northern Europe'], ['Poland', 'POL', 'Central Europe'], ['Portugal', 'PRT', 'Southern Europe'], ['Romania', 'ROU', 'South-East Europe'],
    ['San Marino', 'SMR', 'Southern Europe'], ['Serbia', 'SRB', 'South-East Europe'], ['Slovak Republic', 'SVK', 'Central Europe'], ['Slovenia', 'SVN', 'Central Europe'],
    ['Spain', 'ESP', 'Southern Europe'], ['Sweden', 'SWE', 'Northern Europe'], ['Switzerland', 'CHE', 'Central Europe'], ['Türkiye', 'TUR', 'South-East Europe'],
    ['Ukraine', 'UKR', 'Eastern Partnership'], ['United Kingdom', 'GBR', 'Western Europe'],
  ] as const).map(([name, iso3, region]) => ({ name, iso3, region, member: true })),
  ...([
    ['Kosovo*', 'XKX', 'South-East Europe'], ['Belarus', 'BLR', 'Eastern Partnership'], ['Morocco', 'MAR', 'Southern Neighbourhood'], ['Tunisia', 'TUN', 'Southern Neighbourhood'],
    ['Jordan', 'JOR', 'Southern Neighbourhood'], ['Lebanon', 'LBN', 'Southern Neighbourhood'], ['Kazakhstan', 'KAZ', 'Central Asia'], ['Kyrgyzstan', 'KGZ', 'Central Asia'],
    ['Uzbekistan', 'UZB', 'Central Asia'], ['Tajikistan', 'TJK', 'Central Asia'], ['Turkmenistan', 'TKM', 'Central Asia'],
  ] as const).map(([name, iso3, region]) => ({ name, iso3, region, member: false })),
];
export const countryInfo = (name: string) => { const t = name.trim().toLowerCase(); return COUNTRY_LIST.find((c) => c.name.toLowerCase() === t || c.iso3.toLowerCase() === t || (t === 'turkey' && c.iso3 === 'TUR') || (t === 'moldova' && c.iso3 === 'MDA')); };
