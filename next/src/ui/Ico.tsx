/** One line-icon set for every button and tile (24-unit grid, 1.8 stroke, current colour) — in place of text symbols. */
const P: Record<string, string> = {
  download: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14',
  upload: 'M12 20V9m0 0-4.5 4.5M12 9l4.5 4.5M5 4h14',
  print: 'M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  attach: 'M20 11.5 12.4 19a5 5 0 0 1-7.1-7.1l8.1-8.1a3.4 3.4 0 0 1 4.8 4.8l-8.1 8.1a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  swap: 'M7 7h12m0 0-3-3m3 3-3 3M17 17H5m0 0 3 3m-3-3 3-3',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  euro: 'M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10h9M4 14h9',
  cycle: 'M20 12a8 8 0 0 1-14.5 4.6M4 12a8 8 0 0 1 14.5-4.6M18 3v4.5h-4.5M6 21v-4.5h4.5',
  reports: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  people: 'M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19a3.5 3.5 0 0 0-3-3.4M4 19a3.5 3.5 0 0 1 3-3.4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
};
export type IcoName = keyof typeof P;
export function Ico({ n, size = 15 }: { n: IcoName; size?: number }) {
  return <svg class="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={P[n]} /></svg>;
}
