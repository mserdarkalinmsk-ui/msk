import { render } from 'preact';
import './styles/tokens.css';
import './styles/app.css';
import { load, set, useStore } from './data/store';
import { Overview } from './pages/Overview';
import { Projects } from './pages/Projects';
import { Drawer } from './ui/Drawer';
import { Palette, Toasts } from './ui/Palette';
import { Placeholder, ROUTES, Shell } from './ui/Shell';

function App() {
  const route = useStore((s) => s.route);
  const ready = useStore((s) => s.ready);
  const r = ROUTES.find((x) => x.id === route);
  const actions = (
    <button class="btn primary" onClick={() => set({ drawer: { kind: 'new-project' } })}>+ <span class="hide-sm">New project</span></button>
  );
  return (
    <>
      <Shell title={r?.label ?? 'Not found'} actions={actions}>
        {!ready ? null : route === 'overview' ? <Overview /> : route === 'projects' ? <Projects /> : <Placeholder id={route} />}
      </Shell>
      <Drawer />
      <Palette />
      <Toasts />
    </>
  );
}

render(<App />, document.getElementById('app')!);
load();
