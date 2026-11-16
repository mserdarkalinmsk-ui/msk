/* Headline tiles on every page carry an icon that says what the figure is about. Pages keep writing a plain label;
   this pass reads it and sets data-ico, which the stylesheet turns into the icon chip. A label that already holds
   its own icon (.sc-ico) is left alone. */
const RULES: [RegExp, string][] = [
  [/uncommitted|balance|unused|left|available|remain|free|leftover/, 'coins'],
  [/staff|people|person|fte|within contract|position|headcount/, 'users'],
  [/pace|time|day|month|week|due|ending|deadline|age|late|overdue/, 'clock'],
  [/alert|over|flag|risk|blocked|error|issue|gap|short|check|warning|attention/, 'alert'],
  [/clean|done|ok\b|closed|complete|on track/, 'check'],
  [/spent|used|burn|spend|actual|expend|consum/, 'trend'],
  [/commit|po\b|pos\b|purchase|order|invoice/, 'receipt'],
  [/budget|approved|total|amount|fund|grant|value|cost/, 'wallet'],
  [/report|file|document|record|confirm|extraction|workbook|letter/, 'file'],
  [/project|portfolio|programme/, 'folder'],
  [/countr|office|region/, 'building'],
];

export function iconFor(label: string) {
  const t = label.toLowerCase();
  return RULES.find(([r]) => r.test(t))?.[1] ?? 'chart';
}

/** A figure that says nothing yet: zero, a dash, empty. */
const EMPTY = /^[\s€$]*(0([.,]0+)?\s*(%|pp|[KM])?|—|–|-)?\s*$/;

export function tileIcons(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(':is(.hero, .ph-tiles) > .kpi').forEach((k) => {
    const v = k.querySelector('.value'), empty = !!v && EMPTY.test(v.textContent ?? '');
    if (empty !== k.hasAttribute('data-empty')) { if (empty) k.setAttribute('data-empty', ''); else k.removeAttribute('data-empty'); }
  });
  root.querySelectorAll<HTMLElement>(':is(.hero, .ph-tiles) > .kpi > .label').forEach((l) => {
    if (l.querySelector('.sc-ico')) { if (l.dataset.ico) delete l.dataset.ico; return; }
    const ico = iconFor(l.textContent ?? '');
    if (l.dataset.ico !== ico) l.dataset.ico = ico;
  });
}
