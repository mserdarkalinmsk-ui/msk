import type { ComponentChildren } from 'preact';
import { go, set, toast, useStore } from '../data/store';
import { trace, traceLine, type Figure, type LineField, type Trace, type Unit } from '../domain/provenance';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { X } from './CloseX';
import { date, full } from './format';
import { plabel } from '../domain/label';

const nf2 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const show = (v: number, u: Unit = 'eur') => (u === 'eur' ? full(v) : u === 'pct' ? `${v < -0.0005 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}%` : u === 'pp' ? `${v < -0.0005 ? '−' : v > 0.0005 ? '+' : ''}${Math.abs(v * 100).toFixed(1)} points` : u === 'months' ? `${v.toFixed(1)} months` : nf2.format(v));
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * A figure that explains itself: click it to see the rule, the amounts behind it and the file they were read from.
 * `line` + `field` explain a budget-line cell; otherwise `f` names a project figure.
 */
export function Fig({ p, f, line, field, children }: { p: Project; f?: Figure; line?: string; field?: LineField; children: ComponentChildren }) {
  return <button type="button" class="fig" title="Where this figure comes from" onClick={(e) => { e.stopPropagation(); set({ drawer: { kind: 'trace', projectId: p.id, figure: f, line, field } }); }}>{children}</button>;
}

/** The trace as plain text, to paste into an e-mail or a note to the file. */
function asText(p: Project, t: Trace): string {
  const L = [`${p.code}${p.bh ? ` (BH ${p.bh})` : ''} — ${t.title}: ${show(t.value, t.unit)}`, t.how, ''];
  for (const x of t.terms) L.push(`${x.op ?? ' '} ${x.label}: ${show(x.value, x.unit)}${x.note ? ` (${x.note})` : ''}`);
  L.push('', ...t.sources.map((s) => `${s.label}: ${isDay(s.value) ? date(s.value) : s.value}`));
  if (t.parts) L.push('', t.parts.title + ':', ...t.parts.rows.map((r) => `  ${r.code} ${r.label}: ${show(r.value, t.unit)}`));
  if (t.notes.length) L.push('', ...t.notes.map((n) => `Note: ${n}`));
  return L.join('\n');
}

export function TracePanel({ projectId, figure, line, field, close }: { projectId: string; figure?: Figure; line?: string; field?: LineField; close: () => void }) {
  const p = useStore((s) => s.ledger.projects.find((x) => x.id === projectId));
  const t = p ? (line ? traceLine(p, line, field ?? 'actual') : trace(p, figure ?? 'spent', TODAY)) : null;
  if (!p || !t) return <><div class="drawer-h"><h2>Where this figure comes from</h2><X close={close} /></div><div class="drawer-b"><p class="muted">This figure is no longer on file.</p></div></>;
  const max = Math.max(1, ...(t.parts?.rows ?? []).map((r) => Math.abs(r.value)));
  const copy = async () => { try { await navigator.clipboard.writeText(asText(p, t)); toast('Copied — paste it into your e-mail or note'); } catch { toast('Copying is not available in this view'); } };
  return (
    <>
      <div class="drawer-h"><h2>Where this figure comes from</h2><X close={close} /></div>
      <div class="drawer-b tr">
        <section class="tr-hero">
          <span class="tr-p">{plabel(p)} · {p.name}</span>
          <span class="tr-t">{t.title}</span>
          <span class="tr-v num">{show(t.value, t.unit)}</span>
          <p>{t.how}</p>
        </section>

        <section>
          <h3>How it is calculated</h3>
          <ol class="tr-terms">{t.terms.map((x) => (
            <li class={x.op === '=' ? 'eq' : ''}><span class="tr-op">{x.op ?? ''}</span><span class="tr-l">{x.label}{x.note && <small>{x.note}</small>}</span><b class="num">{show(x.value, x.unit)}</b></li>))}</ol>
        </section>

        <section>
          <h3>Source</h3>
          <dl class="tr-src">{t.sources.map((s) => <><dt>{s.label}</dt><dd>{isDay(s.value) ? date(s.value) : s.value}</dd></>)}</dl>
        </section>

        {t.parts && t.parts.rows.length > 0 && <section>
          <h3>{t.parts.title}</h3>
          <ul class="tr-parts">{t.parts.rows.map((r) => (
            <li><span class="tr-c num">{r.code}</span><span class="tr-n" title={r.label}>{r.label}</span>
              <span class="tr-bar"><i class={r.value < 0 ? 'neg' : ''} style={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%` }} /></span>
              <b class="num">{show(r.value, t.unit)}</b></li>))}</ul>
        </section>}

        {t.postings && <section>
          <h3>{t.postings.title} <span class="muted">· {t.postings.rows.length < t.postings.count ? `${t.postings.rows.length} of ${t.postings.count}` : t.postings.count} · {full(t.postings.total)} in all</span></h3>
          <div class="tr-scroll"><table class="mini tr-post">
            <thead><tr><th>Date</th><th>Document</th><th>Supplier / description</th><th class="r">Amount</th></tr></thead>
            <tbody>{t.postings.rows.map((r) => <tr><td class="num">{isDay(r.date) ? date(r.date) : r.date || '—'}</td><td class="num">{r.ref || '—'}</td><td><b>{r.who || '—'}</b>{r.text && <small>{r.text}</small>}</td><td class="r num">{full(r.amount)}</td></tr>)}</tbody>
          </table></div>
        </section>}

        {t.notes.length > 0 && <section>
          <h3>To know before quoting it</h3>
          <ul class="tr-notes">{t.notes.map((n) => <li>{n}</li>)}</ul>
        </section>}
      </div>
      <div class="drawer-f">
        <button class="btn" onClick={() => void copy()}>Copy as text</button>
        <button class="btn" onClick={() => { close(); go(`project/${p.id}/${line ? 'statement' : 'finance'}`); }}>Open the report →</button>
      </div>
    </>
  );
}
