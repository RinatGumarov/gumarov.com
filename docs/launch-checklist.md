# Launch checklist — local quality gates

Recorded **2026-08-15** on the unpublished `gumarov.com` landing.

Evidence commit (contains the quality gates): `PENDING_EVIDENCE_SHA`. Identify it with `git log -1 --format='%H %s'`. A follow-up docs commit may only fill this SHA.

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
- Vitest: **16 files, 141 tests passed**
- Production build: passed
- Distribution check: **3 routes, 110.7 KiB compressed JavaScript, worst initial transfer `ru/index.html` 225.5 KiB** (budgets: JS ≤ 150 KiB, initial transfer ≤ 700 KiB, hero ≤ 300 KiB)

## `pnpm test:e2e`

Playwright Chromium against the prerendered preview on `127.0.0.1:4173`.

- **50 passed** (landing, accessibility, resilience, visual, plus existing analytics, hero-image, and motion suites)
- Locales: `/en/` and `/ru/`
- Viewports: 390×844, 768×1024, 1440×1000
- Visual baselines reviewed at those sizes before commit (`tests/e2e/visual.spec.ts-snapshots/`, Darwin PNG snapshots)
- Preview server was not left running

## Lighthouse CI (`pnpm exec lhci autorun`)

Built preview, mobile form factor, **default Lantern simulate** throttling (not DevTools), 3 runs per URL.

Median scores (all category scores are 1.00 / 100):

| URL    | Performance | Accessibility | Best practices |  SEO |     LCP | CLS |
| ------ | ----------: | ------------: | -------------: | ---: | ------: | --: |
| `/`    |        1.00 |          1.00 |           1.00 | 1.00 | 1653 ms |   0 |
| `/en/` |        1.00 |          1.00 |           1.00 | 1.00 | 1652 ms |   0 |
| `/ru/` |        1.00 |          1.00 |           1.00 | 1.00 | 1652 ms |   0 |

Gates: category scores ≥ 0.90, LCP ≤ 2500 ms, CLS < 0.1.

Simulate LCP is the hero heading. Observed LCP on the same documents is ~100 ms; Lantern was previously stuck around 2550–2700 ms while webfonts (preload / `@font-face` / startup fetch) sat on the first-paint path. Critical CSS now paints with system fonts; Onest is not referenced in inlined CSS and is not fetched from the client entry.

## Still open before public launch

- Personal activity photos remain placeholders
- Visual snapshots are Darwin-specific; Linux CI will need matching baselines in a later deployment task
- No GitHub remote, Pages, DNS, email routing, or production PostHog yet
