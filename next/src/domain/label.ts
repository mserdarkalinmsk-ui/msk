/** How a project is named in lists, tables and charts: its BH number; a code that carries a number; else the PMM or JP
 * number (a project entered with a bare code such as "BH" before its budget head was known). */
export const plabel = (p: { bh?: string | null; code: string; pmm?: string | null; jp?: string | null }) =>
  p.bh ? `BH ${p.bh}` : /\d/.test(p.code) ? p.code : p.pmm ? `PMM ${p.pmm}` : p.jp ? `JP ${p.jp}` : p.code;
