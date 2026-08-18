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
/*
 * Only the properties CSS actually reads are published.
 *
 * Setting a custom property on the root invalidates style for the whole
 * document, and doing it per frame is by far the most expensive thing this
 * loop does: measured at 12x CPU throttling, publishing five properties at
 * three decimals cost 25ms of p95 frame gap on its own. Pointer position and
 * scroll velocity had no CSS consumer at all, so that cost bought nothing.
 * They remain on the state object, which JavaScript consumers read directly
 * with no style cost; add them back here only alongside a rule that reads them.
 */
const publishedProperties = ['--c-energy', '--c-section-progress'] as const;

/*
 * Two decimals, not three. Combined with the change guard below this is what
 * makes the writes rare: at three decimals nearly every frame differed, so the
 * guard almost never fired. Neither consumer — a scale factor and a font
 * weight — can show the third decimal.
 */
function quantise(value: number) {
  return value.toFixed(2);
}

const lastWritten = new Map<string, string>();

function writeProperty(name: string, value: string) {
  if (lastWritten.get(name) === value) return;
  lastWritten.set(name, value);
  document.documentElement.style.setProperty(name, value);
}

function publish() {
  writeProperty('--c-energy', quantise(state.energy));
  writeProperty('--c-section-progress', quantise(state.section.progress));
}

/*
 * Cached rather than read per frame. `scrollHeight` is a layout-forcing read,
 * and this loop writes custom properties on the same element, so reading it
 * every frame made the browser flush layout synchronously sixty times a
 * second. Measured at 12x CPU throttling that alone dominated the frame
 * budget. The document only changes height on resize and on font swap, so
 * that is when it is recomputed.
 */
let scrollRange = 0;
let viewportWidth = 0;
let viewportHeight = 0;
let devicePixelRatio = 1;

function measureLayout() {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  devicePixelRatio = window.devicePixelRatio || 1;
  scrollRange = Math.max(
    0,
    document.documentElement.scrollHeight - viewportHeight,
  );
}

function readSample(): FrameSample {
  return {
    scrollY: window.scrollY,
    scrollRange,
    pointerX,
    pointerY,
    pointerDown,
    viewportWidth,
    viewportHeight,
    devicePixelRatio,
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
  measureLayout();
  document.documentElement.dataset.conductor = 'live';

  window.addEventListener('resize', measureLayout, { passive: true });
  window.addEventListener('load', measureLayout, { once: true });
  // The deferred brand fonts reflow the page after they swap in, which changes
  // the document height without a resize event.
  document.fonts?.ready.then(measureLayout).catch(() => undefined);
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
    window.removeEventListener('resize', measureLayout);
    window.removeEventListener('load', measureLayout);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    document.removeEventListener('visibilitychange', onVisibilityChange);

    lastWritten.clear();
    for (const name of publishedProperties) {
      document.documentElement.style.removeProperty(name);
    }
    delete document.documentElement.dataset.conductor;
  };
}
