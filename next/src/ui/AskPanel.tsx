import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '../data/store';
import { ask, errorCopy, theMask, type SampleError, type Turn } from '../ai/assistant';
import { Markdown } from '../ai/md';
import { X } from './CloseX';

/* The assistant panel: a conversation about the portfolio. Claude reads the app's figures through its tools and
   answers with them; nothing it does changes the data. The conversation stays for the page's lifetime. */
interface Msg { q: string; sent?: string; shown: string; used: string[]; status?: string; error?: string; truncated?: boolean; busy?: boolean }
let convo: Msg[] = [];
let prefs = { deep: false, hideNames: true };
try { const p = JSON.parse(localStorage.getItem('pl-ask') ?? 'null'); if (p) prefs = { ...prefs, ...p }; } catch { /* first use */ }
const TOOL_WORD: Record<string, string> = { list_projects: 'portfolio', budget_lines: 'budget lines', purchase_orders: 'purchase orders', postings: 'postings', work_plans: 'Work Plans', alerts: 'alerts', month_close: 'monthly close' };

export function AskPanel({ close }: { close: () => void }) {
  const route = useStore((s) => s.route), projects = useStore((s) => s.ledger.projects);
  const pid = /^project\/([^/]+)/.exec(route)?.[1], p = pid ? projects.find((x) => x.id === pid) : undefined;
  const lab = p ? (p.bh ? `BH ${p.bh}` : p.code) : '';
  const [msgs, setMsgs] = useState<Msg[]>(convo);
  const [q, setQ] = useState(''), [o, setO] = useState(prefs);
  const ctl = useRef<AbortController | null>(null), end = useRef<HTMLDivElement>(null), box = useRef<HTMLTextAreaElement>(null);
  const busy = msgs.some((m) => m.busy);
  const put = (f: (m: Msg[]) => Msg[]) => setMsgs((m) => (convo = f(m)));
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);
  useEffect(() => { box.current?.focus(); }, []);
  const setPref = (k: 'deep' | 'hideNames', v: boolean) => { const n = { ...o, [k]: v }; setO(n); prefs = n; try { localStorage.setItem('pl-ask', JSON.stringify(n)); } catch { /* ignore */ } };

  const send = async (text: string) => {
    const question = text.trim(); if (!question || busy) return;
    setQ('');
    const history: Turn[] = convo.filter((m) => m.sent && !m.error).flatMap((m) => [{ role: 'user' as const, content: m.q }, { role: 'assistant' as const, content: m.sent! }]);
    const at = convo.length;
    put((m) => [...m, { q: question, shown: '', used: [], busy: true, status: 'Thinking…' }]);
    const upd = (patch: Partial<Msg>) => put((m) => m.map((x, i) => (i === at ? { ...x, ...patch } : x)));
    ctl.current = new AbortController();
    try {
      const r = await ask(history, question, { signal: ctl.current.signal, deep: o.deep, hideNames: o.hideNames,
        context: p ? `The user has ${lab} (${p.name}) open, so "this project" means ${lab}.` : 'The user is on a portfolio page.',
        onText: (t) => upd({ shown: t, status: undefined }), onTool: (s) => upd({ status: `${s}…` }) });
      upd({ busy: false, status: undefined, sent: r.text, shown: o.hideNames ? theMask().show(r.text) : r.text, used: [...new Set(r.used)], truncated: r.truncated });
    } catch (e) {
      const err = e as SampleError;
      upd({ busy: false, status: undefined, shown: err.code === 'refused' ? '' : (err.text ? (o.hideNames ? theMask().show(err.text) : err.text) : ''), error: err.code === 'cancelled' ? 'Stopped.' : errorCopy(err.code) || 'Stopped.' });
    } finally { ctl.current = null; }
  };

  const ideas = p ? [
    `Where does ${lab} stand today, and what needs attention?`,
    `Which purchase orders of ${lab} are still open, and on which lines?`,
    `How much of the latest Work Plan of ${lab} has been spent, activity by activity?`,
    `Draft the FOMA notes for the latest Work Plan of ${lab}.`,
  ] : [
    'Which projects are behind schedule, and why?',
    'What needs my attention this week?',
    'Draft a short comment for this month\'s close, project by project.',
    'Compare the projects: budget, spent, spent + committed and pace.',
  ];
  return (
    <>
      <div class="drawer-h ai-h">
        <h2><span class="ai-mark" aria-hidden="true">✦</span> Ask</h2>
        <div class="ai-opts">
          <label title="Uses the most capable model: slower, for harder questions and long drafts"><input type="checkbox" checked={o.deep} onChange={(e) => setPref('deep', (e.target as HTMLInputElement).checked)} /> Thorough</label>
          <label title="People's names are replaced by placeholders before anything is sent, and put back in the answer"><input type="checkbox" checked={o.hideNames} onChange={(e) => setPref('hideNames', (e.target as HTMLInputElement).checked)} /> Hide names</label>
          {msgs.length > 0 && !busy && <button class="btn ghost sm" onClick={() => put(() => [])}>New chat</button>}
        </div>
        <X close={close} />
      </div>
      <div class="drawer-b ai-b">
        {!msgs.length && <div class="ai-empty">
          <p>Ask about budgets, spending, purchase orders, Work Plans, alerts or the monthly close{p ? <> — <b>{lab}</b> is open</> : ''}. Answers use the app's own figures, and you can ask for drafts.</p>
          <div class="ai-ideas">{ideas.map((x) => <button class="ai-idea" onClick={() => void send(x)}>{x}</button>)}</div>
        </div>}
        {msgs.map((m) => (
          <div class="ai-pair">
            <div class="ai-q">{m.q}</div>
            <div class={`ai-a${m.error ? ' err' : ''}`}>
              {m.shown ? <Markdown text={m.shown} /> : m.busy ? null : !m.error && <p class="muted">No answer.</p>}
              {m.busy && <div class="ai-status"><span class="ai-dot" />{m.status ?? 'Writing…'}</div>}
              {m.truncated && <p class="ai-note">The answer was cut short — ask for less at a time.</p>}
              {m.error && <p class="ai-note">{m.error}</p>}
              {!m.busy && m.shown && <div class="ai-meta">
                {m.used.length > 0 && <span>Read: {m.used.map((u) => TOOL_WORD[u] ?? u).join(', ')}</span>}
                <button class="btn ghost sm" onClick={() => void navigator.clipboard?.writeText(m.shown)}>Copy</button>
              </div>}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div class="drawer-f ai-f">
        <textarea ref={box} rows={2} placeholder={p ? `Ask about ${lab} or the portfolio…` : 'Ask about the portfolio…'} value={q} disabled={busy}
          onInput={(e) => setQ((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(q); } }} />
        {busy ? <button class="btn" onClick={() => ctl.current?.abort()}>Stop</button> : <button class="btn primary" disabled={!q.trim()} onClick={() => void send(q)}>Send</button>}
      </div>
      <p class="ai-foot">Answers come from Claude on your claude.ai account and use the figures in this app{o.hideNames ? '; people\'s names are replaced before anything is sent' : ''}. Check figures before you send a draft on.</p>
    </>
  );
}
