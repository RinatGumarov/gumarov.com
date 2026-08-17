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
