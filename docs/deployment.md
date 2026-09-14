# Deployment

## Hosting

- The artifact is `dist/` from `pnpm build`, published to GitHub Pages by
  `.github/workflows/deploy.yml` on every push to `main`.
- Pages source must be **GitHub Actions**, not a branch.
- `public/CNAME` holds the custom domain; `public/.nojekyll` keeps Pages from
  rewriting Vite's asset paths, so the upload step includes hidden files.
- DNS records stay **DNS only** — no Cloudflare proxy. The proxy measurably
  degraded access from Russia.

Two details in `deploy.yml` are deliberate:

- The production `pnpm build` runs **after** `pnpm test:e2e`, because
  Playwright's `webServer` rebuilds `dist/` with a placeholder analytics key.
  `check-dist.mjs` fails the build if that token ever reaches the output.
- `concurrency: production` with `cancel-in-progress: false`, so a running
  production deploy is never cancelled halfway.

Visual snapshots are recorded on macOS; the Linux CI job skips that spec.

## Rollback

1. Find the last green production SHA from the Pages deployment history, or
   from `git log` plus the matching successful `Deploy` run.
2. Prefer a workflow dispatch against that ref: Actions → Deploy → Run workflow.
3. Otherwise `git revert <bad-sha>` on `main` and let the normal deploy run.
4. After the replacement deploy, check HTTPS, `/en/`, `/ru/` and both contact
   links.
