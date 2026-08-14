import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command:
      'pnpm build:client && pnpm build:ssr && pnpm prerender && pnpm preview --host 127.0.0.1 --port 4173',
    env: {
      VITE_POSTHOG_KEY: 'phc_playwright_public_transport_token',
      VITE_POSTHOG_HOST: 'https://eu.i.posthog.com',
    },
    port: 4173,
    reuseExistingServer: false,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: {
      args: ['--host-resolver-rules=MAP eu.i.posthog.com ~NOTFOUND'],
    },
  },
});
