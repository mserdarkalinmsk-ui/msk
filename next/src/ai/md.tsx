/* A small Markdown reader for the assistant's answers: paragraphs, headings, bold / italic / code, bullet and numbered
   lists and pipe tables. It builds elements, never HTML strings, so nothing in an answer can run as markup. */
import type { ComponentChildren } from 'preact';

function inline(t: string): ComponentChildren[] {
  const out: ComponentChildren[] = []; const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g; let i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m.index > i) out.push(t.slice(i, m.index));
    const s = m[0];
    out.push(s.startsWith('**') ? <b>{s.slice(2, -2)}</b> : s.startsWith('`') ? <code>{s.slice(1, -1)}</code> : <i>{s.slice(1, -1)}</i>);
    i = m.index + s.length;
  }
  if (i < t.length) out.push(t.slice(i));
  return out;
}
const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isNum = (c: string) => /^[−\-+(]?[€$]?\s?[−\-]?[\d.,\s]+%?\)?$/.test(c) && /\d/.test(c);

export function Markdown({ text }: { text: string }) {
  const L = text.replace(/\r/g, '').split('\n'); const out: ComponentChildren[] = []; let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    if (/^#{1,4}\s/.test(l)) { out.push(<h4>{inline(l.replace(/^#+\s*/, ''))}</h4>); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < L.length && /^\s*\|?\s*:?-{2,}/.test(L[i + 1])) {
      const head = cells(l); i += 2; const rows: string[][] = [];
      while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) rows.push(cells(L[i++]));
      const num = head.map((_, k) => rows.length > 0 && rows.every((r) => !r[k] || isNum(r[k])));
      out.push(<div class="ai-tw"><table class="mini"><thead><tr>{head.map((h, k) => <th class={num[k] ? 'tnum' : ''}>{inline(h)}</th>)}</tr></thead><tbody>{rows.map((r) => <tr>{head.map((_, k) => <td class={num[k] ? 'tnum' : ''}>{inline(r[k] ?? '')}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const ordered = /^\s*\d+[.)]/.test(l), items: string[] = [];
      while (i < L.length && /^\s*([-*•]|\d+[.)])\s+/.test(L[i])) items.push(L[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
      out.push(ordered ? <ol>{items.map((x) => <li>{inline(x)}</li>)}</ol> : <ul>{items.map((x) => <li>{inline(x)}</li>)}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < L.length && L[i].trim() && !/^#{1,4}\s/.test(L[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(L[i]) && !/^\s*\|.*\|\s*$/.test(L[i])) para.push(L[i++]);
    out.push(<p>{para.flatMap((x, k) => (k ? [<br />, ...inline(x)] : inline(x)))}</p>);
  }
  return <div class="ai-md">{out}</div>;
}
