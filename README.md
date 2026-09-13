# gumarov.com

The source for [gumarov.com](https://gumarov.com) — a bilingual (EN/RU) personal
landing page for Rinat Gumarov, Senior Frontend Engineer.

Built with React 19, TypeScript and Vite, statically prerendered to three
routes (`/`, `/en/`, `/ru/`) and served from GitHub Pages.

## Development

Node 22 and pnpm 10:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

| Command                | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `pnpm dev`             | Vite dev server.                                    |
| `pnpm build`           | Client + SSR build, prerender, distribution checks. |
| `pnpm preview`         | Serve the production build locally.                 |
| `pnpm test`            | Vitest unit and component tests.                    |
| `pnpm test:e2e`        | Playwright suite, including visual snapshots.       |
| `pnpm test:a11y`       | Just the axe accessibility suite.                   |
| `pnpm test:lighthouse` | Lighthouse CI against the built preview.            |
| `pnpm verify`          | format → lint → typecheck → test → build.           |

## Engineering notes

**Static first.** `entry-server.tsx` renders each locale to HTML at build time;
`scripts/prerender.mjs` injects it along with localized head metadata and
inlines the stylesheet. The page is complete before any JavaScript runs — every
heading, project link and contact detail is in the served markup. The client
bundle only hydrates, and if hydration throws, `entry-client.tsx` restores the
server markup rather than leaving a half-mounted page.

**Progressive enhancement, not feature detection theatre.** Motion,
`IntersectionObserver`-driven reveals, the pointer parallax and the hero's WebGL
layer are all additive. Missing `matchMedia`, a missing observer, blocked
images, unavailable storage or `prefers-reduced-motion` each leave the page in
its finished, readable state. The single motion gate lives in `App` and is
passed down, so nothing else mutates the document root.

**The hero ribbon.** The composition is SVG, server-rendered, and is what a
visitor sees without JavaScript, with reduced motion, on touch, or without
WebGL. Its pointer response is six CSS custom properties damped by a
`transition` — no frame loop, so it costs nothing at rest. A WebGL refraction
layer is imported lazily, only after a fine pointer moves inside a visible hero,
and crossfades over the SVG; context loss falls back to the SVG with no visible
break.

**Fonts and LCP.** Onest and IBM Plex Mono are self-hosted and loaded _after_
first paint from `/assets/fonts/faces.css`, so the LCP heading never waits on a
download. What it paints in is a metric-adjusted fallback declared in
`tokens.css` — `local()` sources only, so it costs no request — that scales an
installed font to Onest's own ascent, descent and advance width, so the swap
does not reflow the page out from under someone who is already reading. It is
best effort — a machine with none of the named faces falls through to the raw
system stack — so a Playwright test covers what always holds instead: the
Russian heading breaks no word and overflows no viewport, in both font states.

**Images.** `scripts/process-images.mjs` generates AVIF/WebP/JPEG derivatives at
fixed widths from fixed crop rectangles (no gravity heuristics, so re-running
cannot silently re-frame a photo) and strips all metadata. Originals live in the
ignored `assets-source/` directory and are not committed.

**Analytics.** PostHog, EU region, cookieless and without persistence. Events go
through a runtime allowlist in `src/lib/analytics.ts`: four event names, a fixed
property set per event, URLs stripped of query and hash, and Do Not Track
honoured before the provider is even loaded. A Playwright test decodes the
actual ingestion payloads and fails if anything outside the allowlist leaves the
browser.

**Budgets.** `scripts/check-dist.mjs` runs at the end of every build and fails it
on an incomplete prerender, authored content that never reached the page,
render-blocking CSS or webfonts on the critical path, or a route exceeding
150 KiB of compressed JavaScript / 700 KiB initial transfer. Lighthouse CI
asserts ≥ 0.9 in all four categories plus LCP and CLS ceilings.

## Deployment

GitHub Actions builds and publishes `dist/` to GitHub Pages on every push to
`main`. See [docs/deployment.md](docs/deployment.md) for the runbook and
rollback procedure.

## A note on tooling

This project was built with heavy use of AI coding assistants. The architecture,
the engineering constraints above and the review of what shipped are mine.

## License

[MIT](LICENSE). The photographs, the portrait and the brand marks are not
covered by it.
