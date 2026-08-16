import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

// Node 25 defines a global localStorage on its own, and Vitest only copies a
// jsdom window key onto the global when Node has not already claimed it, so
// jsdom's Storage never lands on `window` and the tests get Node's inert stub.
// Turning Web Storage off in the test workers keeps them on the jsdom Storage
// that Node 22 — the version this project pins — gives us. Guarded so a future
// Node that drops the flag skips it instead of refusing to start. Forks only:
// worker threads reject exec argv that changes the process.
const workerExecArgv = process.allowedNodeEnvironmentFlags.has(
  '--no-experimental-webstorage',
)
  ? ['--no-experimental-webstorage']
  : [];

export default defineConfig({
  appType: 'mpa',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Nested git worktrees (e.g. .claude/worktrees/*) carry their own copy of
    // this suite; without this they are collected twice and e2e specs leak in.
    exclude: [...configDefaults.exclude, 'tests/e2e/**', '**/.claude/**'],
    globals: true,
    poolOptions: {
      forks: { execArgv: workerExecArgv },
    },
    setupFiles: './vitest.setup.ts',
  },
});
