import { checkDraft, type Draft } from './Drawer';
import { readOfficeFile } from './officeImport';

import { backupNow } from './Backup';

import { useEffect, useState } from 'preact/hooks';
import { go, replaceLedger, resetDemo, restorePoints, set, upsertOfficeReport, useStore } from '../data/store';
import { validateLedger } from '../domain/calc';
import { normalizeSector, validUrl, type Ledger } from '../domain/types';

import { parseAmount, parseCSV, parseDay } from './csv';
import { short } from './format';
import { readCoe, readTable } from './ReportImport';
import { migrateBackup } from '../domain/insights';

import { X } from './CloseX';

const FIELDS = [
  { key: 'code', label: 'Code', req: true, alias: ['code', 'project code', 'id', 'kod'] },
  { key: 'name', label: 'Name', req: true, alias: ['name', 'project', 'title', 'project name', 'ad'] },
  { key: 'country', label: 'Country', req: true, alias: ['country', 'ülke', 'ulke'] },
  { key: 'budget', label: 'Budget', req: true, alias: ['budget', 'total', 'bütçe', 'butce', 'amount'] },
  { key: 'start', label: 'Start', req: true, alias: ['start', 'start date', 'başlangıç', 'from'] },
  { key: 'end', label: 'End', req: true, alias: ['end', 'end date', 'bitiş', 'to'] },
  { key: 'sector', label: 'Sector', req: true, alias: ['sector', 'sektör', 'theme'] },
  { key: 'funding', label: 'Funding', req: false, alias: ['funding', 'donor', 'source'] },
  { key: 'pmm', label: 'PMM number', req: false, alias: ['pmm', 'pmm no', 'pmm number', 'pmm id', 'pmm no.'] },
  { key: 'bh', label: 'Budget head', req: false, alias: ['bh', 'budget head', 'budgethead'] },
  { key: 'ccm', label: 'CCM', req: false, alias: ['ccm', 'cost centre', 'cost center'] },
  { key: 'mae', label: 'MAE / division', req: false, alias: ['mae', 'division', 'directorate'] },
  { key: 'pmmUrl', label: 'PMM link', req: false, alias: ['pmm link', 'pmm url', 'link', 'url', 'pmmurl'] },
] as const

export function ImportPanel({ close }: { close: () => void }) {
  const ledger = useStore((s) => s.ledger);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [json, setJson] = useState<{ data: Ledger; errs: string[]; from: string } | null>(null);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  async function readMany(files: File[]) {
    // Documents or several workbooks: recognise each file and route it to its project.
    if (files.some((f) => /\.(pdf|docx)$/i.test(f.name)) || (files.length > 1 && files.every((f) => /\.(xls[xm]|pdf|docx|txt)$/i.test(f.name)))) { set({ drawer: { kind: 'smart-import', files } }); return; }
    if (files.length > 1) { setErr('Drop one project list or backup file at a time.'); return; }
    return read(files[0]);
  }

  async function read(file: File) {
    setErr(''); setRows(null); setJson(null);
    setBusy(`Reading ${file.name}…`);
    // An office running-cost budget (Ordinary Budget, BH 0127) goes to the Offices page, not to a project.
    const off = await readOfficeFile(file).catch(() => null);
    if (off) { setBusy(''); upsertOfficeReport(off); close(); go('offices'); return; }
    const wb = await readCoe(file).catch(() => null);
    setBusy('');
    if (wb) { set({ drawer: { kind: 'smart-import', files: [file] } }); return; }
    const text = await file.text();
    if (/\.json$/i.test(file.name) || text.trim().startsWith('{')) {
      try { const { ledger: data, from } = migrateBackup(JSON.parse(text)); setJson({ data: data as Ledger, errs: validateLedger(data), from }); } catch { setErr('This file is not valid JSON.'); }
      return;
    }
    let R: string[][];
    try { R = /\.xlsx?$/i.test(file.name) ? (await readTable(file)).rows : parseCSV(text); } catch (e) { setErr((e as Error).message); return; }
    if (R.length < 2) { setErr('The CSV needs a header row and at least one data row.'); return; }
    const head = R[0].map((h) => h.trim().toLowerCase());
    const m: Record<string, number> = {};
    for (const f of FIELDS) { const i = head.findIndex((h) => (f.alias as readonly string[]).includes(h)); if (i >= 0) m[f.key] = i; }
    setMap(m); setRows(R);
  }

  const countryId = (v: string) => {
    const t = v.trim().toLowerCase();
    return ledger.countries.find((c) => c.id === t || c.name.toLowerCase() === t || c.iso3?.toLowerCase() === t)?.id;
  };
  const parsed = rows?.slice(1).map((r, i) => {
    const g = (k: string) => (map[k] != null ? (r[map[k]] ?? '').trim() : '');
    const existing = ledger.projects.find((p) => p.code.toLowerCase() === g('code').toLowerCase());
    // Columns missing from the file keep the existing project's values.
    const keep = (k: string, v: string) => (map[k] == null && existing ? String((existing as unknown as Record<string, unknown>)[k] ?? '') : v);
    const d: Draft = {
      code: g('code'), name: keep('name', g('name')), country: keep('country', countryId(g('country')) ?? ''), sector: keep('sector', normalizeSector(g('sector')) ?? ''),
      funding: keep('funding', g('funding')), start: keep('start', parseDay(g('start')) ?? g('start')), end: keep('end', parseDay(g('end')) ?? g('end')),
      budget: keep('budget', g('budget')), status: existing?.status ?? 'Active',
      mae: keep('mae', g('mae')), pmm: keep('pmm', g('pmm')), bh: keep('bh', g('bh')), ccm: keep('ccm', g('ccm')), pmmUrl: keep('pmmUrl', g('pmmUrl')),
    };
    const e = checkDraft(d, ledger.projects, existing?.id);
    if (g('country') && !d.country) e.country = `Unknown country “${g('country')}” (add it under Manage countries)`;
    if (g('sector') && !d.sector) e.sector = `Unknown sector “${g('sector')}”`;
    return { line: i + 2, d, e, existing };
  }) ?? [];
  const good = parsed.filter((x) => !Object.keys(x.e).length);
  const dupInFile = new Set<string>();
  const importable = good.filter((x) => { const k = x.d.code.toLowerCase(); if (dupInFile.has(k)) return false; dupInFile.add(k); return true; });

  const exportJSON = () => {
    void backupNow();
  };

  return (
    <>
      <div class="drawer-h"><h2>Import & backup</h2><X close={close} /></div>
      <div class="drawer-b">
        <label class={`drop ${over ? 'on' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const F = [...(e.dataTransfer?.files ?? [])]; if (F.length) readMany(F); }}>
          <input type="file" multiple accept=".csv,.xlsx,.xlsm,.json,.pdf,.docx,text/csv,application/json" hidden onChange={(e) => { const F = [...((e.target as HTMLInputElement).files ?? [])]; if (F.length) readMany(F); }} />
          <strong style={{ color: 'var(--ink)' }}>Drop anything: reports, budgets, DoA, contracts, a project list or a JSON backup</strong><br />Several files at once are recognised one by one and sent to their projects (by BH, JP, PMM or contract number).
        </label>
        <label class="btn" style={{ justifySelf: 'start' }}>📁 Choose a whole folder<input type="file" hidden multiple {...{ webkitdirectory: '' }} onChange={(e) => { const F = [...((e.target as HTMLInputElement).files ?? [])]; (e.target as HTMLInputElement).value = ''; if (F.length) set({ drawer: { kind: 'smart-import', files: F } }); }} /></label>
        {err && <ul class="errlist"><li>{err}</li></ul>}

        {busy && <div class="muted" role="status" style={{ fontSize: '13px' }}><span class="spin" /> {busy}</div>}
        {json && (
          <section class="card card-b">
            <h3 style={{ margin: '0 0 8px', fontSize: '14px' }}>{json.from === 'previous app' ? 'Backup from the previous Portfolio Ledger' : 'Backup file'}</h3>
            <p class="muted" style={{ margin: 0 }}>{json.data.projects?.length ?? 0} projects · {json.data.countries?.length ?? 0} countries. {json.data.audit?.length ? ` · ${json.data.audit.length} history entries` : ''}. Importing replaces the current data (you can undo).</p>
            {json.errs.length > 0 && <ul class="errlist" style={{ marginTop: '12px' }}>{json.errs.slice(0, 8).map((e) => <li>{e}</li>)}</ul>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button class="btn primary" disabled={json.errs.length > 0} onClick={() => { replaceLedger(json.data, `Imported ${json.data.projects.length} projects`); close(); }}>Replace data</button>
            </div>
          </section>
        )}

        {rows && (
          <>
            <section class="card card-b" style={{ display: 'grid', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '14px' }}>Match columns</h3>
              <div class="form-2" style={{ gap: '10px' }}>
                {FIELDS.map((f) => (
                  <div class="field"><label>{f.label}{f.req && ' *'}</label>
                    <select value={map[f.key] ?? ''} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; const m = { ...map }; if (v === '') delete m[f.key]; else m[f.key] = +v; setMap(m); }}>
                      <option value="">— not in file —</option>
                      {rows[0].map((h, i) => <option value={i}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </section>
            <section class="card">
              <div class="card-h"><div><h2>Preview</h2><p>{importable.filter((x) => !x.existing).length} new · {importable.filter((x) => x.existing).length} updates · {parsed.length - importable.length} with problems</p></div></div>
              <ul class="att" style={{ marginTop: '8px', maxHeight: '280px', overflow: 'auto' }}>
                {parsed.slice(0, 200).map((x) => {
                  const bad = Object.entries(x.e);
                  return (
                    <li style={{ cursor: 'default' }}>
                      <span class={`badge ${bad.length ? 'critical' : 'good'}`}>Row {x.line}</span>
                      <div><div class="t">{x.d.code || '—'} · {x.d.name || '—'} {x.existing && !bad.length && <span class="badge neutral count">update</span>}</div>
                        <div class="d">{bad.length ? bad.map(([k, v]) => `${k}: ${v}`).join(' · ') : `${short(parseAmount(x.d.budget) ?? 0)} · ${x.d.start} → ${x.d.end}`}</div></div><span />
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}

        <section class="card card-b" style={{ display: 'grid', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>Backup</h3>
          <p class="muted" style={{ margin: 0, fontSize: '13px' }}>Data is stored in this browser. Export a backup before clearing browser data or moving computers.</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button class="btn" onClick={exportJSON}>Export JSON backup</button>
            <button class="btn ghost" onClick={() => { if (confirm('Replace ALL current data with the start data? Export a backup first — this removes your reports and documents (undo is possible right after).')) { resetDemo(); close(); } }}>Reset to start data</button>
          </div>
        </section>
        <RestorePoints close={close} />
      </div>
      {rows && (
        <div class="drawer-f">
          <button class="btn" onClick={() => setRows(null)}>Cancel</button>
          <button class="btn primary" disabled={!importable.length} onClick={() => {
            const L: Ledger = JSON.parse(JSON.stringify(ledger));
            importable.forEach((x, i) => {
              const fields = { code: x.d.code, name: x.d.name, country: x.d.country, sector: x.d.sector, funding: x.d.funding, start: parseDay(x.d.start)!, end: parseDay(x.d.end)!, budget: parseAmount(x.d.budget)!,
                mae: x.d.mae.trim() || undefined, pmm: x.d.pmm.trim() || undefined, bh: x.d.bh.trim() || undefined, ccm: x.d.ccm?.trim() || undefined, pmmUrl: validUrl(x.d.pmmUrl) ?? undefined };
              const at = L.projects.findIndex((p) => p.id === x.existing?.id);
              if (at >= 0) L.projects[at] = { ...L.projects[at], ...fields };
              else L.projects.push({ id: `p${Date.now().toString(36)}${i}`, ...fields, status: 'Active', reportingPeriods: [], riskRegister: [] });
            });
            replaceLedger(L, `Imported ${importable.length} project${importable.length > 1 ? 's' : ''}`); close();
          }}>Import {importable.length} row{importable.length === 1 ? '' : 's'}</button>
        </div>
      )}
    </>
  );
}

function RestorePoints({ close }: { close: () => void }) {
  const [P, setP] = useState<Awaited<ReturnType<typeof restorePoints>> | null>(null);
  useEffect(() => { restorePoints().then(setP); }, []);
  const now = useStore((s) => s.ledger);
  const nowReports = now.projects.reduce((a, p) => a + (p.reportingPeriods?.length ?? 0), 0);
  return (
    <section class="card" style={{ padding: '16px', display: 'grid', gap: '8px' }}>
      <h3 style={{ margin: 0, fontSize: '14px' }}>Restore points</h3>
      <p class="muted" style={{ margin: 0, fontSize: '13px' }}>A copy is kept each day you work (last 30 days). Now: {now.projects.length} projects, {nowReports} reports.</p>
      {!P ? <span class="muted">Loading…</span> : !P.length ? <span class="muted">No restore points yet.</span> : (
        <table class="mini"><thead><tr><th>Saved</th><th class="r">Projects</th><th class="r">Reports</th><th>Missing now</th><th /></tr></thead>
          <tbody>{P.map((x) => { const miss = x.ledger.projects.filter((p) => !now.projects.some((q) => q.id === p.id || (p.bh && q.bh === p.bh))).map((p) => p.bh ? `BH ${p.bh}` : p.code);
            return <tr><td>{x.key.endsWith('rescued') ? 'Rescued at load · ' : ''}{new Date(x.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td><td class="r num">{x.projects}</td><td class="r num">{x.reports}</td><td>{miss.join(', ') || '—'}</td>
              <td><button class="btn" onClick={() => { if (confirm('Replace the current data with this restore point? (undo is possible right after)')) { replaceLedger(x.ledger, `Restored data from ${x.at.slice(0, 10)}`); close(); } }}>Restore</button></td></tr>; })}</tbody></table>)}
    </section>
  );
}
