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
