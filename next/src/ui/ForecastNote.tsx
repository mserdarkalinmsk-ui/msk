import { useRef, useState } from 'preact/hooks';
import { setBrand, updateProject, useStore } from '../data/store';
import { computePlan, effective, type ForecastDraft } from '../domain/forecastPlan';
import { FORECAST_KINDS, forecastFileName, forecastPeriod, ifrSheet, type ForecastOptions } from '../domain/forecastTemplate';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { shrink } from './Appearance';
import { downloadDocx } from './docxwrite';
import { date, full } from './format';
import { download, pngData } from './xlsxwrite';

// Closing tags built at run time: a literal one in the bundle would be taken for the page's own by the single-file build.
const end = (t: string) => `<${String.fromCharCode(47)}${t}>`;
const pc = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(2)}%`;

/**
 * Revision note that goes with the forecast: the budget by heading before and after, the change against the flexibility,
 * the justification per heading and the signature block — as Word or PDF, with the logos the user added in the header.
 */
export function ForecastNote({ p, d, opt, close }: { p: Project; d: ForecastDraft; opt: ForecastOptions; close: () => void }) {
  const brand = useStore((s) => s.ledger.brand), countries = useStore((s) => s.ledger.countries);
  const country = countries.find((c) => c.id === p.country)?.name ?? '';
  const E = effective(p, TODAY, d), R = computePlan(p, TODAY, E), per = forecastPeriod(p, TODAY, opt);
  const doc = useRef<HTMLDivElement>(null), [err, setErr] = useState('');
  const save = (x: Partial<ForecastDraft>) => updateProject(p.id, { forecastDraft: { ...d, ...x, updatedAt: new Date().toISOString() } });
  const heads = R.heads.filter((h) => h.baseline || h.rounded), moved = heads.filter((h) => Math.abs(h.rounded - h.baseline) >= 0.005);
  const what = opt.change ? `${opt.change === 'addendum' ? 'Addendum' : 'Notification'} n°${opt.changeNo ?? '…'}` : FORECAST_KINDS[opt.kind].label;
  const id = [p.jp && `JP ${p.jp}`, p.pmm && `VC ${p.pmm}`, p.bh && `BH ${p.bh}`].filter(Boolean).join(' · ') || p.code;
  const base = forecastFileName(p, country, TODAY, opt, 'donor').replace(/\.xlsx$/, '').replace('Revised Budget proposal', 'Revision note');
  const logos = [brand?.logo, brand?.logo2];
  const pick = async (k: 'logo' | 'logo2', f?: File) => { if (!f) return; if (!/^image\//.test(f.type)) return setErr('Choose an image (PNG, JPG or SVG)'); setErr(''); setBrand({ ...(brand ?? {}), [k]: await shrink(f) }); };
  const word = () => { if (doc.current) void downloadDocx(`${base}.docx`, doc.current, `Revision note — ${p.name}`, logos); };
  const pdf = () => {
    const w = window.open('', '_blank'); if (!w || !doc.current) return setErr('Allow pop-ups to print the PDF');
    const shown = logos.filter(Boolean), head = shown.map((u, i) => `<img src="${u}" style="height:15mm;${i ? 'margin-left:auto' : shown.length > 1 ? 'margin-right:auto' : ''}">`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${base}</title><style>@page{size:A4;margin:16mm}body{font:10.5pt Calibri,Arial,sans-serif;color:#1f2937}h1{font-size:17pt;margin:0 0 4mm}h2{font-size:12.5pt;color:#1d4e89;border-bottom:1px solid #c9ced6;padding-bottom:1mm;margin:6mm 0 2mm}table{border-collapse:collapse;width:100%;margin:2mm 0 3mm}th,td{border:1px solid #c9ced6;padding:1.2mm 2mm;text-align:left;vertical-align:top}th{background:#e8eef6}.r{text-align:right;white-space:nowrap}.hd{display:flex;align-items:center;justify-content:center;margin-bottom:6mm}.no-print{display:none}p{margin:1.5mm 0}</style>${end('head')}<body><div class="hd">${head}</div>${doc.current.innerHTML.replace(/<textarea[^>]*>([\s\S]*?)<\/textarea>/g, '<p>$1</p>')}${end('body')}${end('html')}`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };
  const [rk, setRk] = useState<'interim' | 'final'>(() => (p.end <= TODAY.toISOString().slice(0, 10) ? 'final' : 'interim')), [withOrig, setWithOrig] = useState(!!opt.change);
  const ifr = () => download(forecastFileName(p, country, TODAY, opt).replace(/-IFR-.*?-([A-Z]{3}-\d{4}\.xlsx)$/, `-${rk === 'final' ? 'Final' : 'Interim'} financial report-$1`),
    [ifrSheet(p, TODAY, opt, { logo: pngData(brand?.logo) ?? undefined, sign1: brand?.sign1, sign2: brand?.sign2, kind: rk, withOriginal: rk === 'final' && withOrig })]);
  const just = (code: string) => E.just?.[code] ?? '';
  return (
    <>
      <div class="scrim" onClick={close} />
      <div class="fc-dlg card fn-dlg" role="dialog" aria-label="Reports">
        <div class="card-h"><h2>Reports</h2><button class="btn ghost" aria-label="Close" onClick={close}>✕</button></div>
        <div class="card-b" style={{ display: 'grid', gap: '12px' }}>
          <div class="fn-logos">
            {(['logo', 'logo2'] as const).map((k, i) => <div class="fn-logo">
              <div class="brand-prev">{brand?.[k] ? <img src={brand[k]} alt="" /> : <span class="muted">{i ? 'Right logo' : 'Left logo'}</span>}</div>
              <label class="btn">Choose…<input type="file" accept="image/*" hidden onChange={(e) => pick(k, (e.target as HTMLInputElement).files?.[0])} /></label>
              {brand?.[k] && <button class="btn ghost" onClick={() => setBrand({ ...brand, [k]: undefined })}>Remove</button>}
            </div>)}
            <p class="muted">Logos you add are kept in your data and printed in the header of the note.</p>
          </div>
          {err && <p class="fe-over">{err}</p>}
          <div class="fn-ifr">
            <b>Financial report (Excel)</b>
            <div class="seg" style={{ justifySelf: 'start' }}>{(['interim', 'final'] as const).map((k) => <button aria-pressed={rk === k} onClick={() => setRk(k)}>{k === 'interim' ? 'Interim' : 'Final'}</button>)}</div>
            <span class="muted">{rk === 'interim' ? 'Budget, actual and spent and committed per line, totals, footnotes (1)–(3), certification and signatures.'
              : opt.programme === 'JP' ? 'Budget and actual per line over the whole period, totals 7–11, sources of funding (EU priority of consumption), payments received and the balance to be paid, certification and signatures.'
                : 'Budget and actual per line over the whole period, direct costs, administrative costs, total, source of funding with the balance, certification and signatures.'}</span>
            {rk === 'final' && <label class="fe-all"><input type="checkbox" checked={withOrig} onChange={() => setWithOrig(!withOrig)} /> After a notification / addendum: show the contractual budget beside the revised one</label>}
            {rk === 'final' && opt.programme === 'JP' && !(p.payments?.length) && <span class="fe-over" style={{ margin: 0 }}>No payments recorded — add them in Reports → Cash plan for the payments table.</span>}
            <div class="fn-sign">{(['sign1', 'sign2'] as const).map((k, i) => <textarea rows={4} placeholder={i ? 'Right signature: name\ntitle\nunit\norganisation' : 'Left signature: name\ntitle\nunit\norganisation'} value={brand?.[k] ?? ''} onChange={(e) => setBrand({ ...(brand ?? {}), [k]: (e.target as HTMLTextAreaElement).value || undefined })} />)}</div>
            <button class="btn" onClick={ifr}>⤓ {rk === 'interim' ? 'Interim' : 'Final'} financial report</button>
          </div>

          <div class="fn-doc" ref={doc}>
            <h1>Budget revision — {what}</h1>
            <table><tbody>
              <tr><th>Project</th><td>{p.name}</td></tr>
              <tr><th>Reference</th><td>{id}{p.contractNo ? ` · Contract ${p.contractNo}` : ''}</td></tr>
              <tr><th>Country</th><td>{country}</td></tr>
              <tr><th>Implementation period</th><td>{date(p.start)} – {date(opt.kind === 'extension' && opt.extendTo ? opt.extendTo : p.end)}</td></tr>
              <tr><th>Forecast period</th><td>{date(per.from)} – {date(per.to)}</td></tr>
              <tr><th>Date</th><td>{date(TODAY.toISOString().slice(0, 10))}</td></tr>
            </tbody></table>

            <h2>1. Summary</h2>
            <p>{R.decision === 'addendum' ? `The proposed changes take at least one heading beyond the ${Math.round(R.flex * 100)}% flexibility or change the budget structure; they are submitted for acceptance by addendum.`
              : R.decision === 'notification' ? `The proposed changes keep every heading within ${Math.round(R.flex * 100)}% of the amounts in the agreement; they are notified to the Contracting Authority.`
                : 'The forecast keeps the budget by heading unchanged.'}</p>
            <p>Total direct costs: {full(R.direct.budget)} → {full(R.direct.rounded)}. Total eligible costs: {full(R.total.budget)} → {full(R.total.rounded)}.</p>
            {R.reasons.length > 0 && <ul>{R.reasons.map((x) => <li>{x}</li>)}</ul>}

            <h2>2. Budget by heading</h2>
            <table>
              <thead><tr><th>Heading</th><th class="r">Agreement (€)</th><th class="r">Current (€)</th><th class="r">Proposed (€)</th><th class="r">Change (€)</th><th class="r">Change vs agreement</th><th>Within ±{Math.round(R.flex * 100)}%</th></tr></thead>
              <tbody>{heads.map((h) => <tr><td>{h.code} {h.label}</td><td class="r">{full(h.baseline)}</td><td class="r">{full(h.budget)}</td><td class="r">{full(h.rounded)}</td><td class="r">{full(h.rounded - h.budget)}</td><td class="r">{h.isNew ? 'new' : pc(h.change)}</td><td>{h.beyond || h.isNew ? 'No' : 'Yes'}</td></tr>)}
                <tr><td><b>Total direct costs</b></td><td class="r" /><td class="r"><b>{full(R.direct.budget)}</b></td><td class="r"><b>{full(R.direct.rounded)}</b></td><td class="r"><b>{full(R.direct.rounded - R.direct.budget)}</b></td><td /><td /></tr>
                <tr><td>Administrative costs</td><td class="r" /><td class="r">{full(R.admin.budget)}</td><td class="r">{full(R.admin.rounded)}</td><td class="r">{full(R.admin.rounded - R.admin.budget)}</td><td /><td /></tr>
                <tr><td><b>Total eligible costs</b></td><td class="r" /><td class="r"><b>{full(R.total.budget)}</b></td><td class="r"><b>{full(R.total.rounded)}</b></td><td class="r"><b>{full(R.total.rounded - R.total.budget)}</b></td><td /><td /></tr></tbody>
            </table>

            <h2>3. Justification</h2>
            {moved.length ? moved.map((h) => <div>
              <h3 style={{ margin: '8px 0 2px', fontSize: '13px' }}>{h.code} {h.label} ({full(h.rounded - h.budget)})</h3>
              <textarea class="fn-just" rows={3} placeholder="Why the heading changes (activities added, postponed, cheaper or dearer than planned…)" value={just(h.code)}
                onChange={(e) => save({ just: { ...E.just, [h.code]: (e.target as HTMLTextAreaElement).value } })} />
            </div>) : <p>No heading changes.</p>}

            <h2>4. Approval</h2>
            <table><thead><tr><th>Prepared by</th><th>Approved by</th></tr></thead>
              <tbody><tr><td><input class="fn-sig" placeholder="name, title" value={E.sign?.by ?? ''} onChange={(e) => save({ sign: { ...E.sign, by: (e.target as HTMLInputElement).value } })} /></td>
                <td><input class="fn-sig" placeholder="name, title" value={E.sign?.ok ?? ''} onChange={(e) => save({ sign: { ...E.sign, ok: (e.target as HTMLInputElement).value } })} /></td></tr>
                <tr><td>Date / signature:</td><td>Date / signature:</td></tr></tbody></table>
          </div>
        </div>
        <div class="fe-dl" style={{ position: 'sticky', bottom: 0 }}>
          <span class="muted">{base}</span>
          <button class="btn" onClick={pdf}>⎙ PDF</button>
          <button class="btn primary" onClick={word}>⤓ Word</button>
        </div>
      </div>
    </>
  );
}
