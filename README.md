# gumarov.com

The source for [gumarov.com](https://gumarov.com) — my personal landing page,
bilingual EN/RU, statically prerendered and served from GitHub Pages.

React 19, TypeScript, Vite. No framework on top, no CSS library, no state
manager: the page is mostly markup, and the JavaScript that ships is there to
enhance it.

## Development

Node 22+ and pnpm 10:

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
| `pnpm test:e2e`        | Playwright, including visual snapshots.             |
| `pnpm test:lighthouse` | Lighthouse CI against the built preview.            |
| `pnpm verify`          | format → lint → typecheck → test → build.           |

`pnpm media` regenerates image derivatives from `assets-source/` (not
committed); `scripts/process-images.mjs` documents the modes.

## Architecture

**Static first.** `entry-server.tsx` renders each locale at build time and
`scripts/prerender.mjs` writes three routes — `/`, `/en/`, `/ru/` — injecting
localized head metadata and inlining the stylesheet. Every heading, project
link and contact detail is in the served markup; the client bundle only
hydrates, and if hydration throws, `entry-client.tsx` puts the server markup
back rather than leaving a half-mounted page. `/` additionally carries a small
inline script that redirects a Russian-preferring visitor to `/ru/`.

**Progressive enhancement.** Motion, the `IntersectionObserver` reveals, the
pointer parallax and the hero's WebGL layer are all additive. A missing
`matchMedia` or observer, blocked images, unavailable storage or
`prefers-reduced-motion` each leave the page in its finished, readable state.
There is one motion gate, in `App`, and its answer is passed down.

**The hero ribbon.** The composition is SVG, server-rendered, and is what a
visitor sees without JavaScript, with reduced motion, on touch, or without
WebGL. Its pointer response is six CSS custom properties damped by a
`transition` — no frame loop, so it costs nothing at rest. A WebGL refraction
layer is imported lazily, only after a fine pointer moves inside a visible
hero, and crossfades over the SVG; context loss falls back to it with no
visible break.

Its two `feGaussianBlur` filters were the one real performance problem on this
page. WebKit re-runs SVG filters in software whenever the filtered subtree is
re-rendered, and the stage re-renders on every frame of the pointer response:
130 ms per frame in Safari against a 16.7 ms budget. The depth shadow moved to
its own layer blurred with a CSS filter the compositor can cache, and the lit
edge's bloom is drawn as eight stacked strokes summing to the Gaussian it
replaces. 19 ms per frame, p95 21 ms, nothing over 32 ms.

**Fonts and LCP.** Onest and IBM Plex Mono are self-hosted and loaded _after_
first paint, so the LCP heading never waits on a download. It paints in a
metric-adjusted fallback declared in `tokens.css` — `local()` sources only, so
it costs no request — that scales an installed font to Onest's own metrics, so
the swap does not reflow the page under someone already reading. It is best
effort, so a Playwright test covers what always holds instead: the Russian
heading breaks no word and overflows no viewport, in both font states.

**Images.** `scripts/process-images.mjs` generates AVIF/WebP/JPEG derivatives at
fixed widths from fixed crop rectangles — no gravity heuristics, so re-running
cannot silently re-frame a photo — and strips all metadata, which for personal
photographs means capture times and GPS coordinates.

**Analytics.** PostHog, EU region, cookieless and without persistence. Four
event names with a fixed property set each, URLs stripped of query and hash,
Do Not Track honoured before the provider is even loaded. `before_send`
rebuilds every outgoing event from an allowlist, so anything the SDK attaches
on its own is dropped; a Playwright test decodes the real ingestion payloads
and fails if anything outside that list leaves the browser.

## Testing and deployment

Vitest covers the content model, the hooks and the components. Playwright
covers the things only a browser can answer: no-JS and blocked-asset
resilience, reduced motion, keyboard traversal, axe, Russian typography in both
font states, the frame budget under CPU throttling, the analytics payloads, and
six full-page visual snapshots. `scripts/check-dist.mjs` runs at the end of
every build and fails it on an incomplete or mislocalized prerender,
render-blocking CSS or webfonts on the critical path, or a JavaScript budget
overrun. Lighthouse CI asserts the category scores, LCP, CLS and page weight;
it is run by hand rather than in CI, because its simulated throttling scales
with the host's measured CPU speed and a loaded machine moves LCP by a second.

GitHub Actions publishes `dist/` to Pages on every push to `main`; see
[docs/deployment.md](docs/deployment.md) for the runbook and rollback.

## AI-assisted development

This project was built with extensive use of AI coding assistants. I use them
for implementation, exploration and review; architecture, trade-offs,
verification and what ultimately ships remain my responsibility.

## License

[MIT](LICENSE). The photographs, the portrait and the brand marks are not
covered by it.
