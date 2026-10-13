import { useEffect, useState } from 'react';

// Minimal hash router: works on any static host with no server config.
export type Route =
  | 'welcome'
  | 'assess'
  | 'results'
  | 'goals'
  | 'today'
  | 'checkin'
  | 'plan'
  | 'reflect'
  | 'progress'
  | 'library'
  | 'science'
  | 'settings';

export function navigate(route: Route | string): void {
  window.location.hash = `#/${route}`;
  window.scrollTo(0, 0);
}

function readHash(): string {
  return window.location.hash.replace(/^#\/?/, '') || '';
}

export function useRoute(): string {
  const [route, setRoute] = useState(readHash);
  useEffect(() => {
    const onChange = () => setRoute(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
