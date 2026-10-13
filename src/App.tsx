import { useEffect, useRef } from 'react';
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
import { Checkin } from './pages/Checkin';
import { Icon, type IconName } from './components/Icon';

/** The five sections. "Learn" holds the science and the toolkit; check-in and reflection sit under Today. */
const NAV: { route: string; label: string; icon: IconName; covers: string[] }[] = [
  { route: 'today', label: 'Today', icon: 'today', covers: ['today', 'checkin', 'reflect'] },
  { route: 'plan', label: 'Plan', icon: 'plan', covers: ['plan'] },
  { route: 'progress', label: 'Progress', icon: 'progress', covers: ['progress'] },
  { route: 'science', label: 'Learn', icon: 'learn', covers: ['science', 'library'] },
  { route: 'settings', label: 'Settings', icon: 'settings', covers: ['settings'] },
];

const TITLES: Record<string, string> = {
  welcome: 'Welcome',
  assess: 'Questionnaire',
  results: 'Your results',
  goals: 'Goals',
  today: 'Today',
  checkin: 'Daily check-in',
  plan: 'Plan',
  reflect: 'Weekly reflection',
  progress: 'Progress',
  library: 'Toolkit',
  science: 'Science',
  settings: 'Settings',
};

export function App() {
  const { state } = useStore();
  const route = useRoute();
  const onboarded = state.acceptedDisclaimer && state.assessments.length > 0 && state.goals.length > 0;
  const effective = resolveRoute(route, state);

  useEffect(() => {
    if (effective !== route) navigate(effective);
  }, [effective, route]);

  // On every page change: name the page, start at the top and move focus to its heading,
  // so keyboard and screen-reader users land on the new content.
  const firstRender = useRef(true);
  useEffect(() => {
    document.title = `${TITLES[effective] ?? 'Today'} · Trait Trainer`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    const h = document.querySelector<HTMLElement>('main h1');
    if (h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }, [effective]);

  const section = NAV.find((n) => n.covers.includes(effective))?.route;
  const showTabs = onboarded && effective !== 'checkin';
  // The exact page is "page"; its parent section (e.g. Today while on Check-in) is "true".
  const current = (r: string) => (effective === r ? ('page' as const) : section === r ? ('true' as const) : undefined);

  return (
    <div className={`app ${showTabs ? 'has-tabs' : ''}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={onboarded ? '#/today' : '#/welcome'}>
            <span className="brand-mark">
              <Icon name="sprout" size={18} stroke={2} />
            </span>
            Trait Trainer
          </a>
          {onboarded && (
            <nav className="nav" aria-label="Primary">
              {NAV.map((n) => (
                <a key={n.route} href={`#/${n.route}`} aria-current={current(n.route)}>
                  <Icon name={n.icon} size={18} />
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
        . Your data stays on this device.
      </footer>
      {showTabs && (
        <nav className="tabbar" aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.route} href={`#/${n.route}`} aria-current={current(n.route)}>
              <span className="tab-icon">
                <Icon name={n.icon} size={22} />
              </span>
              <span className="tab-label">{n.label}</span>
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}

const KNOWN = ['welcome', 'assess', 'results', 'goals', 'today', 'checkin', 'plan', 'reflect', 'progress', 'library', 'science', 'settings'];
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
    case 'checkin':
      return <Checkin />;
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
