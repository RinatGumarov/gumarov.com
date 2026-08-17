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
