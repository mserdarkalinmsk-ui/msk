import { WeekDigest } from './ui/WeekDigest';
import { render } from 'preact';
import './styles/tokens.css';
import './styles/app.css';
import './styles/styles.css';
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
import { applyPrefs } from './ui/Appearance';
import { alerts } from './domain/insights';
import { TODAY } from './today';

let memo: [unknown, number] = [null, 0];
const urgent = (ps: import('./domain/types').Project[]) => memo[0] === ps ? memo[1] : (memo = [ps, alerts(ps, TODAY).filter((a) => a.severity !== 'warning').length])[1];

function App() {
  const route = useStore((s) => s.route);
  const ready = useStore((s) => s.ready);
  const [head, arg] = route.split('/');
  const r = ROUTES.find((x) => x.id === head);
  const proj = useStore((s) => (head === 'project' ? s.ledger.projects.find((p) => p.id === arg) : undefined));
  const title = head === 'project' ? proj?.code ?? 'Project' : r?.label ?? 'Not found';
  const crumb = head === 'project' ? <a class="crumb-link" href="#/projects" onClick={(e) => { e.preventDefault(); go('projects'); }}>Projects /</a> : null;
  const nAlerts = useStore((s) => (s.ready ? urgent(s.ledger.projects) : 0));
  const actions = (<>
    <button class="btn ghost bell" title="Alert centre" aria-label={`${nAlerts} urgent alerts`} onClick={() => go('reports/alerts')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>
      {nAlerts > 0 && <span class="bell-n">{nAlerts}</span>}
    </button>
    <button class="btn primary" onClick={() => set({ drawer: { kind: 'new-project' } })}>+ <span class="hide-sm">New project</span></button>
  </>);
  return (
    <>
      <Shell title={title} crumb={crumb} actions={actions}>
        {!ready ? null : head === 'overview' ? <Overview /> : head === 'projects' ? <Projects /> : head === 'budget' ? <Budget /> : head === 'people' ? <People /> : head === 'map' ? <MapPage /> : head === 'reports' ? <Reports key={route} /> : head === 'project' ? <ProjectPage id={arg} key={arg} /> : <Placeholder id={head} />}
      </Shell>
      <Drawer />
      <Palette />
      <WeekDigest />
      <Toasts />
    </>
  );
}

applyPrefs();
render(<App />, document.getElementById('app')!);
load();
