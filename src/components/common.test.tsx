import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SupportCard, SupportLine } from './common';

describe('support lines', () => {
  it('shows the same hotlines on AI errors as on a reply that flags support', () => {
    // An error can hide a reply that would have flagged support (the worker's spend
    // breaker caps the AI at its smallest model, which may decline), so it never shows less.
    const line = renderToStaticMarkup(<SupportLine />);
    const card = renderToStaticMarkup(<SupportCard lead="" />);
    for (const resource of ['988', '1-800-799-7233', 'findahelpline.com']) {
      expect(card).toContain(resource);
      expect(line).toContain(resource);
    }
  });
});
