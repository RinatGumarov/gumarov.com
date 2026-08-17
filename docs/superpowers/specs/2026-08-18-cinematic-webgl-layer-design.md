# Cinematic WebGL layer — design

Recorded **2026-08-18** against `ba807c7`.

The landing gains a cinematic motion layer: one persistent WebGL canvas, an
interactive 3D object, shader-distorted project imagery, particles that morph
across sections, scroll-driven scenes, variable-font reveals, magnetic buttons
and a custom cursor. Scroll, pointer, typography and WebGL share one state
object and visibly drive each other.

This is an additive layer. Section order, copy, approved imagery, the SSR and
prerender pipeline, the no-JavaScript contract and the locale model are
unchanged.

## Decisions taken before design

| Question           | Decision                                              | Reason                                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js or Vite    | Stay on Vite                                          | R3F, GSAP, Lenis, GLSL and the View Transitions API need nothing from Next.js. Migrating would discard the working SSR/prerender pipeline, the budget scripts and 193 tests for no gain in the requested effects. |
| Hand-written WebGL | Use `three` / `@react-three/fiber` / `gsap` / `lenis` | A hand-rolled WebGL2 renderer plus a hand-rolled scroll and tween layer is the option most likely to produce context-loss, shader-leak and iOS scroll bugs. Robustness was ranked above bundle size.              |
| Redesign depth     | Layer over the existing structure                     | Copy and imagery are approved and hash-pinned. Restructuring would reopen the content approval gate.                                                                                                              |
| Phones             | No WebGL below the tablet breakpoint                  | Lighthouse CI measures the performance gate on the mobile form factor. A persistent canvas there puts `performance >= 0.90` and `LCP <= 2500 ms` at risk.                                                         |

Pinned versions: `three@0.185.1`, `@react-three/fiber@9.7.0`, `gsap@3.15.0`,
`lenis@1.3.26`. `@react-three/drei` is **not** a dependency: this design needs
only a handful of its helpers, and writing those is cheaper than the chunk
`drei` adds.

## Architecture

### The conductor

`src/motion/conductor.ts` owns one `requestAnimationFrame` loop and one mutable
state object. The object is mutated in place and never replaced, so no consumer
allocates per frame and React never re-renders on frame data.

```ts
interface ConductorState {
  scroll: { y: number; progress: number; velocity: number; direction: 1 | -1 };
  pointer: {
    x: number;
    y: number;
    nx: number;
    ny: number;
    vx: number;
    vy: number;
    speed: number;
    down: boolean;
  };
  section: { index: number; id: string; progress: number };
  viewport: { width: number; height: number; dpr: number };
  time: { elapsed: number; delta: number };
  energy: number;
}
```

`energy` is the shared coupling term: a `0..1` value smoothed with an
exponential moving average over normalised scroll velocity and pointer speed.
It is the single number that makes the layers visibly influence each other —
faster movement means stronger shader displacement, heavier variable-font
weight and a longer cursor trail, all from one source.

Three consumers read the same frame:

1. **WebGL** reads the object directly inside `useFrame`.
2. **CSS** receives one write per frame of custom properties on
   `document.documentElement`: `--c-energy`, `--c-pointer-x`, `--c-pointer-y`,
   `--c-scroll-velocity`, `--c-section-progress`. Typography, cursor and border
   treatments read those in CSS, so no per-element JavaScript runs.
3. **GSAP `quickTo`** drives magnetic buttons and the cursor with spring
   easing.

Discrete state — active section, quality tier, whether WebGL is live — is
exposed through `useSyncExternalStore`, so React re-renders only when it
changes, never per frame.

The loop starts on first pointer or scroll interaction and stops on
`document.visibilityState !== 'visible'`. It is idempotent: repeated
`start()` calls do not create a second loop.

### Module boundaries

```
src/motion/
  conductor.ts      state object, the single RAF loop, CSS variable writes
  useConductor.ts   React bridge (useSyncExternalStore over discrete state)
  capabilities.ts   WebGL/device/reduced-motion detection, returns a tier
  quality.ts        tier definitions and the runtime downgrade controller
  lenis.ts          smooth scroll setup, feeds conductor.scroll
  cursor.tsx        custom cursor
  magnetic.ts       magnetic button behaviour
src/webgl/
  Stage.tsx         the <Canvas> and scene graph, the only lazy entry point
  scenes/HeroObject.tsx
  scenes/WorkPlanes.tsx
  scenes/ParticleField.tsx
  shaders/*.ts      GLSL as tagged template strings
```

`src/motion/**` is framework-only and never imports `three`.
`src/webgl/**` is never statically imported from anywhere. The single entry is
`import('./webgl/Stage')`, performed after first paint and only when the tier
is 1 or higher. Two consequences follow, and both are load-bearing:

- jsdom unit tests never load `three`, so the existing test environment needs
  no WebGL stub;
- phones and reduced-motion visitors never download the chunk.

An ESLint `no-restricted-imports` rule enforces that `src/webgl` is imported
only from the dynamic-import call site.

## Scenes

One canvas, `position: fixed`, `inset: 0`, `pointer-events: none`, painted
behind the DOM. Sections register with the conductor through a `data-scene`
attribute. Each screen carries one strong effect and two or three supporting
ones.

### Hero — interactive 3D object

A tessellated icosahedron displaced in the vertex shader by curl noise: a
liquid-graphite form with a cyan fresnel rim drawn from the existing token
palette. It leans toward the pointer by proximity, stretches along the scroll
axis by `scroll.velocity`, and breathes slowly at rest.

Supporting: line-by-line `h1` reveal with the variable font weight morphing
300 → 700 as each line lands; magnetic primary CTA; custom cursor.

The portrait stays a DOM `<picture>`. It is the LCP element and its responsive
source selection is already covered by tests and budgets; the canvas must not
take it over.

### Selected Work — shader distortion of project screenshots

Each project screenshot is mirrored into WebGL: a canvas plane is positioned on
the `<img>` bounding box, and the DOM image drops to `opacity: 0` only once the
plane is confirmed drawing. The fragment shader applies displacement driven by
scroll velocity, a pointer-centred hover ripple, and a slight RGB split at the
edge of the displacement.

Moving between projects morphs the plane's UV lookup between the two textures
rather than unmounting and remounting it, so the plane persists across the
whole section.

Supporting: the existing sticky column; copy revealed against
`section.progress`; the project index rendered inside the cursor.

### Work Principles — typography

Deliberately the quiet screen. WebGL dims to roughly 15% opacity. The strong
effect is type: a line-by-line mask reveal and a variable-font weight morph
driven by `section.progress`.

This section is intentionally under-decorated. Five consecutive screens with a
strong effect read as an engine demo rather than an engineer's site; the pause
is what makes the surrounding scenes land.

Supporting: a thin progress rule; letter-spacing shifted by `energy`.

### Personal Strip — particles and morphing

A particle cloud that gathers out of the hero object's silhouette into a
horizontal filmstrip as the section enters, and scatters as it leaves. The six
approved photographs stay DOM images with a wave distortion driven by scroll
velocity.

Supporting: cursor in drag state; inertial horizontal scrolling.

### Contact — closing the scene

The particles return and reassemble into the hero object, now at rest. This is
what makes the site one continuous living scene rather than five separate
effects: the same object travelled the whole scroll.

Supporting: magnetic Telegram and email buttons; cursor in copy state.

## Adaptive quality

`capabilities.ts` picks the starting tier once, before any WebGL code loads.

**Tier 0 — no WebGL.** Selected when any of these hold: viewport below `48rem`,
`prefers-reduced-motion: reduce`, no WebGL2 context,
`navigator.connection.saveData`, or a reported
`navigator.deviceMemory` below 4, or a reported
`navigator.hardwareConcurrency` below 4. The last two are advisory and absent in
several browsers; an absent value is not treated as a low value. CSS and GSAP
motion only, and the WebGL chunk is never requested.

`(pointer: coarse)` on its own does **not** force tier 0 — that would strip the
canvas from tablets, which are wide enough to carry it. A coarse pointer above
the phone breakpoint caps the tier at 1 and disables the hover-dependent
effects: the ripple, the magnetic buttons and the custom cursor.

| Tier | DPR cap | Particles | Post-processing |
| ---- | ------- | --------- | --------------- |
| 1    | 1       | 3,000     | none            |
| 2    | 1.5     | 12,000    | cheap bloom     |
| 3    | 2       | 30,000    | full            |

**Runtime downgrade.** `quality.ts` keeps a 90-frame rolling window of frame
durations. Two consecutive windows with a p95 above 20 ms drop the tier by one.
Recovery is deliberately asymmetric: a tier may be regained only after 10
seconds of continuous headroom and only once per session, so the scene cannot
oscillate between quality levels while someone is reading.

## Failure handling

| Condition                          | Behaviour                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| No WebGL2 context                  | Tier 0. The chunk is never fetched.                                                                                                       |
| `webglcontextlost`                 | Tier 0. Canvas is removed, DOM images return to `opacity: 1`.                                                                             |
| Shader compilation or link failure | Tier 0, same teardown path.                                                                                                               |
| Chunk fetch failure                | Tier 0. The page keeps working; no error surfaces to the visitor.                                                                         |
| JavaScript disabled                | Unchanged. The prerendered document already carries every visible string, and `check-dist.mjs` enforces it by stripping every `<script>`. |
| `prefers-reduced-motion: reduce`   | Tier 0 plus the existing `reduce` rules.                                                                                                  |

Every one of these converges on the same tier-0 code path that phones take on
every visit. The fallback is therefore exercised continuously in production
rather than only in tests.

DOM images must never be hidden before the canvas has proven it is drawing.
The teardown must restore them synchronously, matching the discipline already
applied to `data-motion-state`.

## View Transitions

The only honest use on this site is the locale switch. `/en/` and `/ru/` are
two separately prerendered documents, so moving between them is a real
cross-document navigation: `@view-transition { navigation: auto }` with
`view-transition-name` on the hero heading and the portrait.

There is no in-page routing, so same-document transitions are not used;
attaching them to anchor jumps would be decoration without navigation.

Known limitation, accepted: a cross-document transition tears down and
recreates the canvas. The scene seeds itself from the restored scroll position,
so the object reappears in the pose it held.

## Contract changes

These change published guarantees and are the reason this design exists as a
document rather than a commit.

### 1. JavaScript budget split

`scripts/check-dist.mjs` currently sums every `.js` file in `dist` into one
150 KiB compressed budget, so a lazily loaded chunk counts exactly as much as
an eagerly loaded one and deferring buys nothing.

The check is split:

- `javascriptBudget` — 150 KiB compressed, now covering only the scripts a
  route loads eagerly (its entry module and that module's static import graph);
- `deferredJavascriptBudget` — 300 KiB compressed, covering chunks reachable
  only through dynamic import.

Every `.js` file in `dist` must fall into exactly one of the two sets. A file
in neither is a failure, so a future chunk cannot escape both budgets. The
current eager figure is 110.8 KiB and is expected to move only slightly, since
`src/motion/**` is small and `src/webgl/**` is entirely deferred.

The initial-transfer budget of 700 KiB per route is unchanged and needs no
change: deferred chunks are not part of an initial transfer.

### 2. Lighthouse

`lighthouserc.cjs` mobile assertions stay exactly as they are — `performance`,
`accessibility`, `best-practices` and `seo` at `>= 0.90`, `LCP <= 2500 ms`,
`CLS < 0.1` — because phones run tier 0 and load no WebGL.

A separate desktop run is added with its own thresholds, so the WebGL path is
measured rather than assumed.

### 3. Visual snapshots

Playwright visual tests run with `prefers-reduced-motion: reduce`, which forces
tier 0 and a deterministic render. The six committed Darwin snapshots must
therefore continue to pass unchanged. A snapshot diff in this work is a signal
that the layer leaked into the reduced-motion path, not a signal to re-baseline.

## Testing

**Unit (Vitest, jsdom).** Conductor smoothing and normalisation maths; tier
selection across every capability combination; each failure path in the table
above; RAF start/stop idempotence and the absence of a leaked loop after
teardown; CSS custom property writes. No test in this layer imports `three`.

**End-to-end (Playwright).**

- canvas present at 1440×1000 with fine pointer;
- canvas absent at 390×844, absent under `prefers-reduced-motion: reduce`, and
  absent with WebGL blocked — and in all three cases the project screenshots
  and every visible string remain present and visible;
- the deferred chunk is not requested in any tier-0 case;
- sustained pointer input across the WebGL scene holds its frame budget,
  extending the existing 4× CPU throttled test rather than replacing it;
- axe reports no new violations, and the custom cursor does not remove or
  obscure focus indicators.

**Distribution.** The split budget above, plus the existing checks unchanged.

## Out of scope

New copy, new imagery, changes to the approved content model, analytics events
for motion, a project detail route, and any change to the personal-photo
publication gate.
