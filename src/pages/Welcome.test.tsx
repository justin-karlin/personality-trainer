import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoreProvider } from '../store';
import { Welcome } from './Welcome';

const html = renderToStaticMarkup(
  <StoreProvider>
    <Welcome />
  </StoreProvider>,
);

describe('Welcome keeps its safety and privacy notes', () => {
  it('names crisis support', () => {
    expect(html).toContain('988');
    expect(html).toContain('https://findahelpline.com');
  });

  it('keeps the not-medical-advice disclaimer and its checkbox', () => {
    expect(html).toContain('not therapy or a diagnosis');
    expect(html).toContain('I understand this is not a substitute for professional care.');
    expect(html).toMatch(/<input type="checkbox"/);
  });

  it('tells people about the anonymous usage counts and how to turn them off', () => {
    expect(html).toContain('anonymous usage');
    expect(html).toContain('Turn it off in Settings');
  });
});
