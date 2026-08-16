import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  appType: 'mpa',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Nested git worktrees (e.g. .claude/worktrees/*) carry their own copy of
    // this suite; without this they are collected twice and e2e specs leak in.
    exclude: [...configDefaults.exclude, 'tests/e2e/**', '**/.claude/**'],
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
});
