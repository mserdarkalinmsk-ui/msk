import { useMemo, useState } from 'preact/hooks';
import { saveRules, useStore } from '../data/store';
import { alerts } from '../domain/insights';
import { cleanRules, DEFAULT_RULES, RULE_FIELDS, rules, setRules, type Rules } from '../domain/rules';
import { TODAY } from '../today';
import { X } from './CloseX';

/**
 * Rules & thresholds: the house rules every check follows, in one place. A change is previewed as the number of
 * alerts it would give before it is saved, and applies to every project at once.
 */
export function RulesPanel({ close }: { close: () => void }) {
  const projects = useStore((s) => s.ledger.projects);
  const saved = rules();
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(RULE_FIELDS.map((f) => [f.key, String(saved[f.key])])));
  const bad = (k: string) => { const f = RULE_FIELDS.find((x) => x.key === k)!, v = Number(draft[k]); return draft[k].trim() === '' || !Number.isFinite(v) || v < f.min || v > f.max; };
  const errs = RULE_FIELDS.filter((f) => bad(f.key));
  const next: Rules = useMemo(() => cleanRules(Object.fromEntries(RULE_FIELDS.map((f) => [f.key, Number(draft[f.key])])) as Partial<Rules>), [draft]);
  const order = Number(draft.paceFarBehind) < Number(draft.paceBehind) ? '“Seriously behind” cannot start before “behind schedule”.' : Number(draft.lineCritical) < Number(draft.lineOver) ? '“Critical” cannot start before the line is flagged.' : '';
  const dirty = RULE_FIELDS.some((f) => next[f.key] !== saved[f.key]);
  // What the alerts would be under the draft: counted on copies so nothing remembered under the saved rules is reused.
  const preview = useMemo(() => {
    if (errs.length || order) return null;
    const count = (r: Rules) => { setRules(r); try { const A = alerts(projects.map((p) => ({ ...p })), TODAY); return { all: A.length, urgent: A.filter((a) => a.severity !== 'warning').length }; } finally { setRules(saved); } };
    return { now: count(saved), then: count(next) };
  }, [next, projects, errs.length, order]);
  const groups = [...new Set(RULE_FIELDS.map((f) => f.group))];
  return (
    <>
      <div class="drawer-h"><h2>Rules &amp; thresholds</h2><X close={close} /></div>
      <div class="drawer-b rl">
        <p class="rl-intro">The rules every check follows. They apply to all projects and are saved with your data, so a backup or a shared copy carries them too.</p>
        {groups.map((g) => (
          <section class="rl-g">
            <h3>{g}</h3>
            {RULE_FIELDS.filter((f) => f.group === g).map((f) => { const changed = Number(draft[f.key]) !== DEFAULT_RULES[f.key];
              return (
                <div class="rl-row" data-invalid={bad(f.key) ? '' : undefined}>
                  <label for={`rl-${f.key}`}><b>{f.label}</b><span>{f.help}</span>{bad(f.key) && <em>Between {f.min} and {f.max}</em>}</label>
                  <div class="rl-in"><input id={`rl-${f.key}`} class="input num" inputMode="decimal" value={draft[f.key]} onInput={(e) => setDraft({ ...draft, [f.key]: (e.target as HTMLInputElement).value.replace(',', '.') })} /><span>{f.unit}</span></div>
                  <div class="rl-def">{changed ? <button class="btn ghost" title="Back to the default" onClick={() => setDraft({ ...draft, [f.key]: String(DEFAULT_RULES[f.key]) })}>default {DEFAULT_RULES[f.key]}</button> : <span class="muted">default</span>}</div>
                </div>
              ); })}
          </section>
        ))}
        {order && <p class="rl-err" role="alert">{order}</p>}
        {preview && dirty && <div class="rl-prev" role="status">
          <b>With these rules</b>
          <span>{preview.then.all} alert{preview.then.all === 1 ? '' : 's'} ({preview.then.urgent} urgent) instead of {preview.now.all} ({preview.now.urgent} urgent) today.</span>
        </div>}
      </div>
      <div class="drawer-f">
        <button class="btn ghost" style={{ marginRight: 'auto' }} disabled={RULE_FIELDS.every((f) => Number(draft[f.key]) === DEFAULT_RULES[f.key])} onClick={() => setDraft(Object.fromEntries(RULE_FIELDS.map((f) => [f.key, String(DEFAULT_RULES[f.key])])))}>Reset all to defaults</button>
        <button class="btn" onClick={close}>Cancel</button>
        <button class="btn primary" disabled={!dirty || errs.length > 0 || !!order} onClick={() => { saveRules(next); close(); }}>Save rules</button>
      </div>
    </>
  );
}
