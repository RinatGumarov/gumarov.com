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
