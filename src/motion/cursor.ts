import gsap from 'gsap';
import { matchesMedia } from '../lib/media-query';

const interactiveSelector = 'a[href], button, [role="button"], summary';

/**
 * A decorative cursor drawn over the real one. The native cursor is left
 * visible in CSS at all times — hiding it and then failing to draw the
 * replacement would leave a visitor with no pointer at all.
 */
export function startCursor(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  if (!matchesMedia('(pointer: fine)', false)) return () => undefined;

  const cursor = document.createElement('div');
  cursor.dataset.conductorCursor = '';
  cursor.dataset.cursorState = 'rest';
  cursor.setAttribute('aria-hidden', 'true');
  document.body.append(cursor);

  // quickTo keeps one tween alive and retargets it, instead of allocating a
  // new tween on every pointer event.
  const moveX = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
  const moveY = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });

  const onPointerMove = (event: PointerEvent) => {
    moveX(event.clientX);
    moveY(event.clientY);
  };

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

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerover', onPointerOver, { passive: true });
  document.addEventListener('pointerout', onPointerOut, { passive: true });

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerover', onPointerOver);
    document.removeEventListener('pointerout', onPointerOut);
    cursor.remove();
  };
}
