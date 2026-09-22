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

Two more scripts write committed files, so they are run by hand rather than in
the build: `pnpm media` regenerates image derivatives from `assets-source/`
(not committed, modes documented in `scripts/process-images.mjs`), and
`pnpm fonts:subset` rebuilds the two preloaded subsets from the variable faces.

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

**Fonts and LCP.** Both faces are self-hosted and both ship with the document.
`scripts/subset-fonts.mjs` cuts each variable face down to the Latin and
Cyrillic this site is written in, over the weights it actually sets: Onest from
82 KB to 27 KB, still one variable face across 400–700, and IBM Plex Mono from
82 KB to 17 KB, the single instance at 700 that `--type-label` asks for. Both
subsets are preloaded in `index.html` and declared in the inlined CSS with
`font-display: optional`, so the page paints in its own typefaces on the first
frame — and on the visit where a file misses that frame it is not used at all,
rather than replacing the text half a second later.

Behind each face sits a metric-adjusted fallback declared in `tokens.css` —
`local()` sources only, so it costs no request — that scales an installed font
to the real face's metrics, for the visit where the subset does not arrive in
time. It is best effort, so Playwright covers what always holds instead: the
Russian heading breaks no word and overflows no viewport in either font state,
and no watched element changes family, width or position after the first frame,
on an ordinary load and with both files delayed past it.

**Type.** Two voices, both declared in `tokens.css`. Onest carries the
headings and the text; the headings sit on three steps — display (the h1 and
the closing invitation), section (every other h2), title (every project name)
— with one weight and one tracking, so a new size never reads as a new face.
IBM Plex Mono is the label voice: every eyebrow, index, tag and small link is
the one `--type-label` setting, and only its colour varies — amber leads a
block, subtle annotates one, muted marks navigation. The project scenes share
the page's cyan; a project's identity is in its capture, not in an accent of
its own.

**Images.** `scripts/process-images.mjs` generates AVIF/WebP/JPEG derivatives at
fixed widths from fixed crop rectangles — no gravity heuristics, so re-running
cannot silently re-frame a photo — and strips all metadata, which for personal
photographs means capture times and GPS coordinates.

**Analytics.** PostHog, EU region, cookieless and without persistence. Four
event names with a fixed property set each, URLs stripped of query and hash,
Do Not Track honoured before the provider is even loaded. A landing is an
arrival: a page reached from the site itself (a language switch) sends none,
and the root redirect hands the original referrer's origin to `/ru/` through
`sessionStorage`, where it is read once and removed. `before_send`
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
render-blocking CSS, anything on the critical path beyond the one preloaded
font subset, or a JavaScript budget overrun. Lighthouse CI asserts the category scores, LCP, CLS and page weight;
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
