import { filtered, set, useStore } from '../data/store';
import { Filters, ProjectTable } from './Overview';

export function Projects() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  return (
    <>
      <Filters />
      <section class="card" style={{ overflow: 'hidden' }}>
        <ProjectTable rows={P} cname={cname} maxHeight={Math.max(360, innerHeight - 220)} />
      </section>
      <p class="muted" style={{ fontSize: '12.5px' }}>Tip: press <kbd>Ctrl K</kbd> to jump to any project, or <button class="btn ghost" style={{ height: '24px' }} onClick={() => set({ drawer: { kind: 'new-project' } })}>add a project</button>.</p>
    </>
  );
}
