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
