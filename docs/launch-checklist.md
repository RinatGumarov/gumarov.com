# Launch checklist — local quality gates

Recorded **2026-08-15** on the unpublished `gumarov.com` landing.

Evidence commit (contains the quality gates): `PENDING_EVIDENCE_SHA`. Identify it with `git log -1 --format='%H %s'`.

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

## Still open before public launch

- Personal activity photos remain placeholders
- Visual snapshots are Darwin-specific; Linux CI will need matching baselines in a later deployment task
- No GitHub remote, Pages, DNS, email routing, or production PostHog yet
