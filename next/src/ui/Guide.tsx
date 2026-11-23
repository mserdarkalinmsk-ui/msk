import { go, set } from '../data/store';
import { X } from './CloseX';

/* The month in five steps, where things are, and what changed in the app. The list of changes is written by hand with
   each release; the newest entry first. A dot on the menu marks a release not yet opened. */
export const NEWS: { id: string; date: string; items: string[] }[] = [
  { id: '2026-11-23c', date: '23 Nov 2026 (evening)', items: [
    'Scanned contracts are read too: drop the signed PDF; its pages are read in this browser (the reader is downloaded once from the internet; the document never leaves the computer). Check each figure before saving.',
    'Core team in one table: a missing end date or fund is typed in its own row.',
  ] },
  { id: '2026-11-23b', date: '23 Nov 2026 (later)', items: [
    'Calendar by week, month, year or as a list, under each country and in Reports; items of one kind on one day are one entry; the overdue ones gathered at the top of the list.',
    'Everyone: who the people are in one bar, and compact person cards; project staff counted once, with no repeated or misleading figure.',
    'Event management is only for event companies; each provider’s kind can be changed from the list.',
  ] },
  { id: '2026-11-23', date: '23 Nov 2026', items: [
    'Country page in six tabs: Overview · Projects (with By budget line) · Office (budget and services) · People · Contracts & suppliers · Calendar.',
    'Contracts read from their PDF or Word: drop the contract on the form; its reference, provider, end, renewal limit and total are filled in.',
    'Search reaches providers, contracts and people; each has a card with everything about them.',
    'Core team: only the head of office and of operations run open-ended; the posts missing an end date or a fund are listed to complete in place.',
    'The salary scale can be replaced by loading the newer CCR document.',
    'Keep your data safe: the backup in three steps, from the backup status in the menu.',
  ] },
  { id: '2026-11-20', date: '20 Nov 2026', items: [
    'Everyone in a country as person cards, grouped by project, by contract end or A–Z.',
    'Staff lines: months needed to the end counted at the share the line funds.',
    'Contracts: renewable-until date, monthly fee and total for the period.',
  ] },
];
const SEEN = 'pl-news-seen';
export const newsUnseen = () => { try { return localStorage.getItem(SEEN) !== NEWS[0].id; } catch { return false; } };

const STEPS: [string, string, string, string][] = [
  ['Load', 'The month’s report workbooks and the office situation: drop them on Import.', 'Import', 'import'],
  ['Check', 'Orders that look wrong against their budget line, and data that does not add up.', 'Data checks', 'reports/health'],
  ['Decide', 'Alerts, contracts and staff contracts ending, addenda to prepare.', 'Alert centre', 'reports/alerts'],
  ['Close', 'Lock the month: what changes later is shown as such.', 'Monthly close', 'reports/close'],
  ['Share', 'The monthly pack, the presentation, the project reports.', 'Monthly pack', 'reports/pack'],
];

export function GuidePanel({ close }: { close: () => void }) {
  try { localStorage.setItem(SEEN, NEWS[0].id); } catch { /* shown again next time */ }
  const to = (r: string) => { close(); if (r === 'import') set({ drawer: { kind: 'import' } }); else go(r); };
  return <>
    <div class="drawer-h"><div><h2>Guide &amp; what’s new</h2><p class="muted">The month in five steps, where things are, and the latest changes</p></div><X close={close} /></div>
    <div class="drawer-b gd">
      <h3>Your month in five steps</h3>
      <ol class="gd-steps">{STEPS.map(([t, d, l, r], i) => <li><i>{i + 1}</i><div><b>{t}</b><span>{d}</span></div><button class="linkish" onClick={() => to(r)}>{l} ›</button></li>)}</ol>
      <h3>Where things are</h3>
      <dl class="gd-map">
        <dt>Overview</dt><dd>The whole portfolio: totals, spending over time, budget health, what needs attention.</dd>
        <dt>Countries</dt><dd>One country at a time: its projects, office budget, people, contracts and suppliers, calendar.</dd>
        <dt>A project</dt><dd>Open it from its country or from the search: summary, finance, PO review, plan, staff, documents.</dd>
        <dt>Reports</dt><dd>The month (close, what changed, alerts), the outputs (pack, presentation, project report) and the analyses.</dd>
        <dt>Search · Ctrl K</dt><dd>Projects, providers, people, POs, contracts, budget lines and pages.</dd>
      </dl>
      <h3>What’s new</h3>
      {NEWS.map((n) => <section class="gd-news"><b>{n.date}</b><ul>{n.items.map((x) => <li>{x}</li>)}</ul></section>)}
    </div></>;
}
