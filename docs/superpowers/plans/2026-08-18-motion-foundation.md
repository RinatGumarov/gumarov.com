# Motion foundation and DOM layer — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared motion state, the deferred-loading contract and the
complete non-WebGL motion layer — smooth scroll, custom cursor, magnetic
buttons, variable-font reveals and locale View Transitions — so the site is
better on every device and the WebGL fallback path is real and tested before
any WebGL exists.

**Architecture:** One `requestAnimationFrame` loop owns one mutable state
object. Its per-frame maths lives in a pure function so it can be tested
without a DOM. Consumers read the object directly or read CSS custom
properties written once per frame. Everything except a tiny capability probe
loads through a single dynamic import after first paint, which keeps the eager
JavaScript budget intact.

**Tech Stack:** Vite 7, React 19, TypeScript, GSAP 3.15 (core + ScrollTrigger),
Lenis 1.3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-18-cinematic-webgl-layer-design.md`

---

## Context an engineer new to this repository needs

This is a bilingual static site. `pnpm build` runs a client build, an SSR build,
a prerender into `/`, `/en/` and `/ru/`, then `scripts/check-dist.mjs`, which
enforces published guarantees. Three of them constrain almost every task here:

1. **The page must work with JavaScript disabled.** The checker strips every
   `<script>` from each built document and requires the headings, all four
   project names, the Telegram handle and the email address to survive.

2. **No CSS rule may hide or animate content without the motion gate.** Any
   rule whose declarations contain `opacity: 0`, `visibility: hidden`,
   `display: none`, `animation:` (other than `none`) or `position: sticky` must
   have `data-motion-state` somewhere in its selector, or the build fails with
   `changes the initial state without the [data-motion-state='enabled'] gate`.
   See `scripts/check-dist.mjs:952`. Every new rule in this plan obeys that.

3. **The hero `h1` is the LCP element and must never be animated to
   transparency.** `validateHeroCopyLcpVisibility` in
   `scripts/check-dist.mjs:961` fails the build for it. The hero heading keeps
   its existing translate-only entrance; no task here touches it.

`src/lib/motion.ts` already exposes `useMotionEnhancementGate()`, which sets
`data-motion-state="enabled"` on `<html>` when
`prefers-reduced-motion: no-preference` matches. That attribute is the existing
gate and this plan reuses it rather than inventing a second one.

Run one test file with `pnpm exec vitest run <path>`. Run one Playwright file
with `pnpm exec playwright test <path>`. The full gate is `pnpm verify`.

## Two independent gates

The spec's "tier 0" bundled two decisions that must stay separate:

- **`motionAllowed`** — false only under `prefers-reduced-motion: reduce`.
  When true, the motion runtime chunk loads. Phones included.
- **`webglTier`** — `0..3` from `selectTier`. Only `>= 1` loads WebGL, which
  this plan does not build. Phones are always `0`.

So a phone gets smooth scroll and reveals but no canvas, and a reduced-motion
visitor downloads neither.

## File structure

| File                         | Responsibility                                                             |
| ---------------------------- | -------------------------------------------------------------------------- |
| `src/lib/media-query.ts`     | The one guarded `matchMedia` wrapper, shared by old and new code           |
| `src/motion/capabilities.ts` | Read device/browser capabilities; choose a WebGL tier. Eager.              |
| `src/motion/boot.ts`         | Decide whether to load the runtime, and load it. Eager, tiny.              |
| `src/motion/math.ts`         | `clamp`, `damp`, `normaliseRate`. Pure.                                    |
| `src/motion/state.ts`        | `ConductorState` types and `createConductorState()`. Pure.                 |
| `src/motion/frame.ts`        | `applyFrame(state, history, sample, deltaMs)` — all per-frame maths. Pure. |
| `src/motion/conductor.ts`    | The RAF loop, DOM listeners, CSS custom property writes                    |
| `src/motion/lenis.ts`        | Smooth scroll setup and teardown                                           |
| `src/motion/cursor.ts`       | Custom cursor element and its spring                                       |
| `src/motion/magnetic.ts`     | Magnetic button behaviour                                                  |
| `src/motion/reveal.ts`       | ScrollTrigger section registration and variable-font reveals               |
| `src/motion/runtime.ts`      | Composition root for everything above. The single dynamic-import entry     |
| `src/styles/conductor.css`   | CSS that reads the custom properties                                       |

`src/motion/runtime.ts` and everything it pulls in must never be statically
imported. `src/motion/boot.ts` is the only file that reaches it, through
`import('./runtime')`.

---

### Task 1: Split the JavaScript budget into eager and deferred

`scripts/check-dist.mjs` currently sums every `.js` file in `dist` into one
150 KiB budget, so deferring a chunk saves nothing. Vite writes a route's eager
module graph into the document itself — the entry `<script type="module">` plus
one `<link rel="modulepreload">` per statically imported chunk — so the eager
set can be read from the built HTML, and everything else is reachable only
through a dynamic import.

**Files:**

- Modify: `scripts/check-dist.mjs:16-19` (budget constants)
- Modify: `scripts/check-dist.mjs:291-303` (the budget block)
- Modify: `scripts/check-dist.mjs:320-340` (route transfer loop, to reuse one computation)
- Test: `scripts/check-dist.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add `randomBytes` to the existing `node:crypto` import at the top of
`scripts/check-dist.test.mjs`:

```js
import { createHash, randomBytes } from 'node:crypto';
```

Add these three tests inside the existing `describe('distribution checker', ...)`
block, immediately after the test named
`'rejects a distribution built with the Playwright analytics token'`:

```js
it('charges a dynamically imported chunk to the deferred budget', async () => {
  // Random bytes so gzip cannot shrink the fixture below the budget it is
  // meant to exercise.
  const fixture = await createDistributionFixture();
  await writeFile(
    path.join(fixture.distDirectory, 'assets', 'deferred.js'),
    randomBytes(200 * 1024),
  );

  const result = runChecker(fixture.distDirectory);

  expect(result.stderr).not.toContain('Compressed JavaScript is');
  expect(result.stderr).not.toContain('Deferred JavaScript is');
  expect(result.status).toBe(0);
});

it('rejects a deferred chunk beyond the deferred budget', async () => {
  const fixture = await createDistributionFixture();
  await writeFile(
    path.join(fixture.distDirectory, 'assets', 'deferred.js'),
    randomBytes(320 * 1024),
  );

  const result = runChecker(fixture.distDirectory);

  expect(result.stderr).toContain('Deferred JavaScript is');
  expect(result.status).toBe(1);
});

it('charges a modulepreloaded chunk to the eager budget', async () => {
  const fixture = await createDistributionFixture({
    headByRoute: {
      'ru/index.html': '<link rel="modulepreload" href="/assets/eager.js" />',
    },
  });
  await writeFile(
    path.join(fixture.distDirectory, 'assets', 'eager.js'),
    randomBytes(160 * 1024),
  );

  const result = runChecker(fixture.distDirectory);

  expect(result.stderr).toContain('Compressed JavaScript is');
  expect(result.status).toBe(1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run scripts/check-dist.test.mjs -t 'budget'`

Expected: the first two fail. The 200 KiB chunk is charged to the eager budget,
so `'Compressed JavaScript is'` appears when the test says it should not, and
`'Deferred JavaScript is'` never appears because the message does not exist yet.
The third passes for the wrong reason — it will keep passing after the change,
which is the point of keeping it.

- [ ] **Step 3: Add the deferred budget constant**

In `scripts/check-dist.mjs`, immediately after the `javascriptBudget` line
(line 17):

```js
const javascriptBudget = 150 * kibibyte;
/*
 * Chunks no route loads eagerly. They cannot delay first paint, so they earn a
 * larger allowance than the entry graph — but they still need a ceiling, or a
 * lazily loaded scene could grow without any gate noticing.
 */
const deferredJavascriptBudget = 300 * kibibyte;
```

- [ ] **Step 4: Compute each route's initial assets once**

Replace the whole block from `const outputFiles = await listFiles(distDirectory);`
(line 291) through the closing brace of the route transfer loop (line 340) with:

```js
/*
 * Vite records a route's eager module graph in the document: the entry
 * <script type="module"> plus one <link rel="modulepreload"> per statically
 * imported chunk. Collect it once, then reuse it for both the JavaScript split
 * and the route transfer budget.
 */
const initialAssetPathsByRoute = new Map();
for (const route of routeContracts) {
  const html = routeDocuments.get(route.file);
  if (!html) continue;

  const routePath = path.join(distDirectory, route.file);
  initialAssetPathsByRoute.set(
    route.file,
    await collectInitialAssetPaths(html, routePath, route.file),
  );
}

const outputFiles = await listFiles(distDirectory);
const javascriptFiles = outputFiles.filter((file) => file.endsWith('.js'));

const eagerJavascriptFiles = new Set();
for (const assetPaths of initialAssetPathsByRoute.values()) {
  for (const assetPath of assetPaths) {
    if (assetPath.endsWith('.js')) eagerJavascriptFiles.add(assetPath);
  }
}

/*
 * The two sets are complements, so no .js file can fall outside both budgets
 * and escape the gate entirely.
 */
const deferredJavascriptFiles = javascriptFiles.filter(
  (file) => !eagerJavascriptFiles.has(file),
);

const compressedJavascriptBytes = await sumTransferredBytes(
  [...eagerJavascriptFiles],
  true,
);
const compressedDeferredJavascriptBytes = await sumTransferredBytes(
  deferredJavascriptFiles,
  true,
);

if (compressedJavascriptBytes > javascriptBudget) {
  failures.push(
    `Compressed JavaScript is ${formatKib(compressedJavascriptBytes)}; budget is ${formatKib(javascriptBudget)}.`,
  );
}

if (compressedDeferredJavascriptBytes > deferredJavascriptBudget) {
  failures.push(
    `Deferred JavaScript is ${formatKib(compressedDeferredJavascriptBytes)}; budget is ${formatKib(deferredJavascriptBudget)}.`,
  );
}

/*
 * `pnpm test:e2e` rebuilds dist through Playwright's webServer, which injects
 * a placeholder analytics key. Uploading that build ships the test token to
 * real visitors and makes their browsers call PostHog for nothing, so the
 * artifact must never contain it.
 */
for (const file of javascriptFiles) {
  const contents = await readFile(file, 'utf8');
  if (contents.includes(playwrightAnalyticsToken)) {
    failures.push(
      `${path.relative(distDirectory, file)}: built with the Playwright placeholder analytics token`,
    );
  }
}

for (const route of routeContracts) {
  const initialAssetPaths = initialAssetPathsByRoute.get(route.file);
  if (!initialAssetPaths) continue;

  const routePath = path.join(distDirectory, route.file);
  const initialTransferBytes =
    gzipSync(await readFile(routePath)).byteLength +
    (await sumRouteTransferredBytes(initialAssetPaths, route.file));
  routeTransferBytes.set(route.file, initialTransferBytes);

  if (initialTransferBytes > initialTransferBudget) {
    failures.push(
      `${route.file}: initial transfer is ${formatKib(initialTransferBytes)}; budget is ${formatKib(initialTransferBudget)}.`,
    );
  }
}
```

- [ ] **Step 5: Report both figures in the success line**

Find the success summary near `scripts/check-dist.mjs:383` and replace its
template string with:

```js
    `Distribution checks passed: 3 routes, ${formatKib(compressedJavascriptBytes)} eager and ${formatKib(compressedDeferredJavascriptBytes)} deferred JavaScript, worst initial transfer ${worstRouteSummary}.`,
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run scripts/check-dist.test.mjs`

Expected: PASS, all tests in the file.

- [ ] **Step 7: Record the new eager baseline**

Run: `pnpm build`

Expected: the final line now reads
`Distribution checks passed: 3 routes, <N> KiB eager and <M> KiB deferred JavaScript, ...`.
The eager figure will be **below** the previous 110.8 KiB, because the PostHog
slim entry (`assets/module.slim-*.js`) is dynamically imported and moves to the
deferred side. Write both numbers into the commit message; later tasks compare
against them.

- [ ] **Step 8: Commit**

```bash
git add scripts/check-dist.mjs scripts/check-dist.test.mjs
git commit -m "build: budget eager and deferred JavaScript separately"
```

---

### Task 2: Add the motion dependencies

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install**

```bash
pnpm add gsap@3.15.0 lenis@1.3.26
```

- [ ] **Step 2: Verify nothing became eager**

Run: `pnpm build`

Expected: the eager figure is unchanged from Task 1 Step 7. Nothing imports
either package yet, so both must be absent from the bundle entirely. If the
eager figure moved, a stray import exists — find it before continuing.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: add gsap and lenis"
```

---

### Task 3: Extract the guarded matchMedia helper

`src/lib/motion.ts` has a private `getMediaQuery` that swallows the two ways
`matchMedia` can be unavailable: missing entirely, or throwing on an
unsupported query. The new capability code needs exactly the same guard, and
two copies would drift.

**Files:**

- Create: `src/lib/media-query.ts`
- Create: `src/lib/media-query.test.ts`
- Modify: `src/lib/motion.ts:9-27`

- [ ] **Step 1: Write the failing test**

Create `src/lib/media-query.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMediaQuery, matchesMedia } from './media-query';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe('getMediaQuery', () => {
  it('returns null when matchMedia is unavailable', () => {
    Reflect.deleteProperty(window, 'matchMedia');

    expect(getMediaQuery('(min-width: 40rem)')).toBeNull();
  });

  it('returns null when matchMedia throws on an unsupported query', () => {
    window.matchMedia = vi.fn(() => {
      throw new SyntaxError('unsupported');
    }) as unknown as typeof window.matchMedia;

    expect(getMediaQuery('(unsupported: yes)')).toBeNull();
  });

  it('returns the list when the query is supported', () => {
    const list = { matches: true } as MediaQueryList;
    window.matchMedia = vi.fn(
      () => list,
    ) as unknown as typeof window.matchMedia;

    expect(getMediaQuery('(min-width: 40rem)')).toBe(list);
  });
});

describe('matchesMedia', () => {
  it('reports the fallback when the query cannot be evaluated', () => {
    Reflect.deleteProperty(window, 'matchMedia');

    expect(matchesMedia('(pointer: fine)', true)).toBe(true);
    expect(matchesMedia('(pointer: fine)', false)).toBe(false);
  });

  it('reports the query result when it can be evaluated', () => {
    window.matchMedia = vi.fn(
      () => ({ matches: false }) as MediaQueryList,
    ) as unknown as typeof window.matchMedia;

    expect(matchesMedia('(pointer: fine)', true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/media-query.test.ts`

Expected: FAIL — `Failed to resolve import "./media-query"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/media-query.ts`:

```ts
/**
 * `matchMedia` fails in two different ways: it is absent in some server and
 * test environments, and it throws on a query the browser cannot parse. Both
 * must degrade to "we do not know", never to a crash, because every caller
 * here is deciding whether to add an enhancement.
 */
export function getMediaQuery(query: string): MediaQueryList | null {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return null;
  }

  try {
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

/** Evaluate a query, falling back when it cannot be evaluated at all. */
export function matchesMedia(query: string, fallback: boolean): boolean {
  return getMediaQuery(query)?.matches ?? fallback;
}
```

- [ ] **Step 4: Point the existing module at it**

In `src/lib/motion.ts`, delete the private `getMediaQuery` function (lines
14-27) and add to the imports at the top of the file:

```ts
import { getMediaQuery } from './media-query';
```

Leave every other line of `src/lib/motion.ts` unchanged.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/lib/media-query.test.ts src/lib/motion.test.tsx`

Expected: PASS in both files. `motion.test.tsx` proves the extraction changed
no behaviour.

- [ ] **Step 6: Commit**

```bash
git add src/lib/media-query.ts src/lib/media-query.test.ts src/lib/motion.ts
git commit -m "refactor: share the guarded matchMedia helper"
```

---

### Task 4: Capability detection and tier selection

**Files:**

- Create: `src/motion/capabilities.ts`
- Create: `src/motion/capabilities.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/motion/capabilities.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readCapabilities,
  selectTier,
  supportsWebgl2,
  type CapabilitySnapshot,
} from './capabilities';

function snapshot(
  overrides: Partial<CapabilitySnapshot> = {},
): CapabilitySnapshot {
  return {
    reducedMotion: false,
    coarsePointer: false,
    viewportWidth: 1440,
    webgl2: true,
    saveData: false,
    deviceMemory: 8,
    hardwareConcurrency: 8,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('selectTier', () => {
  it('gives a capable desktop the highest tier', () => {
    expect(selectTier(snapshot())).toBe(3);
  });

  it('gives a modest desktop the middle tier', () => {
    expect(
      selectTier(snapshot({ deviceMemory: 4, hardwareConcurrency: 4 })),
    ).toBe(2);
  });

  it.each([
    ['reduced motion', { reducedMotion: true }],
    ['no WebGL2', { webgl2: false }],
    ['save-data', { saveData: true }],
    ['a phone-width viewport', { viewportWidth: 390 }],
    ['low memory', { deviceMemory: 2 }],
    ['few cores', { hardwareConcurrency: 2 }],
  ])('refuses WebGL for %s', (_label, overrides) => {
    expect(selectTier(snapshot(overrides))).toBe(0);
  });

  it('caps a wide coarse-pointer device at the lowest WebGL tier', () => {
    // A tablet is wide enough to carry the canvas but must not be given
    // hover-dependent effects.
    expect(selectTier(snapshot({ coarsePointer: true }))).toBe(1);
  });

  it('treats an unreported device hint as unknown, not as low', () => {
    // Safari reports neither. Reading `undefined < 4` as "weak" would strip
    // the canvas from every Mac.
    expect(
      selectTier(
        snapshot({ deviceMemory: undefined, hardwareConcurrency: undefined }),
      ),
    ).toBe(2);
  });

  it('treats the breakpoint itself as wide enough', () => {
    expect(selectTier(snapshot({ viewportWidth: 768 }))).toBe(3);
    expect(selectTier(snapshot({ viewportWidth: 767 }))).toBe(0);
  });
});

describe('supportsWebgl2', () => {
  it('reports false when getContext throws', () => {
    // jsdom throws "not implemented" here, which is exactly the shape of a
    // browser that cannot give us a context.
    expect(supportsWebgl2()).toBe(false);
  });

  it('reports false when getContext returns null', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(supportsWebgl2()).toBe(false);
  });

  it('reports true and releases the probe context', () => {
    const loseContext = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      getExtension: vi.fn(() => ({ loseContext })),
    } as unknown as WebGL2RenderingContext);

    expect(supportsWebgl2()).toBe(true);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });
});

describe('readCapabilities', () => {
  it('reads a snapshot without throwing in this environment', () => {
    const result = readCapabilities();

    expect(result.viewportWidth).toBe(window.innerWidth);
    expect(result.webgl2).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/motion/capabilities.test.ts`

Expected: FAIL — `Failed to resolve import "./capabilities"`.

- [ ] **Step 3: Write the implementation**

Create `src/motion/capabilities.ts`:

```ts
import { matchesMedia } from '../lib/media-query';

export type QualityTier = 0 | 1 | 2 | 3;

export interface CapabilitySnapshot {
  reducedMotion: boolean;
  coarsePointer: boolean;
  viewportWidth: number;
  webgl2: boolean;
  saveData: boolean;
  /** Undefined where the browser does not report it, which is most of them. */
  deviceMemory: number | undefined;
  hardwareConcurrency: number | undefined;
}

/** 48rem against the 16px root the tokens assume. */
export const phoneBreakpointPx = 768;

/**
 * Choose how much WebGL a visitor gets, or none at all.
 *
 * Unreported device hints stay unknown rather than counting as weak: Safari
 * reports neither `deviceMemory` nor a useful `hardwareConcurrency`, and
 * reading a missing value as a low one would strip the canvas from every Mac.
 */
export function selectTier(snapshot: CapabilitySnapshot): QualityTier {
  const lowMemory =
    snapshot.deviceMemory !== undefined && snapshot.deviceMemory < 4;
  const fewCores =
    snapshot.hardwareConcurrency !== undefined &&
    snapshot.hardwareConcurrency < 4;

  if (
    snapshot.reducedMotion ||
    !snapshot.webgl2 ||
    snapshot.saveData ||
    snapshot.viewportWidth < phoneBreakpointPx ||
    lowMemory ||
    fewCores
  ) {
    return 0;
  }

  // Wide enough for the canvas, but every hover-driven effect is meaningless
  // without a hovering pointer, so cap the work we ask for.
  if (snapshot.coarsePointer) return 1;

  const strongMemory =
    snapshot.deviceMemory !== undefined && snapshot.deviceMemory >= 8;
  const strongCores =
    snapshot.hardwareConcurrency !== undefined &&
    snapshot.hardwareConcurrency >= 8;

  return strongMemory && strongCores ? 3 : 2;
}

/**
 * Probe for a WebGL2 context and immediately give it back. Browsers cap live
 * contexts, so holding the probe open would cost the real canvas one slot.
 */
export function supportsWebgl2(): boolean {
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    if (!context) return false;

    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

interface NavigatorHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean };
}

export function readCapabilities(): CapabilitySnapshot {
  if (typeof window === 'undefined') {
    return {
      reducedMotion: true,
      coarsePointer: false,
      viewportWidth: 0,
      webgl2: false,
      saveData: false,
      deviceMemory: undefined,
      hardwareConcurrency: undefined,
    };
  }

  const hints = navigator as Navigator & NavigatorHints;

  return {
    // Default to the cautious answer when the query cannot be evaluated.
    reducedMotion: matchesMedia('(prefers-reduced-motion: reduce)', true),
    coarsePointer: matchesMedia('(pointer: coarse)', false),
    viewportWidth: window.innerWidth,
    webgl2: supportsWebgl2(),
    saveData: hints.connection?.saveData === true,
    deviceMemory:
      typeof hints.deviceMemory === 'number' ? hints.deviceMemory : undefined,
    hardwareConcurrency:
      typeof hints.hardwareConcurrency === 'number'
        ? hints.hardwareConcurrency
        : undefined,
  };
}

/** Motion is a separate decision from WebGL: phones get motion, not a canvas. */
export function isMotionAllowed(): boolean {
  return !matchesMedia('(prefers-reduced-motion: reduce)', true);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/motion/capabilities.test.ts`

Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/motion/capabilities.ts src/motion/capabilities.test.ts
git commit -m "feat: detect motion capabilities and choose a quality tier"
```

---

### Task 5: Motion maths

**Files:**

- Create: `src/motion/math.ts`
- Create: `src/motion/math.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/motion/math.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clamp, damp, normaliseRate } from './math';

describe('clamp', () => {
  it('keeps a value inside the range', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(-3, 0, 1)).toBe(0);
    expect(clamp(9, 0, 1)).toBe(1);
  });

  it('resolves NaN to the minimum instead of spreading it', () => {
    // A single NaN reaching a CSS custom property poisons every rule that
    // reads it, and the page has no way to recover.
    expect(clamp(Number.NaN, 0, 1)).toBe(0);
  });
});

describe('damp', () => {
  it('moves exactly halfway in one half-life', () => {
    expect(damp(0, 1, 100, 100)).toBeCloseTo(0.5, 10);
  });

  it('moves the same distance per millisecond regardless of frame rate', () => {
    // The reason this exists: a per-frame lerp runs twice as fast on a 120 Hz
    // display, so the site would feel different on different hardware.
    const oneLongFrame = damp(0, 1, 100, 32);
    let twoShortFrames = damp(0, 1, 100, 16);
    twoShortFrames = damp(twoShortFrames, 1, 100, 16);

    expect(twoShortFrames).toBeCloseTo(oneLongFrame, 10);
  });

  it('holds still when no time has passed', () => {
    expect(damp(0.25, 1, 100, 0)).toBe(0.25);
    expect(damp(0.25, 1, 100, -5)).toBe(0.25);
  });

  it('snaps when the half-life is zero', () => {
    expect(damp(0.25, 1, 0, 16)).toBe(1);
  });
});

describe('normaliseRate', () => {
  it('maps a rate onto zero to one against its reference', () => {
    expect(normaliseRate(1250, 2500)).toBeCloseTo(0.5, 10);
    expect(normaliseRate(5000, 2500)).toBe(1);
  });

  it('ignores direction', () => {
    expect(normaliseRate(-1250, 2500)).toBeCloseTo(0.5, 10);
  });

  it('reports nothing for a meaningless reference', () => {
    expect(normaliseRate(1250, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/motion/math.test.ts`

Expected: FAIL — `Failed to resolve import "./math"`.

- [ ] **Step 3: Write the implementation**

Create `src/motion/math.ts`:

```ts
export function clamp(value: number, minimum: number, maximum: number): number {
  // NaN must not escape: it would reach a CSS custom property and silently
  // break every rule reading it, with no way back.
  if (Number.isNaN(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Frame-rate independent exponential smoothing.
 *
 * `current += (target - current) * 0.1` per frame moves twice as fast on a
 * 120 Hz display as on a 60 Hz one. Expressing the ease as a half-life ties it
 * to wall-clock time instead of frame count, so the site feels the same on
 * every machine.
 */
export function damp(
  current: number,
  target: number,
  halfLifeMs: number,
  deltaMs: number,
): number {
  if (deltaMs <= 0) return current;
  if (halfLifeMs <= 0) return target;
  return target + (current - target) * 2 ** (-deltaMs / halfLifeMs);
}

/**
 * Map a rate onto `0..1` against the rate that counts as full intensity.
 * Scroll and pointer speed both pass through this so they contribute to
 * `energy` on one shared scale.
 */
export function normaliseRate(rate: number, referenceRate: number): number {
  if (referenceRate <= 0) return 0;
  return clamp(Math.abs(rate) / referenceRate, 0, 1);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/motion/math.test.ts`

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/motion/math.ts src/motion/math.test.ts
git commit -m "feat: add frame-rate independent motion maths"
```

---

### Task 6: The conductor state and its per-frame maths

Keeping the maths in a pure function is what makes this layer testable: it can
be driven with exact deltas and exact samples, with no RAF and no DOM.

**Files:**

- Create: `src/motion/state.ts`
- Create: `src/motion/frame.ts`
- Create: `src/motion/frame.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/motion/frame.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyFrame,
  createFrameHistory,
  type FrameHistory,
  type FrameSample,
} from './frame';
import { createConductorState } from './state';

let history: FrameHistory;

beforeEach(() => {
  // Inter-frame history is per-loop, not global, so every test starts with a
  // page that has never moved.
  history = createFrameHistory();
});

function sample(overrides: Partial<FrameSample> = {}): FrameSample {
  return {
    scrollY: 0,
    scrollRange: 4000,
    pointerX: 640,
    pointerY: 400,
    pointerDown: false,
    viewportWidth: 1280,
    viewportHeight: 800,
    devicePixelRatio: 2,
    ...overrides,
  };
}

describe('applyFrame', () => {
  it('reports scroll progress across the scrollable range', () => {
    const state = createConductorState();

    applyFrame(state, history, sample({ scrollY: 1000 }), 16);

    expect(state.scroll.y).toBe(1000);
    expect(state.scroll.progress).toBeCloseTo(0.25, 6);
  });

  it('reports no progress for a page that does not scroll', () => {
    const state = createConductorState();

    applyFrame(state, history, sample({ scrollRange: 0 }), 16);

    expect(state.scroll.progress).toBe(0);
  });

  it('signs scroll velocity by direction and normalises its magnitude', () => {
    const state = createConductorState();

    applyFrame(state, history, sample({ scrollY: 0 }), 16);
    // 40px in 16ms is 2500px/s, the reference rate, so a full -1..1 swing.
    applyFrame(state, history, sample({ scrollY: 40 }), 16);

    expect(state.scroll.velocity).toBeCloseTo(1, 3);
    expect(state.scroll.direction).toBe(1);

    applyFrame(state, history, sample({ scrollY: 0 }), 16);

    expect(state.scroll.velocity).toBeCloseTo(-1, 3);
    expect(state.scroll.direction).toBe(-1);
  });

  it('holds the last direction while the page is still', () => {
    const state = createConductorState();

    applyFrame(state, history, sample({ scrollY: 0 }), 16);
    applyFrame(state, history, sample({ scrollY: 40 }), 16);
    applyFrame(state, history, sample({ scrollY: 40 }), 16);

    expect(state.scroll.direction).toBe(1);
    expect(state.scroll.velocity).toBeCloseTo(0, 3);
  });

  it('normalises the pointer to minus one through one about the centre', () => {
    const state = createConductorState();

    applyFrame(state, history, sample({ pointerX: 640, pointerY: 400 }), 16);
    expect(state.pointer.nx).toBeCloseTo(0, 6);
    expect(state.pointer.ny).toBeCloseTo(0, 6);

    applyFrame(state, history, sample({ pointerX: 1280, pointerY: 0 }), 16);
    expect(state.pointer.nx).toBeCloseTo(1, 6);
    expect(state.pointer.ny).toBeCloseTo(-1, 6);
  });

  it('raises energy while moving and lets it fall back to rest', () => {
    const state = createConductorState();

    applyFrame(state, history, sample({ scrollY: 0 }), 16);
    for (let frame = 1; frame <= 40; frame += 1) {
      applyFrame(state, history, sample({ scrollY: frame * 40 }), 16);
    }
    const moving = state.energy;
    expect(moving).toBeGreaterThan(0.8);

    const restingScrollY = 40 * 40;
    for (let frame = 0; frame < 120; frame += 1) {
      applyFrame(state, history, sample({ scrollY: restingScrollY }), 16);
    }

    expect(state.energy).toBeLessThan(0.02);
  });

  it('clamps a long gap so a backgrounded tab does not resume with a jolt', () => {
    const state = createConductorState();

    applyFrame(state, history, sample({ scrollY: 0 }), 16);
    applyFrame(state, history, sample({ scrollY: 8000 }), 30_000);

    expect(state.time.delta).toBe(64);
    expect(state.scroll.velocity).toBeLessThanOrEqual(1);
    expect(state.energy).toBeLessThanOrEqual(1);
  });

  it('accumulates elapsed time from the clamped delta', () => {
    const state = createConductorState();

    applyFrame(state, history, sample(), 16);
    applyFrame(state, history, sample(), 16);

    expect(state.time.elapsed).toBe(32);
  });

  it('copies the viewport through unchanged', () => {
    const state = createConductorState();

    applyFrame(
      state,
      history,
      sample({ viewportWidth: 800, viewportHeight: 600, devicePixelRatio: 3 }),
      16,
    );

    expect(state.viewport).toEqual({ width: 800, height: 600, dpr: 3 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/motion/frame.test.ts`

Expected: FAIL — `Failed to resolve import "./frame"`.

- [ ] **Step 3: Write the state module**

Create `src/motion/state.ts`:

```ts
export interface ConductorScroll {
  /** Pixels from the top of the document. */
  y: number;
  /** `0..1` across the scrollable range. */
  progress: number;
  /** `-1..1`; sign is direction, magnitude is speed against the reference. */
  velocity: number;
  direction: 1 | -1;
}

export interface ConductorPointer {
  x: number;
  y: number;
  /** `-1..1` about the viewport centre. */
  nx: number;
  ny: number;
  /** Pixels per second. */
  vx: number;
  vy: number;
  /** `0..1` against the reference pointer rate. */
  speed: number;
  down: boolean;
}

export interface ConductorSection {
  index: number;
  id: string;
  /** `0..1` through the active section. */
  progress: number;
}

export interface ConductorViewport {
  width: number;
  height: number;
  dpr: number;
}

export interface ConductorTime {
  /** Milliseconds since the loop started, from clamped deltas. */
  elapsed: number;
  delta: number;
}

export interface ConductorState {
  scroll: ConductorScroll;
  pointer: ConductorPointer;
  section: ConductorSection;
  viewport: ConductorViewport;
  time: ConductorTime;
  /**
   * The shared coupling term. Every layer scales its intensity by this one
   * number, which is what makes scroll, pointer, type and WebGL read as one
   * scene rather than three unrelated effects.
   */
  energy: number;
}

export function createConductorState(): ConductorState {
  return {
    scroll: { y: 0, progress: 0, velocity: 0, direction: 1 },
    pointer: { x: 0, y: 0, nx: 0, ny: 0, vx: 0, vy: 0, speed: 0, down: false },
    section: { index: -1, id: '', progress: 0 },
    viewport: { width: 0, height: 0, dpr: 1 },
    time: { elapsed: 0, delta: 0 },
    energy: 0,
  };
}
```

- [ ] **Step 4: Write the frame module**

Create `src/motion/frame.ts`:

```ts
import { clamp, damp, normaliseRate } from './math';
import type { ConductorState } from './state';

export interface FrameSample {
  scrollY: number;
  /** `scrollHeight - innerHeight`; zero when the page does not scroll. */
  scrollRange: number;
  pointerX: number;
  pointerY: number;
  pointerDown: boolean;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}

/**
 * What the previous frame saw. Held by the caller rather than in a module
 * variable so a restarted loop cannot inherit a stale rate, and so tests are
 * isolated from each other without a reset hook.
 */
export interface FrameHistory {
  scrollY: number | null;
  pointerX: number | null;
  pointerY: number | null;
}

export function createFrameHistory(): FrameHistory {
  return { scrollY: null, pointerX: null, pointerY: null };
}

/** Scroll speed that counts as full intensity, in pixels per second. */
const scrollReferenceRate = 2500;
/** Pointer speed that counts as full intensity, in pixels per second. */
const pointerReferenceRate = 2200;
/** How long energy takes to fall halfway back to rest. */
const energyHalfLifeMs = 220;
/**
 * A backgrounded tab resumes with a delta of many seconds. Left alone it would
 * produce one enormous velocity spike and the scene would lurch on return.
 */
const maximumDeltaMs = 64;

export function applyFrame(
  state: ConductorState,
  history: FrameHistory,
  sample: FrameSample,
  deltaMs: number,
): void {
  const delta = clamp(deltaMs, 0, maximumDeltaMs);
  state.time.delta = delta;
  state.time.elapsed += delta;

  state.viewport.width = sample.viewportWidth;
  state.viewport.height = sample.viewportHeight;
  state.viewport.dpr = sample.devicePixelRatio;

  const scrollDelta =
    history.scrollY === null ? 0 : sample.scrollY - history.scrollY;
  history.scrollY = sample.scrollY;

  state.scroll.y = sample.scrollY;
  state.scroll.progress =
    sample.scrollRange > 0
      ? clamp(sample.scrollY / sample.scrollRange, 0, 1)
      : 0;

  const scrollRate = delta > 0 ? (scrollDelta / delta) * 1000 : 0;
  const scrollIntensity = normaliseRate(scrollRate, scrollReferenceRate);
  state.scroll.velocity = scrollDelta < 0 ? -scrollIntensity : scrollIntensity;
  // A still page keeps whichever way it was last going, so direction-driven
  // effects do not snap back the moment the visitor pauses.
  if (scrollDelta > 0) state.scroll.direction = 1;
  else if (scrollDelta < 0) state.scroll.direction = -1;

  const pointerDeltaX =
    history.pointerX === null ? 0 : sample.pointerX - history.pointerX;
  const pointerDeltaY =
    history.pointerY === null ? 0 : sample.pointerY - history.pointerY;
  history.pointerX = sample.pointerX;
  history.pointerY = sample.pointerY;

  state.pointer.x = sample.pointerX;
  state.pointer.y = sample.pointerY;
  state.pointer.down = sample.pointerDown;
  state.pointer.nx =
    sample.viewportWidth > 0
      ? clamp((sample.pointerX / sample.viewportWidth) * 2 - 1, -1, 1)
      : 0;
  state.pointer.ny =
    sample.viewportHeight > 0
      ? clamp((sample.pointerY / sample.viewportHeight) * 2 - 1, -1, 1)
      : 0;
  state.pointer.vx = delta > 0 ? (pointerDeltaX / delta) * 1000 : 0;
  state.pointer.vy = delta > 0 ? (pointerDeltaY / delta) * 1000 : 0;
  state.pointer.speed = normaliseRate(
    Math.hypot(state.pointer.vx, state.pointer.vy),
    pointerReferenceRate,
  );

  const target = Math.max(scrollIntensity, state.pointer.speed);
  state.energy = clamp(
    damp(state.energy, target, energyHalfLifeMs, delta),
    0,
    1,
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/motion/frame.test.ts`

Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add src/motion/state.ts src/motion/frame.ts src/motion/frame.test.ts
git commit -m "feat: add the conductor state and its per-frame maths"
```

---

### Task 7: The conductor loop and CSS custom properties

**Files:**

- Create: `src/motion/conductor.ts`
- Create: `src/motion/conductor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/motion/conductor.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConductor, setSection, startConductor } from './conductor';

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-conductor');
  vi.restoreAllMocks();
});

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

describe('startConductor', () => {
  it('marks the document while it is running and clears it on stop', async () => {
    stop = startConductor();
    await nextFrame();

    expect(document.documentElement.dataset.conductor).toBe('live');

    stop();
    expect(document.documentElement.dataset.conductor).toBeUndefined();
  });

  it('writes the shared custom properties once a frame has run', async () => {
    stop = startConductor();
    await nextFrame();
    await nextFrame();

    const style = document.documentElement.style;
    expect(style.getPropertyValue('--c-energy')).not.toBe('');
    expect(style.getPropertyValue('--c-pointer-x')).not.toBe('');
    expect(style.getPropertyValue('--c-pointer-y')).not.toBe('');
    expect(style.getPropertyValue('--c-scroll-velocity')).not.toBe('');
    expect(style.getPropertyValue('--c-section-progress')).not.toBe('');
  });

  it('does not start a second loop', async () => {
    stop = startConductor();
    const secondStop = startConductor();
    await nextFrame();
    await nextFrame();

    // The no-op returned by the second call must not tear down the first.
    secondStop();
    expect(document.documentElement.dataset.conductor).toBe('live');

    // And there is exactly one loop, so the first disposer stops everything.
    // A second loop would keep advancing time after this.
    stop();
    const elapsedAfterStop = readConductor().time.elapsed;
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(readConductor().time.elapsed).toBe(elapsedAfterStop);
  });

  it('survives being stopped twice', async () => {
    stop = startConductor();
    await nextFrame();

    stop();
    expect(() => stop?.()).not.toThrow();
  });

  it('tracks pointer movement into the shared state', async () => {
    stop = startConductor();
    await nextFrame();

    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 120, clientY: 48 }),
    );
    await nextFrame();
    await nextFrame();

    expect(readConductor().pointer.x).toBe(120);
    expect(readConductor().pointer.y).toBe(48);
  });

  it('stops the loop while the document is hidden', async () => {
    stop = startConductor();
    await nextFrame();
    await nextFrame();

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    // Measure elapsed time rather than counting requestAnimationFrame calls:
    // the test's own `nextFrame` helper calls it too, so a spy would count
    // the test as if it were the loop.
    const elapsedWhenHidden = readConductor().time.elapsed;
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.documentElement.dataset.conductor).toBe('paused');
    expect(readConductor().time.elapsed).toBe(elapsedWhenHidden);
  });
});

describe('setSection', () => {
  it('publishes the active section to the shared state', async () => {
    stop = startConductor();
    await nextFrame();

    setSection(2, 'about', 0.5);
    await nextFrame();

    expect(readConductor().section).toEqual({
      index: 2,
      id: 'about',
      progress: 0.5,
    });
    expect(
      document.documentElement.style.getPropertyValue('--c-section-progress'),
    ).toBe('0.500');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/motion/conductor.test.ts`

Expected: FAIL — `Failed to resolve import "./conductor"`.

- [ ] **Step 3: Write the implementation**

Create `src/motion/conductor.ts`:

```ts
import {
  applyFrame,
  createFrameHistory,
  type FrameHistory,
  type FrameSample,
} from './frame';
import { clamp } from './math';
import { createConductorState, type ConductorState } from './state';

const state = createConductorState();

/**
 * The live state object. It is mutated in place and never replaced, so callers
 * may hold the reference across frames and read it without allocating. Do not
 * put it in React state — it changes sixty times a second.
 */
export function readConductor(): ConductorState {
  return state;
}

/** Published by the section observer; see `reveal.ts`. */
export function setSection(index: number, id: string, progress: number): void {
  state.section.index = index;
  state.section.id = id;
  state.section.progress = clamp(progress, 0, 1);
}

const noop = () => undefined;

let running = false;
let paused = false;
let frameHandle = 0;
let lastFrameTime = 0;
let history: FrameHistory = createFrameHistory();
let pointerX = 0;
let pointerY = 0;
let pointerDown = false;
const lastWritten = new Map<string, string>();

function writeProperty(name: string, value: string) {
  // Style writes invalidate layout for the whole document, so skip the ones
  // that would not change anything — which is most frames while reading.
  if (lastWritten.get(name) === value) return;
  lastWritten.set(name, value);
  document.documentElement.style.setProperty(name, value);
}

function publish() {
  writeProperty('--c-energy', state.energy.toFixed(3));
  writeProperty('--c-pointer-x', state.pointer.nx.toFixed(3));
  writeProperty('--c-pointer-y', state.pointer.ny.toFixed(3));
  writeProperty('--c-scroll-velocity', state.scroll.velocity.toFixed(3));
  writeProperty('--c-section-progress', state.section.progress.toFixed(3));
}

function readSample(): FrameSample {
  const documentElement = document.documentElement;
  return {
    scrollY: window.scrollY,
    scrollRange: Math.max(0, documentElement.scrollHeight - window.innerHeight),
    pointerX,
    pointerY,
    pointerDown,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

function tick(now: number) {
  // `paused` as well as `running`: cancelling a frame that has already been
  // dispatched is not possible, and that stray frame would re-schedule the
  // loop and quietly resume it behind a hidden tab.
  if (!running || paused) return;

  const delta = lastFrameTime === 0 ? 16 : now - lastFrameTime;
  lastFrameTime = now;

  applyFrame(state, history, readSample(), delta);
  publish();

  frameHandle = window.requestAnimationFrame(tick);
}

function onPointerMove(event: PointerEvent) {
  pointerX = event.clientX;
  pointerY = event.clientY;
}

function onPointerDown() {
  pointerDown = true;
}

function onPointerUp() {
  pointerDown = false;
}

function onVisibilityChange() {
  if (!running) return;

  if (document.visibilityState === 'visible') {
    if (!paused) return;
    paused = false;
    document.documentElement.dataset.conductor = 'live';
    // A resumed loop must not measure against the timestamp from before the
    // tab was hidden, or the first frame back reports a huge rate.
    lastFrameTime = 0;
    history = createFrameHistory();
    frameHandle = window.requestAnimationFrame(tick);
    return;
  }

  paused = true;
  document.documentElement.dataset.conductor = 'paused';
  window.cancelAnimationFrame(frameHandle);
}

/**
 * Start the single frame loop. Calling it again while it runs is a no-op that
 * returns a disposer doing nothing, so a second caller cannot tear down the
 * first caller's loop. The returned disposer is safe to call twice.
 */
export function startConductor(): () => void {
  if (typeof window === 'undefined' || running) return noop;

  running = true;
  paused = false;
  lastFrameTime = 0;
  history = createFrameHistory();
  document.documentElement.dataset.conductor = 'live';

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);

  frameHandle = window.requestAnimationFrame(tick);

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    running = false;
    paused = false;

    window.cancelAnimationFrame(frameHandle);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    document.removeEventListener('visibilitychange', onVisibilityChange);

    lastWritten.clear();
    for (const name of [
      '--c-energy',
      '--c-pointer-x',
      '--c-pointer-y',
      '--c-scroll-velocity',
      '--c-section-progress',
    ]) {
      document.documentElement.style.removeProperty(name);
    }
    delete document.documentElement.dataset.conductor;
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/motion/conductor.test.ts`

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/motion/conductor.ts src/motion/conductor.test.ts
git commit -m "feat: run one frame loop that publishes shared motion state"
```

---

### Task 8: The runtime composition root and its boot probe

`boot.ts` stays eager and must stay tiny — it is the only new code in the entry
graph. `runtime.ts` is the dynamic-import boundary; everything heavy hangs off
it.

**Files:**

- Create: `src/motion/runtime.ts`
- Create: `src/motion/boot.ts`
- Create: `src/motion/boot.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/motion/boot.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted, not a plain const: vi.mock is hoisted above module scope, so a
// factory closing over an ordinary variable throws "cannot access before
// initialization".
const { startRuntime } = vi.hoisted(() => ({
  startRuntime: vi.fn(() => () => undefined),
}));

vi.mock('./runtime', () => ({ startRuntime }));

const originalMatchMedia = window.matchMedia;

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion: reduce')
          ? reduce
          : !reduce,
      }) as MediaQueryList,
  ) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  startRuntime.mockClear();
  vi.restoreAllMocks();
});

describe('bootMotion', () => {
  it('loads the runtime when motion is allowed', async () => {
    setReducedMotion(false);
    const { bootMotion } = await import('./boot');

    await bootMotion();

    expect(startRuntime).toHaveBeenCalledTimes(1);
  });

  it('never loads the runtime under reduced motion', async () => {
    setReducedMotion(true);
    const { bootMotion } = await import('./boot');

    await bootMotion();

    // The point of the gate: these visitors must not download gsap or lenis
    // at all, not merely leave them idle.
    expect(startRuntime).not.toHaveBeenCalled();
  });

  it('leaves the page working when the runtime chunk fails to load', async () => {
    setReducedMotion(false);
    startRuntime.mockImplementationOnce(() => {
      throw new Error('chunk unavailable');
    });
    const { bootMotion } = await import('./boot');

    await expect(bootMotion()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/motion/boot.test.ts`

Expected: FAIL — `Failed to resolve import "./runtime"`.

- [ ] **Step 3: Write the runtime composition root**

Create `src/motion/runtime.ts`. Later tasks extend `startRuntime`; for now it
owns only the conductor.

```ts
import { startConductor } from './conductor';

/**
 * Composition root for the motion layer. This module and everything it imports
 * must stay out of the eager bundle: `boot.ts` reaches it only through a
 * dynamic import, which is what keeps the entry graph inside its budget.
 */
export function startRuntime(): () => void {
  const disposers = [startConductor()];

  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}
```

- [ ] **Step 4: Write the boot probe**

Create `src/motion/boot.ts`:

```ts
import { isMotionAllowed } from './capabilities';

/**
 * The only eager motion code. It answers one question — should this visitor
 * get the motion layer at all — and if so pulls the runtime in as a separate
 * chunk. A visitor who asked for reduced motion downloads none of it.
 */
export async function bootMotion(): Promise<void> {
  if (!isMotionAllowed()) return;

  try {
    const { startRuntime } = await import('./runtime');
    startRuntime();
  } catch {
    // A failed chunk must cost the visitor nothing: the prerendered page and
    // the existing CSS motion keep working exactly as they do without it.
  }
}

/** Defer to idle so the layer never competes with first paint. */
export function scheduleMotion(): void {
  if (typeof window === 'undefined') return;

  const run = () => {
    void bootMotion();
  };

  const schedule = () => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 2000 });
      return;
    }

    setTimeout(run, 1);
  };

  if (document.readyState === 'complete') {
    schedule();
    return;
  }

  window.addEventListener('load', schedule, { once: true });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/motion/boot.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 6: Wire it into the client entry**

In `src/entry-client.tsx`, add the import beside the existing font import and
call it beside `scheduleBrandFonts()`:

```tsx
import { scheduleBrandFonts } from './lib/brand-fonts';
import { scheduleMotion } from './motion/boot';
import './styles/global.css';

scheduleBrandFonts();
scheduleMotion();
```

- [ ] **Step 7: Verify the split held**

Run: `pnpm build`

Expected: the eager figure moved by well under 1 KiB from Task 2 Step 2 — only
`boot.ts` and `capabilities.ts` joined the entry graph. The deferred figure
grew. If the eager figure jumped by tens of KiB, something imported `runtime`
statically; find it before continuing.

- [ ] **Step 8: Commit**

```bash
git add src/motion/runtime.ts src/motion/boot.ts src/motion/boot.test.ts src/entry-client.tsx
git commit -m "feat: load the motion runtime as a deferred chunk"
```

---

### Task 9: Smooth scroll

Lenis smooths the real scroll position, so `window.scrollY` stays accurate and
the conductor needs no knowledge of it at all. Native scrolling stays on touch
devices, where the platform already does this better and hijacking it breaks
address-bar collapse and overscroll.

**Files:**

- Create: `src/motion/lenis.ts`
- Create: `src/motion/lenis.test.ts`
- Modify: `src/motion/runtime.ts`

- [ ] **Step 1: Write the failing test**

Create `src/motion/lenis.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const { destroy, raf, LenisMock } = vi.hoisted(() => {
  const destroy = vi.fn();
  const raf = vi.fn();
  return { destroy, raf, LenisMock: vi.fn(() => ({ destroy, raf })) };
});

vi.mock('lenis', () => ({ default: LenisMock }));

const originalMatchMedia = window.matchMedia;

function setPointer(fine: boolean) {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches: query.includes('pointer: fine') ? fine : !fine,
      }) as MediaQueryList,
  ) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  LenisMock.mockClear();
  destroy.mockClear();
  raf.mockClear();
  vi.restoreAllMocks();
});

describe('startSmoothScroll', () => {
  it('smooths scrolling for a fine pointer', async () => {
    setPointer(true);
    const { startSmoothScroll } = await import('./lenis');

    const stop = startSmoothScroll();

    expect(LenisMock).toHaveBeenCalledTimes(1);

    stop();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('leaves touch scrolling to the platform', async () => {
    // Hijacking touch scroll breaks address-bar collapse and overscroll, and
    // the platform's own smoothing is better than ours.
    setPointer(false);
    const { startSmoothScroll } = await import('./lenis');

    const stop = startSmoothScroll();

    expect(LenisMock).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('drives one raf per frame and stops on teardown', async () => {
    setPointer(true);
    const { startSmoothScroll } = await import('./lenis');

    const stop = startSmoothScroll();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const drivenWhileRunning = raf.mock.calls.length;
    expect(drivenWhileRunning).toBeGreaterThan(0);

    stop();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(raf.mock.calls.length).toBe(drivenWhileRunning);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/motion/lenis.test.ts`

Expected: FAIL — `Failed to resolve import "./lenis"`.

- [ ] **Step 3: Write the implementation**

Create `src/motion/lenis.ts`:

```ts
import Lenis from 'lenis';
import { matchesMedia } from '../lib/media-query';

/**
 * Smooth the real scroll position rather than translating a container, so
 * `window.scrollY`, anchor links, `scroll-margin` and the section observer all
 * keep working untouched — and the conductor needs no knowledge of Lenis.
 */
export function startSmoothScroll(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (!matchesMedia('(pointer: fine)', false)) return () => undefined;

  const lenis = new Lenis({
    // Slightly longer than the default: the scenes are tall and a fast decay
    // makes long sections feel choppy rather than cinematic.
    lerp: 0.09,
    wheelMultiplier: 1,
    touchMultiplier: 1,
  });

  let running = true;
  let handle = 0;

  const frame = (time: number) => {
    if (!running) return;
    lenis.raf(time);
    handle = window.requestAnimationFrame(frame);
  };

  handle = window.requestAnimationFrame(frame);

  return () => {
    if (!running) return;
    running = false;
    window.cancelAnimationFrame(handle);
    lenis.destroy();
  };
}
```

- [ ] **Step 4: Add it to the runtime**

Replace the body of `startRuntime` in `src/motion/runtime.ts`:

```ts
import { startConductor } from './conductor';
import { startSmoothScroll } from './lenis';

export function startRuntime(): () => void {
  const disposers = [startConductor(), startSmoothScroll()];

  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/motion/`

Expected: PASS across every file in the directory.

- [ ] **Step 6: Commit**

```bash
git add src/motion/lenis.ts src/motion/lenis.test.ts src/motion/runtime.ts
git commit -m "feat: smooth pointer-driven scrolling with lenis"
```

---

### Task 10: Custom cursor

**Files:**

- Create: `src/motion/cursor.ts`
- Create: `src/motion/cursor.test.ts`
- Create: `src/styles/conductor.css`
- Modify: `src/styles/global.css:1-2`
- Modify: `src/motion/runtime.ts`

- [ ] **Step 1: Write the failing test**

Create `src/motion/cursor.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const { quickTo, quickToSetter } = vi.hoisted(() => {
  const quickToSetter = vi.fn();
  return { quickToSetter, quickTo: vi.fn(() => quickToSetter) };
});

vi.mock('gsap', () => ({
  default: { quickTo },
  gsap: { quickTo },
}));

const originalMatchMedia = window.matchMedia;

function setPointer(fine: boolean) {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches: query.includes('pointer: fine') ? fine : !fine,
      }) as MediaQueryList,
  ) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.body.innerHTML = '';
  quickTo.mockClear();
  quickToSetter.mockClear();
  vi.restoreAllMocks();
});

describe('startCursor', () => {
  it('adds one hidden-from-assistive-technology cursor element', async () => {
    setPointer(true);
    const { startCursor } = await import('./cursor');

    const stop = startCursor();

    const cursor = document.querySelector('[data-conductor-cursor]');
    expect(cursor).not.toBeNull();
    // It is decoration over content that is already announced; a screen reader
    // must not meet it at all.
    expect(cursor?.getAttribute('aria-hidden')).toBe('true');

    stop();
    expect(document.querySelector('[data-conductor-cursor]')).toBeNull();
  });

  it('adds nothing for a coarse pointer', async () => {
    setPointer(false);
    const { startCursor } = await import('./cursor');

    const stop = startCursor();

    expect(document.querySelector('[data-conductor-cursor]')).toBeNull();
    expect(() => stop()).not.toThrow();
  });

  it('marks the cursor active over an interactive element', async () => {
    setPointer(true);
    document.body.innerHTML = '<a href="#work" id="cta">Work</a>';
    const { startCursor } = await import('./cursor');
    const stop = startCursor();

    document
      .getElementById('cta')
      ?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));

    expect(
      document
        .querySelector('[data-conductor-cursor]')
        ?.getAttribute('data-cursor-state'),
    ).toBe('active');

    stop();
  });

  it('returns to rest when the pointer leaves the interactive element', async () => {
    setPointer(true);
    document.body.innerHTML = '<a href="#work" id="cta">Work</a>';
    const { startCursor } = await import('./cursor');
    const stop = startCursor();

    const cta = document.getElementById('cta');
    cta?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    cta?.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));

    expect(
      document
        .querySelector('[data-conductor-cursor]')
        ?.getAttribute('data-cursor-state'),
    ).toBe('rest');

    stop();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/motion/cursor.test.ts`

Expected: FAIL — `Failed to resolve import "./cursor"`.

- [ ] **Step 3: Write the implementation**

Create `src/motion/cursor.ts`:

```ts
import gsap from 'gsap';
import { matchesMedia } from '../lib/media-query';

const interactiveSelector = 'a[href], button, [role="button"], summary';

/**
 * A decorative cursor drawn over the real one. The native cursor is left
 * visible in CSS at all times — hiding it and then failing to draw the
 * replacement would leave a visitor with no pointer at all.
 */
export function startCursor(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  if (!matchesMedia('(pointer: fine)', false)) return () => undefined;

  const cursor = document.createElement('div');
  cursor.dataset.conductorCursor = '';
  cursor.dataset.cursorState = 'rest';
  cursor.setAttribute('aria-hidden', 'true');
  document.body.append(cursor);

  // quickTo keeps one tween alive and retargets it, instead of allocating a
  // new tween on every pointer event.
  const moveX = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
  const moveY = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });

  const onPointerMove = (event: PointerEvent) => {
    moveX(event.clientX);
    moveY(event.clientY);
  };

  const onPointerOver = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(interactiveSelector)) {
      cursor.dataset.cursorState = 'active';
    }
  };

  const onPointerOut = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(interactiveSelector)) {
      cursor.dataset.cursorState = 'rest';
    }
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerover', onPointerOver, { passive: true });
  document.addEventListener('pointerout', onPointerOut, { passive: true });

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerover', onPointerOver);
    document.removeEventListener('pointerout', onPointerOut);
    cursor.remove();
  };
}
```

- [ ] **Step 4: Write the stylesheet**

Create `src/styles/conductor.css`. Every rule that animates or transforms is
gated on `data-motion-state`, which the distribution checker requires:

```css
/*
 * Styles driven by the conductor's per-frame custom properties. The
 * `data-motion-state` gate is not optional: `scripts/check-dist.mjs` fails the
 * build for any rule that hides, animates or sticks content without it.
 */

[data-conductor-cursor] {
  position: fixed;
  inset-block-start: 0;
  inset-inline-start: 0;
  z-index: 9999;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  margin-block-start: -0.75rem;
  margin-inline-start: -0.75rem;
  border: 1px solid var(--color-cyan-300);
  border-radius: 50%;
  pointer-events: none;
  mix-blend-mode: screen;
}

[data-motion-state='enabled'] [data-conductor-cursor] {
  /*
   * Scale with shared energy, so the cursor swells as the visitor moves and
   * settles as they read. Same input the type and the canvas use.
   */
  transition:
    scale 240ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 240ms ease-out;
  scale: calc(1 + var(--c-energy, 0) * 0.6);
}

[data-motion-state='enabled']
  [data-conductor-cursor][data-cursor-state='active'] {
  scale: calc(1.9 + var(--c-energy, 0) * 0.6);
  background: rgb(70 217 245 / 0.12);
}
```

- [ ] **Step 5: Import the stylesheet**

In `src/styles/global.css`, extend the imports at the top of the file:

```css
@import './tokens.css';
@import './motion.css';
@import './conductor.css';
```

- [ ] **Step 6: Add it to the runtime**

In `src/motion/runtime.ts`:

```ts
import { startConductor } from './conductor';
import { startCursor } from './cursor';
import { startSmoothScroll } from './lenis';

export function startRuntime(): () => void {
  const disposers = [startConductor(), startSmoothScroll(), startCursor()];

  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/motion/ && pnpm build`

Expected: Vitest passes. `pnpm build` passes, proving the new CSS satisfies the
motion gate. If it fails with `changes the initial state without the
[data-motion-state='enabled'] gate`, a rule in `conductor.css` is missing the
gate.

- [ ] **Step 8: Commit**

```bash
git add src/motion/cursor.ts src/motion/cursor.test.ts src/motion/runtime.ts src/styles/conductor.css src/styles/global.css
git commit -m "feat: draw a custom cursor driven by shared energy"
```

---

### Task 11: Magnetic buttons

**Files:**

- Create: `src/motion/magnetic.ts`
- Create: `src/motion/magnetic.test.ts`
- Modify: `src/motion/runtime.ts`
- Modify: `src/components/Hero.tsx:36-43`
- Modify: `src/components/Contact.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/motion/magnetic.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { magneticOffset } from './magnetic';

const { quickTo, quickToSetter } = vi.hoisted(() => {
  const quickToSetter = vi.fn();
  return { quickToSetter, quickTo: vi.fn(() => quickToSetter) };
});

vi.mock('gsap', () => ({
  default: { quickTo },
  gsap: { quickTo },
}));

const originalMatchMedia = window.matchMedia;

function setPointer(fine: boolean) {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches: query.includes('pointer: fine') ? fine : !fine,
      }) as MediaQueryList,
  ) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.body.innerHTML = '';
  quickTo.mockClear();
  quickToSetter.mockClear();
  vi.restoreAllMocks();
});

describe('magneticOffset', () => {
  const bounds = { left: 100, top: 100, width: 200, height: 100 };

  it('reports no pull from the centre', () => {
    expect(magneticOffset(200, 150, bounds, 0.3)).toEqual({ x: 0, y: 0 });
  });

  it('pulls toward the pointer, capped by strength', () => {
    const offset = magneticOffset(300, 150, bounds, 0.3);

    expect(offset.x).toBeCloseTo(30, 6);
    expect(offset.y).toBeCloseTo(0, 6);
  });

  it('never pulls further than the element half-size', () => {
    // Beyond that the label detaches from its own background and the control
    // stops looking like a button.
    const offset = magneticOffset(10_000, 10_000, bounds, 5);

    expect(Math.abs(offset.x)).toBeLessThanOrEqual(bounds.width / 2);
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(bounds.height / 2);
  });

  it('reports no pull for a collapsed element', () => {
    expect(
      magneticOffset(0, 0, { left: 0, top: 0, width: 0, height: 0 }, 0.3),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe('startMagnetic', () => {
  it('binds every marked control for a fine pointer', async () => {
    setPointer(true);
    document.body.innerHTML =
      '<a href="#work" data-magnetic>Work</a><a href="#contact" data-magnetic>Contact</a>';
    const { startMagnetic } = await import('./magnetic');

    const stop = startMagnetic();

    // Two elements, an x and a y setter each.
    expect(quickTo).toHaveBeenCalledTimes(4);

    stop();
  });

  it('binds nothing for a coarse pointer', async () => {
    setPointer(false);
    document.body.innerHTML = '<a href="#work" data-magnetic>Work</a>';
    const { startMagnetic } = await import('./magnetic');

    const stop = startMagnetic();

    expect(quickTo).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('returns the control to rest when the pointer leaves', async () => {
    setPointer(true);
    document.body.innerHTML = '<a href="#work" id="cta" data-magnetic>Work</a>';
    const { startMagnetic } = await import('./magnetic');
    const stop = startMagnetic();
    quickToSetter.mockClear();

    document
      .getElementById('cta')
      ?.dispatchEvent(new PointerEvent('pointerleave'));

    expect(quickToSetter).toHaveBeenCalledWith(0);

    stop();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/motion/magnetic.test.ts`

Expected: FAIL — `Failed to resolve import "./magnetic"`.

- [ ] **Step 3: Write the implementation**

Create `src/motion/magnetic.ts`:

```ts
import gsap from 'gsap';
import { clamp } from './math';
import { matchesMedia } from '../lib/media-query';

export interface MagneticBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * How far a control leans toward the pointer.
 *
 * Capped at half the element's own size: past that the label separates from
 * its background and the control stops reading as a button.
 */
export function magneticOffset(
  pointerX: number,
  pointerY: number,
  bounds: MagneticBounds,
  strength: number,
): { x: number; y: number } {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };

  const centreX = bounds.left + bounds.width / 2;
  const centreY = bounds.top + bounds.height / 2;
  const limitX = bounds.width / 2;
  const limitY = bounds.height / 2;

  return {
    x: clamp((pointerX - centreX) * strength, -limitX, limitX),
    y: clamp((pointerY - centreY) * strength, -limitY, limitY),
  };
}

const strength = 0.3;

export function startMagnetic(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  // Without hover there is nothing to lean toward, and a tap would jerk the
  // control out from under the finger that pressed it.
  if (!matchesMedia('(pointer: fine)', false)) return () => undefined;

  const disposers: Array<() => void> = [];

  for (const element of document.querySelectorAll<HTMLElement>(
    '[data-magnetic]',
  )) {
    const moveX = gsap.quickTo(element, 'x', { duration: 0.4, ease: 'power3' });
    const moveY = gsap.quickTo(element, 'y', { duration: 0.4, ease: 'power3' });

    const onPointerMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const offset = magneticOffset(
        event.clientX,
        event.clientY,
        rect,
        strength,
      );
      moveX(offset.x);
      moveY(offset.y);
    };

    const onPointerLeave = () => {
      moveX(0);
      moveY(0);
    };

    element.addEventListener('pointermove', onPointerMove, { passive: true });
    element.addEventListener('pointerleave', onPointerLeave, { passive: true });
    // Keyboard focus must not leave a control displaced from where the focus
    // ring will be drawn.
    element.addEventListener('blur', onPointerLeave);

    disposers.push(() => {
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerleave', onPointerLeave);
      element.removeEventListener('blur', onPointerLeave);
      onPointerLeave();
    });
  }

  return () => {
    for (const dispose of disposers) dispose();
    disposers.length = 0;
  };
}
```

- [ ] **Step 4: Mark the controls**

In `src/components/Hero.tsx`, add `data-magnetic` to both action links:

```tsx
<div className={styles.actions}>
  <a className={styles.primaryAction} href="#work" data-magnetic>
    {content.workCta}
    <span aria-hidden="true">↘</span>
  </a>
  <a className={styles.secondaryAction} href="#contact" data-magnetic>
    {content.contactCta}
  </a>
</div>
```

Open `src/components/Contact.tsx` and add `data-magnetic` to the Telegram and
email anchors, leaving their `href`, `onClick` and label content untouched.

- [ ] **Step 5: Add it to the runtime**

In `src/motion/runtime.ts`:

```ts
import { startConductor } from './conductor';
import { startCursor } from './cursor';
import { startSmoothScroll } from './lenis';
import { startMagnetic } from './magnetic';

export function startRuntime(): () => void {
  const disposers = [
    startConductor(),
    startSmoothScroll(),
    startCursor(),
    startMagnetic(),
  ];

  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run`

Expected: PASS across the whole unit suite, including the existing
`Hero.test.tsx` and `Contact.test.tsx`, which must not notice the new
attribute.

- [ ] **Step 7: Commit**

```bash
git add src/motion/magnetic.ts src/motion/magnetic.test.ts src/motion/runtime.ts src/components/Hero.tsx src/components/Contact.tsx
git commit -m "feat: lean primary controls toward the pointer"
```

---

### Task 12: Section tracking and variable-font reveals

Two constraints shape this task:

- The hero `h1` is the LCP element and `scripts/check-dist.mjs:961` fails the
  build if it is animated to transparency. It is excluded here.
- `font-weight` may only be animated once Onest has actually loaded. Onest is
  variable (100–900) and arrives after first paint; the system fallback is not,
  so animating weight before the swap re-lays out the line and shifts layout.

**Files:**

- Create: `src/motion/reveal.ts`
- Create: `src/motion/reveal.test.ts`
- Modify: `src/styles/conductor.css`
- Modify: `src/motion/runtime.ts`
- Modify: `src/components/WorkPrinciples.tsx`
- Modify: `src/components/SelectedWork.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/motion/reveal.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const { createTrigger, kill, registerPlugin } = vi.hoisted(() => {
  const kill = vi.fn();
  return {
    kill,
    createTrigger: vi.fn(() => ({ kill })),
    registerPlugin: vi.fn(),
  };
});

vi.mock('gsap', () => ({
  default: { registerPlugin },
  gsap: { registerPlugin },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { create: createTrigger },
}));

/** Let the font-readiness promise chain settle before asserting on it. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-variable-type');
  createTrigger.mockClear();
  kill.mockClear();
  vi.restoreAllMocks();
});

describe('startReveals', () => {
  it('creates one trigger per marked section', async () => {
    document.body.innerHTML =
      '<section data-scene="work"></section><section data-scene="about"></section>';
    const { startReveals } = await import('./reveal');

    const stop = startReveals();

    expect(createTrigger).toHaveBeenCalledTimes(2);

    stop();
  });

  it('marks weight morphing only once the variable font has loaded', async () => {
    const check = vi.fn(() => true);
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { check, ready: Promise.resolve() },
    });
    const { startReveals } = await import('./reveal');

    const stop = startReveals();
    await settle();

    // Animating weight on the non-variable system fallback re-lays out the
    // line and shifts the page.
    expect(document.documentElement.dataset.variableType).toBe('ready');
    expect(check).toHaveBeenCalledWith('1rem Onest');

    stop();
    Reflect.deleteProperty(document, 'fonts');
  });

  it('leaves weight morphing off when the variable font is unavailable', async () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { check: vi.fn(() => false), ready: Promise.resolve() },
    });
    const { startReveals } = await import('./reveal');

    const stop = startReveals();
    await settle();

    expect(document.documentElement.dataset.variableType).toBeUndefined();

    stop();
    Reflect.deleteProperty(document, 'fonts');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/motion/reveal.test.ts`

Expected: FAIL — `Failed to resolve import "./reveal"`.

- [ ] **Step 3: Write the implementation**

Create `src/motion/reveal.ts`:

```ts
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setSection } from './conductor';

gsap.registerPlugin(ScrollTrigger);

/**
 * Weight morphing is only safe once Onest is really available: it is variable
 * across 100–900, while the system fallback is not, so morphing before the
 * swap re-lays out every line and shifts the page.
 */
async function markVariableTypeReady(): Promise<void> {
  const fonts = document.fonts;
  if (!fonts) return;

  try {
    await fonts.ready;
  } catch {
    return;
  }

  if (fonts.check('1rem Onest')) {
    document.documentElement.dataset.variableType = 'ready';
  }
}

export function startReveals(): () => void {
  if (typeof document === 'undefined') return () => undefined;

  void markVariableTypeReady();

  const sections = [...document.querySelectorAll<HTMLElement>('[data-scene]')];
  const triggers = sections.map((section, index) =>
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        setSection(index, section.dataset.scene ?? '', self.progress);
      },
      onEnter: () => {
        section.dataset.sceneState = 'revealed';
      },
      onEnterBack: () => {
        section.dataset.sceneState = 'revealed';
      },
    }),
  );

  return () => {
    for (const trigger of triggers) trigger.kill();
    delete document.documentElement.dataset.variableType;
  };
}
```

- [ ] **Step 4: Mark the sections**

In `src/components/WorkPrinciples.tsx`, add `data-scene="principles"` to the
`<section>` element. In `src/components/SelectedWork.tsx`, add
`data-scene="work"` to its `<section>` element. Change nothing else in either
file.

- [ ] **Step 5: Add the reveal styles**

Append to `src/styles/conductor.css`:

```css
/*
 * Weight morphing needs two gates: the motion gate the distribution checker
 * enforces, and `data-variable-type`, which is only set once Onest has really
 * loaded. Without the second, weight animates against a non-variable system
 * fallback and re-lays out the line.
 */
[data-motion-state='enabled'][data-variable-type='ready']
  [data-scene='principles']
  h2,
[data-motion-state='enabled'][data-variable-type='ready']
  [data-scene='work']
  h2 {
  font-weight: calc(320 + var(--c-section-progress, 0) * 380);
  letter-spacing: calc(var(--c-energy, 0) * -0.012em);
  transition: font-weight 120ms linear;
}

[data-motion-state='enabled'] [data-scene] [data-scene-line] {
  opacity: 0;
  transform: translate3d(0, 0.75rem, 0);
  transition:
    opacity 520ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
}

[data-motion-state='enabled']
  [data-scene][data-scene-state='revealed']
  [data-scene-line] {
  opacity: 1;
  transform: none;
}
```

- [ ] **Step 6: Add it to the runtime**

In `src/motion/runtime.ts`:

```ts
import { startConductor } from './conductor';
import { startCursor } from './cursor';
import { startSmoothScroll } from './lenis';
import { startMagnetic } from './magnetic';
import { startReveals } from './reveal';

export function startRuntime(): () => void {
  const disposers = [
    startConductor(),
    startSmoothScroll(),
    startCursor(),
    startMagnetic(),
    startReveals(),
  ];

  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}
```

- [ ] **Step 7: Run the tests and the build**

Run: `pnpm exec vitest run && pnpm build`

Expected: Vitest passes. The build passes, proving both new gated rules satisfy
the checker. The deferred figure now includes GSAP and ScrollTrigger and must
still be under 300 KiB; the eager figure must be unchanged from Task 8 Step 7.

- [ ] **Step 8: Commit**

```bash
git add src/motion/reveal.ts src/motion/reveal.test.ts src/motion/runtime.ts src/styles/conductor.css src/components/WorkPrinciples.tsx src/components/SelectedWork.tsx
git commit -m "feat: reveal sections and morph heading weight on scroll"
```

---

### Task 13: View Transitions for the locale switch

`/en/` and `/ru/` are separately prerendered documents, so moving between them
is a real cross-document navigation and the only place on this site where a
View Transition describes something that actually happens.

**Files:**

- Modify: `src/styles/conductor.css`
- Modify: `src/components/Hero.tsx`
- Create: `tests/e2e/view-transition.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/view-transition.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

test('names the shared elements for the cross-document locale transition', async ({
  page,
}) => {
  await page.goto('/en/');

  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveCSS('view-transition-name', 'hero-heading');
});

test('carries the visitor between locales with the content intact', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.getByRole('link', { name: 'Русский' }).click();

  await expect(page).toHaveURL(/\/ru\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('keeps the locale switch working without a View Transitions API', async ({
  browser,
}) => {
  // The transition is decoration on a plain link; a browser without the API
  // must still navigate.
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Reflect.deleteProperty(Document.prototype, 'startViewTransition');
  });
  const page = await context.newPage();

  await page.goto('/en/');
  await page.getByRole('link', { name: 'Русский' }).click();

  await expect(page).toHaveURL(/\/ru\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await context.close();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec playwright test tests/e2e/view-transition.spec.ts`

Expected: the first test FAILS — `view-transition-name` resolves to `none`. The
other two pass already, which is the point: they are the regression net proving
the change adds nothing the navigation depends on.

- [ ] **Step 3: Add the transition styles**

Append to `src/styles/conductor.css`:

```css
/*
 * The locale switch is a real cross-document navigation between two
 * prerendered documents, so the transition describes something that actually
 * happens. Browsers without the API ignore all of this and follow the link.
 */
@view-transition {
  navigation: auto;
}

[data-hero='landing'] h1 {
  view-transition-name: hero-heading;
}

[data-hero='landing'] figure {
  view-transition-name: hero-portrait;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec playwright test tests/e2e/view-transition.spec.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Confirm the snapshots are untouched**

Run: `pnpm exec playwright test tests/e2e/visual.spec.ts`

Expected: PASS, 6 tests, no snapshot diff. `view-transition-name` does not
paint anything on a static page; a diff here means something else changed.

- [ ] **Step 6: Commit**

```bash
git add src/styles/conductor.css tests/e2e/view-transition.spec.ts
git commit -m "feat: transition between locales as one document change"
```

---

### Task 14: End-to-end coverage of the motion contract

**Files:**

- Create: `tests/e2e/motion-runtime.spec.ts`

- [ ] **Step 1: Write the test**

Create `tests/e2e/motion-runtime.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { assertCoreContent, assertNoHorizontalOverflow } from './quality';

test.describe('desktop with motion allowed', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('runs the conductor and publishes the shared properties', async ({
    page,
  }) => {
    await page.goto('/en/');

    await expect
      .poll(() => page.locator('html').getAttribute('data-conductor'))
      .toBe('live');

    await page.mouse.move(200, 200);
    await page.mouse.move(900, 600);

    const properties = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        energy: style.getPropertyValue('--c-energy').trim(),
        pointerX: style.getPropertyValue('--c-pointer-x').trim(),
      };
    });

    expect(properties.energy).not.toBe('');
    expect(properties.pointerX).not.toBe('');
    await assertCoreContent(page, 'en');
  });

  test('adds a decorative cursor that assistive technology never meets', async ({
    page,
  }) => {
    await page.goto('/en/');

    const cursor = page.locator('[data-conductor-cursor]');
    await expect(cursor).toHaveCount(1);
    await expect(cursor).toHaveAttribute('aria-hidden', 'true');
  });

  test('keeps the focus ring where the magnetic control will settle', async ({
    page,
  }) => {
    await page.goto('/en/');

    const cta = page.getByRole('link', { name: 'View selected work' });
    await cta.hover();
    await cta.focus();

    await expect(cta).toBeFocused();
    await expect(cta).toHaveCSS('outline-style', 'solid');
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('loads no motion runtime at all', async ({ page }) => {
    const scriptRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') {
        scriptRequests.push(request.url());
      }
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en/', { waitUntil: 'networkidle' });

    // Not merely idle: these visitors must never pay for gsap or lenis.
    expect(scriptRequests.filter((url) => url.includes('runtime'))).toEqual([]);
    await expect(page.locator('html')).not.toHaveAttribute('data-conductor');
    await expect(page.locator('[data-conductor-cursor]')).toHaveCount(0);
    await assertCoreContent(page, 'en');
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('keeps every hover-dependent enhancement off and the content whole', async ({
    page,
  }) => {
    await page.goto('/en/');

    await expect(page.locator('[data-conductor-cursor]')).toHaveCount(0);
    await assertCoreContent(page, 'en');
    await assertNoHorizontalOverflow(page);
  });
});

test.describe('failure paths', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('leaves the page whole when the motion chunk cannot load', async ({
    page,
  }) => {
    // The chunk is the one file whose absence could plausibly break the page;
    // prove it cannot.
    await page.route('**/assets/runtime-*.js', (route) => route.abort());
    await page.goto('/en/', { waitUntil: 'networkidle' });

    await assertCoreContent(page, 'en');
    await assertNoHorizontalOverflow(page);
  });

  test('reports no console errors while scrolling the whole page', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/en/');
    await page.evaluate(async () => {
      const step = window.innerHeight / 2;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    });

    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm exec playwright test tests/e2e/motion-runtime.spec.ts`

Expected: PASS, 7 tests. If `leaves the page whole when the motion chunk cannot
load` fails to match, check the built chunk name with
`ls dist/assets/*.js` and adjust the glob to the emitted pattern.

- [ ] **Step 3: Run the whole browser suite**

Run: `pnpm exec playwright test`

Expected: every existing spec still passes, the six visual snapshots included.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/motion-runtime.spec.ts
git commit -m "test: cover the motion runtime and its fallback paths"
```

---

### Task 15: Verify the published guarantees still hold

Nothing new is written here. This task is where the plan proves it kept the
promises the spec made.

- [ ] **Step 1: Run the full gate**

Run: `pnpm verify`

Expected: format, lint, typecheck, the whole unit suite and the build all exit 0. Record the eager and deferred JavaScript figures from the final line.

- [ ] **Step 2: Run the browser gate**

Run: `pnpm test:e2e`

Expected: every spec passes, including the six Darwin visual snapshots with no
diff.

- [ ] **Step 3: Run Lighthouse**

Run: `pnpm exec lhci autorun`

Expected: mobile `performance >= 0.90`, `LCP <= 2500 ms`, `CLS < 0.1` on all
three URLs, matching the pre-existing baseline of 0.99 / ~2100 ms / 0.00008.

The one real risk in this plan is here: phones now fetch the motion runtime
chunk after load, which adds main-thread work Lighthouse's mobile run will see.
If `performance` falls below 0.90 or TBT rises materially, the remedy is to gate
`scheduleMotion()` on `(pointer: fine)` as well, so phones keep only the
existing CSS motion. Make that change in `src/motion/boot.ts`, add a case to
`src/motion/boot.test.ts` asserting the runtime is not loaded for a coarse
pointer, and re-run this step.

- [ ] **Step 4: Record the evidence**

Append a section to `docs/launch-checklist.md` in the format the existing
sections use: the commands run, the unit and browser test counts, the eager and
deferred JavaScript figures, the worst initial transfer, and the median
Lighthouse table.

- [ ] **Step 5: Commit**

```bash
git add docs/launch-checklist.md
git commit -m "docs: record the motion layer quality gates"
```

---

## What this plan deliberately leaves out

The WebGL stage, the interactive 3D object, shader-distorted screenshots, the
particle field, the runtime quality downgrade controller and the desktop
Lighthouse run. Those are plan B, and they build on the `webglTier` value
`selectTier` already returns here.

Also out of scope, exactly as the spec says: new copy, new imagery, changes to
the approved content model, analytics events for motion, and any change to the
personal-photo publication gate.
