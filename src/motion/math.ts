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
