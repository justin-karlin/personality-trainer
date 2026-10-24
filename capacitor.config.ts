import type { CapacitorConfig } from '@capacitor/cli';

// The App Store build: the same web app, bundled from dist/ into a native iOS shell.
// appId is permanent once the app is registered with Apple; change it before then if needed.
const config: CapacitorConfig = {
  appId: 'io.github.justinkarlin.trait5',
  appName: 'Trait5',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      iconColor: '#1F5A45',
    },
  },
};

export default config;
