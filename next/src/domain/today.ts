/** "What needs me now": every dated task and every check in one list, grouped by how soon. */
export interface Todo { key: string; kind: string; when?: string; tone: 'bad' | 'warn' | 'info'; what: string; where: string; go: string }
export interface TodoGroup { id: 'overdue' | 'week' | 'month' | 'quarter' | 'check'; label: string; items: Todo[] }

const add = (iso: string, d: number) => { const x = new Date(`${iso}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const LABEL: Record<TodoGroup['id'], string> = { overdue: 'Overdue', week: 'Next 7 days', month: 'Next 30 days', quarter: 'Within 90 days', check: 'To check' };

/** Many tasks of one kind on the same day (yearly contracts all ending on 31 December) become one line. */
export function fold(T: Todo[], kinds: string[], say: (n: number, x: Todo[]) => Pick<Todo, 'what' | 'where' | 'go'>): Todo[] {
  const out: Todo[] = [], by = new Map<string, Todo[]>();
  for (const t of T) { if (!kinds.includes(t.kind) || !t.when) { out.push(t); continue; } const k = `${t.kind}|${t.when}`; by.set(k, [...(by.get(k) ?? []), t]); }
  for (const [k, L] of by) out.push(L.length === 1 ? L[0] : { ...L[0], key: `fold|${k}`, tone: L.some((x) => x.tone === 'bad') ? 'bad' : L[0].tone, ...say(L.length, L) });
  return out;
}

/** The groups in order, soonest first inside each; past 90 days nothing is listed (the calendar has it). */
export function todoGroups(T: Todo[], today: string): TodoGroup[] {
  const w = add(today, 7), m = add(today, 30), q = add(today, 90);
  const id = (t: Todo): TodoGroup['id'] | null => !t.when ? 'check' : t.when < today ? 'overdue' : t.when <= w ? 'week' : t.when <= m ? 'month' : t.when <= q ? 'quarter' : null;
  const rank = { bad: 0, warn: 1, info: 2 };
  return (['overdue', 'week', 'month', 'quarter', 'check'] as const).map((g) => ({ id: g, label: LABEL[g], items: T.filter((t) => id(t) === g).sort((a, b) => (a.when ?? '').localeCompare(b.when ?? '') || rank[a.tone] - rank[b.tone]) })).filter((g) => g.items.length);
}
