import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

// Node 25 defines its own global localStorage, and Vitest leaves it in place
// instead of jsdom's, so component tests get an inert stub. Turning Web Storage
// off in the workers keeps them on jsdom's. Guarded because a later Node may
// drop the flag, and forks only: worker threads reject exec argv.
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
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    globals: true,
    poolOptions: {
      forks: { execArgv: workerExecArgv },
    },
    setupFiles: './vitest.setup.ts',
  },
});
