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
    // Thrown explicitly rather than leaning on jsdom's unimplemented
    // getContext: that is an implementation detail of the test environment,
    // and letting it throw for real logs a stack trace on every test run.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => {
        throw new Error('not implemented');
      },
    );

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
  it('reads a snapshot without throwing when nothing is available', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => {
        throw new Error('not implemented');
      },
    );

    const result = readCapabilities();

    expect(result.viewportWidth).toBe(window.innerWidth);
    expect(result.webgl2).toBe(false);
    // Nothing reports save-data in this environment, and an absent hint must
    // never read as "the visitor asked us to hold back".
    expect(result.saveData).toBe(false);
  });
});
