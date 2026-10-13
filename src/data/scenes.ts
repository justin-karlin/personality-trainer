// The science-card illustrations: SVG files coloured with the app's CSS variables
// (so they follow light and dark mode) and animated with the scene motion classes in
// styles.css. Kept in their own chunk, loaded when the Science page first needs them.
const FILES = import.meta.glob('../assets/scenes/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export const SCENES: Record<string, string> = Object.fromEntries(
  Object.entries(FILES).map(([path, svg]) => [path.replace(/^.*\/(.+)\.svg$/, '$1'), svg]),
);
