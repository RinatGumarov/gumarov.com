import { matchesMedia } from '../lib/media-query';
import { onFrame, readConductor } from './conductor';
import { damp } from './math';

const interactiveSelector = 'a[href], button, [role="button"], summary';

/** How long the cursor takes to close half the distance to the pointer. */
const followHalfLifeMs = 60;

/**
 * A decorative cursor drawn over the real one. The native cursor is left
 * visible in CSS at all times — hiding it and then failing to draw the
 * replacement would leave a visitor with no pointer at all.
 *
 * It follows with the conductor's own damping and writes a transform, rather
 * than through a GSAP tween. This is the one element that moves on every single
 * frame, and a tween meant GSAP's ticker ran continuously alongside the
 * conductor's loop for the whole session. A transform is compositor-only, so
 * the follow costs no layout or paint.
 */
export function startCursor(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  if (!matchesMedia('(pointer: fine)', false)) return () => undefined;

  const cursor = document.createElement('div');
  cursor.dataset.conductorCursor = '';
  cursor.dataset.cursorState = 'rest';
  cursor.setAttribute('aria-hidden', 'true');
  document.body.append(cursor);

  // Start where the pointer already is, so the cursor does not fly in from the
  // top-left corner on its first frame.
  const { pointer } = readConductor();
  let x = pointer.x;
  let y = pointer.y;

  const stopFrame = onFrame(() => {
    const state = readConductor();
    x = damp(x, state.pointer.x, followHalfLifeMs, state.time.delta);
    y = damp(y, state.pointer.y, followHalfLifeMs, state.time.delta);
    cursor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  });

  const onPointerOver = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(interactiveSelector)) {
      cursor.dataset.cursorState = 'active';
    }
  };

  const onPointerOut = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(interactiveSelector)) {
      cursor.dataset.cursorState = 'rest';
    }
  };

  document.addEventListener('pointerover', onPointerOver, { passive: true });
  document.addEventListener('pointerout', onPointerOut, { passive: true });

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    stopFrame();
    document.removeEventListener('pointerover', onPointerOver);
    document.removeEventListener('pointerout', onPointerOut);
    cursor.remove();
  };
}
