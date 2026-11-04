import { useMemo, useState } from 'preact/hooks';
import { go, useStore } from '../data/store';
import { selfCheck } from '../domain/selfcheck';
import { full } from './format';

/** Shown in the top bar only when the same figure reads differently on two screens. */
export function SelfCheck() {
  const P = useStore((s) => s.ledger.projects), ready = useStore((s) => s.ready);
  const I = useMemo(() => (ready ? selfCheck(P) : []), [P, ready]);
  const [open, setOpen] = useState(false);
  if (!I.length) return null;
  return (
    <>
      <button class="btn selfcheck" title="The same figure reads differently on two screens" onClick={() => setOpen(true)}>⚠ <span class="hide-sm">{I.length} figure{I.length > 1 ? 's' : ''} disagree</span></button>
      {open && <>
        <div class="scrim" onClick={() => setOpen(false)} />
        <div class="fc-dlg card hl-dlg" role="dialog" aria-label="Self-check">
          <div class="card-h"><div><h2>Self-check: figures that disagree</h2><p>The same figure should read the same on every screen. These differ — do not use them in a report until fixed (re-upload the report, or tell the developer).</p></div>
            <button class="btn ghost" aria-label="Close" style={{ marginLeft: 'auto' }} onClick={() => setOpen(false)}>✕</button></div>
          <div class="card-b" style={{ paddingTop: 0 }}>
            <table class="mini"><thead><tr><th>Project</th><th>Figure</th><th>Where</th><th class="r">Value</th><th>Where</th><th class="r">Value</th><th class="r">Difference</th></tr></thead>
              <tbody>{I.map((x) => <tr>
                <td>{x.project ? <button class="linkish" onClick={() => { setOpen(false); go(`project/${x.project!.id}`); }}>{x.project.code}</button> : 'Portfolio'}</td>
                <td>{x.figure}</td><td>{x.a.label}</td><td class="r num">{full(x.a.v)}</td><td>{x.b.label}</td><td class="r num">{full(x.b.v)}</td><td class="r num">{full(x.a.v - x.b.v)}</td></tr>)}</tbody></table>
          </div>
        </div>
      </>}
    </>
  );
}
