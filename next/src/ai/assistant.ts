/* The assistant: questions about the portfolio answered by Claude through the claude.ai viewer ("sample" capability),
   with the app's own figures as its only source. Available only when the app is opened from its claude.ai link;
   a saved copy of the file has no window.claude and shows nothing of this. */
import { TOOLS, knownPeople } from './tools';
import { Mask } from './mask';
export { Mask };
import { TODAY } from '../today';
import { get } from '../data/store';

export interface Turn { role: 'user' | 'assistant'; content: string }
type SampleFn = ((input: string | Turn[], opts?: Record<string, unknown>) => Promise<{ text: string; truncated: boolean }>) & { limits?: () => Promise<{ tools?: { maxCount: number } }> };
export interface SampleError { code: string; message?: string; text?: string }

let samplePromise: Promise<SampleFn | null> | null = null;
/** The viewer's sample function, or null where the page cannot ask Claude (a saved copy, another host). */
export function sampler(): Promise<SampleFn | null> {
  if (!samplePromise) {
    const c = (globalThis as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
    samplePromise = c?.use ? c.use('sample').then((s) => (typeof s === 'function' ? (s as SampleFn) : null)).catch(() => null) : Promise.resolve(null);
  }
  return samplePromise;
}

let mask: Mask | null = null;
export const theMask = () => (mask ??= new Mask(knownPeople()));

/* ---------- the standing instructions ---------- */
function rulesTurn(context: string): string {
  const L = get().ledger;
  return [
    'You are the finance assistant inside Portfolio Ledger, the tool a programme office uses to follow its projects\' budgets, spending, purchase orders, Work Plans and monthly close.',
    `Today is ${TODAY.toISOString().slice(0, 10)}. The office follows ${L.projects.length} projects. ${context}`,
    '',
    'How to answer:',
    '- Every figure you give must come from a tool result in this conversation. Never estimate, extrapolate or round loosely, and never invent a project, line, PO, activity or person. If the data is not there, say exactly what is missing and which file would provide it.',
    '- Use the tools to look things up; call several at once when they are independent. Prefer one call with a filter over many calls.',
    '- Amounts in euros with two decimals (€1,234.56); percentages with one decimal. Name projects as "BH 5235" and budget lines by their code (e.g. 5.7.3).',
    '- Answer in the language of the user\'s latest message (Turkish or English). Lead with the answer in one or two sentences, then the supporting figures. Use a short Markdown table when comparing several items. No preamble, no closing offers.',
    '- "Person 1", "Person 2" … are placeholders for people\'s names; use them exactly as written.',
    '- When asked for a draft (FOMA notes, a comment for the monthly close, a letter, an e-mail), write it ready to paste in a formal tone, in the language asked (English if not said), with the real figures. Never mention how it was produced. Leave only an unknown addressee or signature as [brackets].',
    '- Definitions the app uses: activity budget = eligible budget (total ÷ 1.07) less staff salaries (lines 1.1.1 local team and 1.2.1 HQ team) and heading 4 (local office); consultants and per diems count as activity. A Work Plan\'s spending counts activity lines posted within its dates plus every posting carrying one of its PMM activity numbers. Heading flexibility is 25% for Joint Programmes and 15% for Voluntary Contributions; grants are never paced. Pace gap = % spent − % of time gone.',
    '- You can only read; you cannot change data. If the user asks for a change, tell them where in the app to make it.',
  ].join('\n');
}

export interface AskOptions { signal: AbortSignal; deep: boolean; hideNames: boolean; context: string; onText: (t: string) => void; onTool: (say: string) => void }
/** One question in a conversation. `history` holds the turns as sent (placeholders in place of names). Returns the answer as sent. */
export async function ask(history: Turn[], question: string, o: AskOptions): Promise<{ text: string; truncated: boolean; used: string[] }> {
  const s = await sampler(); if (!s) throw { code: 'not_available' } as SampleError;
  const M = o.hideNames ? theMask() : null, used: string[] = [];
  const tools = TOOLS.map((t) => ({ name: t.name, description: t.description, ...(t.inputSchema ? { inputSchema: t.inputSchema } : {}),
    execute: (input: Record<string, unknown>) => {
      o.onTool(t.say(input)); used.push(t.name);
      const out = JSON.stringify(t.run(input ?? {}));            // a thrown Error goes back to Claude as its message
      return M ? M.hide(out) : out;
    } }));
  const turns: Turn[] = [{ role: 'user', content: rulesTurn(o.context) }, ...history.slice(-12), { role: 'user', content: question }];
  const r = await s(turns, { tools, signal: o.signal, modelTier: o.deep ? 'complex' : 'default', onText: ({ text }: { text: string }) => o.onText(M ? M.show(text) : text) });
  return { text: r.text, truncated: r.truncated, used };
}

/** What the viewer is told for each failure code (never retried by the page). */
export function errorCopy(code: string): string {
  switch (code) {
    case 'cancelled': return '';
    case 'not_granted': return 'Claude is not allowed for this page. Allow it from the page\'s Permissions menu to use the assistant.';
    case 'sampling_disabled': case 'capability_disabled': case 'not_declared': case 'capability_removed': case 'not_available': return 'The assistant is not available here.';
    case 'tools_unavailable': return 'This view cannot let Claude read the app\'s figures, so the assistant is off here.';
    case 'rate_limited': return 'Usage limit reached for now. Try again a little later.';
    case 'session_expired': return 'Your claude.ai session has expired. Sign in again and retry.';
    case 'prompt_too_large': return 'Too much to read at once. Ask about one project or a shorter period.';
    case 'refused': return 'Claude declined this request. Rephrase it and try again.';
    case 'empty_completion': return 'No answer came back. Ask for less at a time.';
    default: return 'Something went wrong on the way. Try again.';
  }
}
