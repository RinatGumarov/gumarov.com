import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseGithubWorkflow } from './parse-github-workflow.mjs';

const workflowDirectory = path.resolve(process.cwd(), '.github/workflows');
const packageManifest = JSON.parse(
  await readFile(path.resolve(process.cwd(), 'package.json'), 'utf8'),
);

describe('GitHub Pages workflows', () => {
  it('parses CI and deploy YAML and only calls existing package scripts', async () => {
    const ciSource = await readFile(
      path.join(workflowDirectory, 'ci.yml'),
      'utf8',
    );
    const deploySource = await readFile(
      path.join(workflowDirectory, 'deploy.yml'),
      'utf8',
    );
    const ci = parseGithubWorkflow(ciSource);
    const deploy = parseGithubWorkflow(deploySource);

    expect(ci.permissions).toEqual({ contents: 'read' });
    expect(deploy.permissions).toEqual({ contents: 'read' });
    expect(deploy.concurrency).toEqual({
      group: 'production',
      'cancel-in-progress': false,
    });

    const ciSteps = ci.jobs.verify.steps;
    const buildSteps = deploy.jobs.build.steps;
    expect(packageScriptsFromSteps(ciSteps)).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm exec playwright install --with-deps chromium',
      'pnpm verify',
      'pnpm test:e2e',
    ]);
    expect(packageScriptsFromSteps(buildSteps)).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm exec playwright install --with-deps chromium',
      'pnpm verify',
      'pnpm test:e2e',
      // Replaces the Playwright build before the artifact is uploaded.
      'pnpm build',
    ]);

    for (const command of [
      ...packageScriptsFromSteps(ciSteps),
      ...packageScriptsFromSteps(buildSteps),
    ]) {
      const script = command.match(/^pnpm ([a-z0-9:-]+)$/u)?.[1];
      if (script && script !== 'install' && script !== 'exec') {
        expect(packageManifest.scripts).toHaveProperty(script);
      }
    }

    const upload = buildSteps.find(
      (step) => step.uses === 'actions/upload-pages-artifact@v5',
    );
    expect(upload.with).toEqual({
      path: 'dist',
      'include-hidden-files': true,
    });

    const deployJob = deploy.jobs.deploy;
    expect(deployJob.needs).toBe('build');
    expect(deployJob.permissions).toEqual({
      pages: 'write',
      'id-token': 'write',
    });
    expect(deployJob.steps[0].uses).toBe('actions/deploy-pages@v4');
  });

  /*
   * `pnpm test:e2e` rebuilds `dist` through Playwright's webServer with a
   * placeholder analytics key, so whatever ran last before the upload is what
   * ships. The artifact must come from a production build that runs after the
   * end-to-end suite and carries the real analytics configuration.
   */
  it('rebuilds the artifact after the end-to-end suite', async () => {
    const deploy = parseGithubWorkflow(
      await readFile(path.join(workflowDirectory, 'deploy.yml'), 'utf8'),
    );
    const steps = deploy.jobs.build.steps;

    const e2eIndex = steps.findIndex((step) => step.run === 'pnpm test:e2e');
    const rebuildIndex = steps.findIndex(
      (step, index) => index > e2eIndex && step.run === 'pnpm build',
    );
    const uploadIndex = steps.findIndex(
      (step) => step.uses === 'actions/upload-pages-artifact@v5',
    );

    expect(e2eIndex).toBeGreaterThanOrEqual(0);
    expect(
      rebuildIndex,
      'no production rebuild between test:e2e and the artifact upload',
    ).toBeGreaterThan(e2eIndex);
    expect(uploadIndex).toBeGreaterThan(rebuildIndex);

    const rebuild = steps[rebuildIndex];
    expect(rebuild.env?.VITE_POSTHOG_KEY).toBe('${{ vars.VITE_POSTHOG_KEY }}');
    expect(rebuild.env?.VITE_POSTHOG_HOST).toBe(
      '${{ vars.VITE_POSTHOG_HOST }}',
    );
  });

  /*
   * The first CI run stalled for 25 minutes inside
   * `playwright install --with-deps`, which shells out to apt and can block on
   * a package lock held by the runner image. Without a ceiling GitHub lets a
   * stuck job occupy a runner for the 360-minute default.
   */
  it('bounds every job and the apt-backed browser install', async () => {
    const ci = parseGithubWorkflow(
      await readFile(path.join(workflowDirectory, 'ci.yml'), 'utf8'),
    );
    const deploy = parseGithubWorkflow(
      await readFile(path.join(workflowDirectory, 'deploy.yml'), 'utf8'),
    );

    for (const workflow of [ci, deploy]) {
      for (const [name, job] of Object.entries(workflow.jobs)) {
        expect(
          typeof job['timeout-minutes'],
          `job ${name} has no timeout-minutes`,
        ).toBe('number');
        expect(job['timeout-minutes']).toBeLessThanOrEqual(30);
      }
    }

    for (const steps of [ci.jobs.verify.steps, deploy.jobs.build.steps]) {
      const install = steps.find((step) =>
        step.run?.includes('playwright install'),
      );
      expect(typeof install['timeout-minutes']).toBe('number');
      expect(install['timeout-minutes']).toBeLessThanOrEqual(10);
    }
  });
});

function packageScriptsFromSteps(steps) {
  return steps
    .map((step) => step.run)
    .filter(
      (command) => typeof command === 'string' && command.startsWith('pnpm '),
    );
}
