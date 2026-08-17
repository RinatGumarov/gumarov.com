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
