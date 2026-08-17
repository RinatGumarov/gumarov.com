import gsap from 'gsap';
import { matchesMedia } from '../lib/media-query';
import { clamp } from './math';

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

    const settle = () => {
      moveX(0);
      moveY(0);
    };

    element.addEventListener('pointermove', onPointerMove, { passive: true });
    element.addEventListener('pointerleave', settle, { passive: true });
    // Keyboard focus must not leave a control displaced from where the focus
    // ring will be drawn.
    element.addEventListener('blur', settle);

    disposers.push(() => {
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerleave', settle);
      element.removeEventListener('blur', settle);
      settle();
    });
  }

  return () => {
    for (const dispose of disposers) dispose();
    disposers.length = 0;
  };
}
