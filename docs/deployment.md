# Deployment

Local quality gates and GitHub Pages workflows are prepared in this
repository. Creating the public remote, changing Cloudflare DNS, enabling
analytics, or pointing `gumarov.com` at Pages still requires an explicit
Task 14 approval. This file is the reversible-deploy runbook, not permission
to publish.

## Hosting contract

- Static artifact: `dist/` from `pnpm build` (`build:client`, `build:ssr`,
  `prerender`, `scripts/check-dist.mjs`).
- Custom domain file: `public/CNAME` contains only `gumarov.com`.
- `public/.nojekyll` keeps Vite asset paths unchanged on Pages.
- Pages source must be **GitHub Actions**, not a branch.
- Website DNS records stay **DNS only** (no Cloudflare proxy) until a later
  measured Russian-access regression says otherwise.

## Workflows

| Workflow                       | Trigger                               | Permissions                                                              | What it runs                                                                       |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`     | `push` to `main`, pull requests       | `contents: read`                                                         | frozen install, Playwright Chromium, `pnpm verify`, `pnpm test:e2e`                |
| `.github/workflows/deploy.yml` | `push` to `main`, `workflow_dispatch` | workflow `contents: read`; deploy job `pages: write` + `id-token: write` | same gates, upload `dist/` with hidden files (`.nojekyll`), `actions/deploy-pages` |

Deploy concurrency group `production` does not cancel an in-flight production
deploy (`cancel-in-progress: false`). Visual snapshots are Darwin-only; the
Linux CI job skips that Playwright file until Linux baselines exist.

## Rollback

Never force-push `main`.

1. Identify the last green production SHA from the Pages deployment history
   or from `git log` on `main` together with the matching successful
   `Deploy` run.
2. Prefer GitHub's workflow dispatch against that ref: Actions → Deploy →
   Run workflow → use the known-good SHA / tag.
3. If dispatch against the old ref is unavailable, revert the bad commit
   with a new reviewed commit on `main` (`git revert <bad-sha>`) and let
   the normal `main` deploy run. Do not rewrite history.
4. After the replacement deploy finishes, re-run production checks from
   Task 14 (HTTPS, `/en/`, `/ru/`, contacts, Lighthouse) before announcing
   the URL again.

## Local verification before a deploy SHA

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm test:e2e
git rev-parse HEAD
```
