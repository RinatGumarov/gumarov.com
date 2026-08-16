import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // Nested git worktrees carry a copy of this suite; never run it twice.
  testIgnore: ['**/.claude/**'],
  timeout: 60_000,
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.02,
    },
  },
  webServer: {
    command:
      'pnpm build:client && pnpm build:ssr && pnpm prerender && pnpm preview --host 127.0.0.1 --port 4173',
    env: {
      VITE_POSTHOG_KEY: 'phc_playwright_public_transport_token',
      VITE_POSTHOG_HOST: 'https://eu.i.posthog.com',
    },
    port: 4173,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: {
      args: ['--host-resolver-rules=MAP eu.i.posthog.com ~NOTFOUND'],
    },
  },
});
