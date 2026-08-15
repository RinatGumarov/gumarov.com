# Launch checklist — local quality gates

Recorded **2026-08-15** on the unpublished `gumarov.com` landing.

Evidence commit (contains the quality gates): `4b895bb60722f51541b0ae37fe498ee059e728e9` (`fix: load brand fonts after first paint`). Identify this docs note with `git log -1 --format='%H %s'`.

No remotes, DNS, or analytics were enabled.

## Commands

```bash
pnpm verify && pnpm test:e2e
pnpm exec lhci autorun
```

## `pnpm verify`

- Prettier: all matched files use Prettier code style
- ESLint: passed with `--max-warnings=0`
- Typecheck: passed
- Vitest: **16 files, 142 tests passed**
- Production build: passed
- Distribution check: **3 routes, 110.8 KiB compressed JavaScript, worst initial transfer `ru/index.html` 225.6 KiB** (budgets: JS ≤ 150 KiB, initial transfer ≤ 700 KiB, hero ≤ 300 KiB)

## `pnpm test:e2e`

Playwright Chromium against the prerendered preview on `127.0.0.1:4173`.

- **51 passed** (landing, accessibility, resilience, visual, plus existing analytics, hero-image, and motion suites)
- Locales: `/en/` and `/ru/`
- Viewports: 390×844, 768×1024, 1440×1000
- Visual baselines reviewed at those sizes before commit (`tests/e2e/visual.spec.ts-snapshots/`, Darwin PNG snapshots). They now include deferred Onest / IBM Plex Mono after first paint; the hero `h1` stays on system fonts.
- Preview server was not left running

## Lighthouse CI (`pnpm exec lhci autorun`)

Built preview, mobile form factor, explicit Lantern **`throttlingMethod: 'simulate'`**, 3 runs per URL. Assertions use the median run.

Median scores:

| URL    | Performance | Accessibility | Best practices |  SEO |     LCP |     CLS |
| ------ | ----------: | ------------: | -------------: | ---: | ------: | ------: |
| `/`    |        0.99 |          1.00 |           0.96 | 1.00 | 2124 ms | 0.00008 |
| `/en/` |        0.99 |          1.00 |           0.96 | 1.00 | 2122 ms | 0.00008 |
| `/ru/` |        0.99 |          1.00 |           0.96 | 1.00 | 1973 ms | 0.00008 |

Gates: category scores ≥ 0.90, LCP ≤ 2500 ms, CLS < 0.1.

Simulate LCP remains the hero heading (`#hero-heading`), which is locked to `ui-sans-serif, system-ui` in first-paint CSS. Observed LCP is ~90 ms. Brand faces load after `load` + `requestIdleCallback` from `/assets/fonts/faces.css` (`font-display: swap` plus size-adjusted local fallbacks) so body/mono/display type can use Onest and IBM Plex Mono without putting a webfont on the LCP element. One simulate run per URL can spike near 3000 ms; the median stays under the gate.

## Task 14 preparation, 2026-08-15

Run with Node `22.22.2` (the repository pins Node 22; Node 25 replaces jsdom's
`localStorage` with a stub and fails seven storage tests locally).

- Approved personal photographs replaced the placeholders. `pnpm verify`:
  Prettier, ESLint, typecheck, **17 files / 156 tests**, production build,
  distribution check (**3 routes, 111.1 KiB JS, worst transfer `ru/index.html`
  226.0 KiB**).
- `pnpm test:e2e`: **59 passed**, including the new
  `tests/e2e/hero-typography.spec.ts` gate that no hero word breaks mid-word at
  320/390/768/1440px in either locale.
- Russian visual baselines were re-recorded after the Russian hero measure fix
  and reviewed before commit.
- Known gate gap: the personal photographs are `loading="lazy"` and sit below
  the fold, so Chromium's `fullPage` screenshot does not load them. The visual
  baselines therefore do not cover that strip; it was verified separately by
  scrolling the section into view in Chromium and confirming all three images
  reach `complete` with non-zero intrinsic size.

## Task 14 publication, 2026-08-15

Public repository `RinatGumarov/gumarov.com` created and `main` pushed. Pages
source set to **GitHub Actions** (`build_type: workflow`).

- Deployed SHA `29d6bd672ba6f506e53809ace8391ed1cc418fbd`, matching local `HEAD`
  and remote `main`.
- `CI` and `Deploy` both green on that SHA (3m42s / 4m51s).
- `https://rinatgumarov.github.io/gumarov.com/` and `/ru/` return `200`; the
  artifact serves `CNAME` containing `gumarov.com`.
- Root-absolute `/assets/**` paths return `404` at the project URL by design;
  they resolve once the apex domain points at Pages.

### First-run CI failures, both fixed

1. `pnpm verify` failed on shared runners: the Sharp encoding and
   subprocess-spawning suites in `scripts/` exceed Vitest's 5s default there.
   Both now declare a 60s suite ceiling.
2. `CI` stalled 25 minutes inside `playwright install --with-deps`, which
   shells out to apt. No job declared `timeout-minutes`, so a stall could hold
   a runner for GitHub's 360-minute default. Every job is now bounded, that
   step to 8 minutes, and `scripts/workflows.test.mjs` enforces it.

### Blocked on DNS

`PUT /repos/RinatGumarov/gumarov.com/pages` with `cname=gumarov.com` returns
`404 The certificate does not exist yet`: GitHub will not attach the custom
domain until the apex resolves to Pages and a certificate can be issued. The
zone is on Cloudflare nameservers (`dara`/`nero.ns.cloudflare.com`) with no
apex A record yet.

Remaining order: apex `A`/`AAAA` plus `www` `CNAME` as **DNS only** → set the
custom domain → wait for certificate issuance → enable Enforce HTTPS → verify
`http`→`https`, apex, `www`, `/en/`, `/ru/`, and unknown paths → Russian access
probes → production Lighthouse.

## Still open before public launch

- Visual snapshots are Darwin-specific; Linux CI skips the visual file until matching baselines exist
- Cloudflare DNS records, custom domain attachment, Enforce HTTPS, email routing, and production PostHog are still pending

## GitHub Actions (local files only)

Workflows live in `.github/workflows/` and are documented in `docs/deployment.md`. They have not been pushed.

Task 13 local verification, **2026-08-15**:

- `pnpm verify`: Prettier, ESLint, typecheck, **17 files / 146 tests**, production build, distribution check (**3 routes, 110.8 KiB JS, worst transfer `ru/index.html` 225.5 KiB**). `CNAME` and `.nojekyll` are required in `dist/`.
- `pnpm test:e2e`: **51 passed**
- SHA of the workflows commit: `944ccd0d7cc228673b07c23f1ed7bcfee6b75bf2` (`ci: prepare GitHub Pages deployment`).
