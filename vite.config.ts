import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps asset paths relative so the built app works from any
// subpath (e.g. GitHub Pages at /personality-trainer/) or a plain file server.
export default defineConfig({
  base: './',
  plugins: [react()],
});
