import { render } from 'preact';
import './styles/tokens.css';
import './styles/app.css';
import { go, load, set, useStore } from './data/store';
import { Overview } from './pages/Overview';
import { Projects } from './pages/Projects';
import { Budget } from './pages/Budget';
import { People } from './pages/People';
import { MapPage } from './pages/MapPage';
import { Reports } from './pages/Reports';
import { ProjectPage } from './pages/ProjectPage';
import { Drawer } from './ui/Drawer';
import { Palette, Toasts } from './ui/Palette';
import { Placeholder, ROUTES, Shell } from './ui/Shell';

function App() {
  const route = useStore((s) => s.route);
  const ready = useStore((s) => s.ready);
  const [head, arg] = route.split('/');
  const r = ROUTES.find((x) => x.id === head);
  const proj = useStore((s) => (head === 'project' ? s.ledger.projects.find((p) => p.id === arg) : undefined));
  const title = head === 'project' ? proj?.code ?? 'Project' : r?.label ?? 'Not found';
  const crumb = head === 'project' ? <a class="crumb-link" href="#/projects" onClick={(e) => { e.preventDefault(); go('projects'); }}>Projects /</a> : null;
  const actions = (
    <button class="btn primary" onClick={() => set({ drawer: { kind: 'new-project' } })}>+ <span class="hide-sm">New project</span></button>
  );
  return (
    <>
      <Shell title={title} crumb={crumb} actions={actions}>
        {!ready ? null : head === 'overview' ? <Overview /> : head === 'projects' ? <Projects /> : head === 'budget' ? <Budget /> : head === 'people' ? <People /> : head === 'map' ? <MapPage /> : head === 'reports' ? <Reports /> : head === 'project' ? <ProjectPage id={arg} key={arg} /> : <Placeholder id={head} />}
      </Shell>
      <Drawer />
      <Palette />
      <Toasts />
    </>
  );
}

render(<App />, document.getElementById('app')!);
load();
