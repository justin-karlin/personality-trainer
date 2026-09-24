import { useEffect } from 'react';
import { navigate, useRoute } from './router';
import { useStore } from './store';
import type { AppState } from './types';
import { Welcome } from './pages/Welcome';
import { Assess } from './pages/Assess';
import { Results } from './pages/Results';
import { Goals } from './pages/Goals';
import { Today } from './pages/Today';
import { Plan } from './pages/Plan';
import { Reflect } from './pages/Reflect';
import { Progress } from './pages/Progress';
import { Library } from './pages/Library';
import { Science } from './pages/Science';
import { Settings } from './pages/Settings';

const NAV: { route: string; label: string }[] = [
  { route: 'today', label: 'Today' },
  { route: 'plan', label: 'Plan' },
  { route: 'progress', label: 'Progress' },
  { route: 'library', label: 'Toolkit' },
  { route: 'science', label: 'Science' },
  { route: 'settings', label: 'Settings' },
];

export function App() {
  const { state } = useStore();
  const route = useRoute();
  const onboarded = state.acceptedDisclaimer && state.assessments.length > 0 && state.goals.length > 0;
  const effective = resolveRoute(route, state);

  useEffect(() => {
    if (effective !== route) navigate(effective);
  }, [effective, route]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={onboarded ? '#/today' : '#/welcome'}>
            🌱 Trait Trainer
          </a>
          {onboarded && (
            <nav className="nav" aria-label="Main">
              {NAV.map((n) => (
                <a key={n.route} href={`#/${n.route}`} className={effective === n.route ? 'active' : ''}>
                  {n.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main>
        <Page route={effective} />
      </main>
      <footer className="footer">
        Trait Trainer is a self-improvement tool, not therapy or medical care. In crisis? Call or text 988 (US) or visit{' '}
        <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
          findahelpline.com
        </a>
        . Your data stays in this browser.
      </footer>
    </div>
  );
}

const KNOWN = ['welcome', 'assess', 'results', 'goals', 'today', 'plan', 'reflect', 'progress', 'library', 'science', 'settings'];
const ALWAYS_OPEN = ['welcome', 'library', 'science', 'settings'];

/** Send people to the first onboarding step they haven't finished. */
function resolveRoute(route: string, state: AppState): string {
  if (ALWAYS_OPEN.includes(route)) return route;
  if (!state.acceptedDisclaimer) return 'welcome';
  if (!state.assessments.length) return 'assess';
  if (!state.goals.length) return ['assess', 'results', 'goals'].includes(route) ? route : 'results';
  return KNOWN.includes(route) ? route : 'today';
}

function Page({ route }: { route: string }) {
  switch (route) {
    case 'welcome':
      return <Welcome />;
    case 'assess':
      return <Assess />;
    case 'results':
      return <Results />;
    case 'goals':
      return <Goals />;
    case 'plan':
      return <Plan />;
    case 'reflect':
      return <Reflect />;
    case 'progress':
      return <Progress />;
    case 'library':
      return <Library />;
    case 'science':
      return <Science />;
    case 'settings':
      return <Settings />;
    default:
      return <Today />;
  }
}
