# Deployment

## Hosting

- Static artifact: `dist/` from `pnpm build` (`build:client` → `build:ssr` →
  `prerender` → `scripts/check-dist.mjs`).
- `public/CNAME` holds the custom domain; `public/.nojekyll` keeps Pages from
  rewriting Vite's asset paths. The upload step includes hidden files so
  `.nojekyll` reaches the artifact.
- Pages source must be **GitHub Actions**, not a branch.
- DNS records stay **DNS only** (no Cloudflare proxy) — the proxy measurably
  degraded access from Russia.

## Workflows

| Workflow                       | Trigger                               | What it runs                                                         |
| ------------------------------ | ------------------------------------- | -------------------------------------------------------------------- |
| `.github/workflows/ci.yml`     | `push` to `main`, pull requests       | `pnpm verify`, `pnpm test:e2e`                                       |
| `.github/workflows/deploy.yml` | `push` to `main`, `workflow_dispatch` | the same gates, then a production rebuild and `actions/deploy-pages` |

Two details in `deploy.yml` are deliberate:

- The production `pnpm build` runs **after** `pnpm test:e2e`. Playwright's
  `webServer` rebuilds `dist/` with a placeholder analytics key, so without the
  rebuild that placeholder would be what ships. `check-dist.mjs` fails the build
  if the placeholder token ever appears in the output.
- `concurrency: production` with `cancel-in-progress: false`, so a running
  production deploy is never cancelled halfway.

Visual snapshots are recorded on Darwin; the Linux CI job skips that spec.

## Rollback

Never force-push `main`.

1. Find the last green production SHA from the Pages deployment history or from
   `git log` plus the matching successful `Deploy` run.
2. Prefer a workflow dispatch against that ref: Actions → Deploy → Run workflow.
3. If that is unavailable, `git revert <bad-sha>` on `main` and let the normal
   deploy run. Do not rewrite history.
4. After the replacement deploy, check HTTPS, `/en/`, `/ru/`, both contact links
   and Lighthouse before announcing the URL again.

## Before cutting a deploy SHA

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm test:e2e
```
