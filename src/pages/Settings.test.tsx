import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const native = vi.hoisted(() => ({ on: false }));
vi.mock('../lib/native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/native')>()),
  isNative: () => native.on,
}));

const { StoreProvider } = await import('../store');
const { Settings } = await import('./Settings');

const render = () =>
  renderToStaticMarkup(
    <StoreProvider>
      <Settings />
    </StoreProvider>,
  );

afterEach(() => {
  native.on = false;
});

describe('Settings → Your data', () => {
  it('offers Export backup on the website', () => {
    expect(render()).toContain('Export backup');
  });

  it("doesn't offer Export backup in the iPhone app, where the web view can't download files", () => {
    native.on = true;
    const html = render();
    expect(html).not.toContain('Export backup');
    expect(html).toContain('Deleting the app erases it');
  });
});
