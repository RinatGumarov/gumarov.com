import { afterEach, describe, expect, it, vi } from 'vitest';
import { startConductor } from './conductor';
import { startCursor } from './cursor';

const originalMatchMedia = window.matchMedia;
let stopConductor: (() => void) | undefined;

function setPointer(fine: boolean) {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches: query.includes('pointer: fine') ? fine : !fine,
      }) as MediaQueryList,
  ) as unknown as typeof window.matchMedia;
}

// jsdom 26 has no PointerEvent constructor; the listeners read only `target`
// and the client coordinates, so a MouseEvent of the same type is equivalent.
function pointer(type: string, init: MouseEventInit = {}) {
  return new MouseEvent(type, { bubbles: true, ...init });
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function cursorElement() {
  return document.querySelector<HTMLElement>('[data-conductor-cursor]');
}

afterEach(() => {
  stopConductor?.();
  stopConductor = undefined;
  window.matchMedia = originalMatchMedia;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('startCursor', () => {
  it('adds one hidden-from-assistive-technology cursor element', () => {
    setPointer(true);

    const stop = startCursor();

    const cursor = cursorElement();
    expect(cursor).not.toBeNull();
    // It is decoration over content that is already announced; a screen reader
    // must not meet it at all.
    expect(cursor?.getAttribute('aria-hidden')).toBe('true');

    stop();
    expect(cursorElement()).toBeNull();
  });

  it('adds nothing for a coarse pointer', () => {
    setPointer(false);

    const stop = startCursor();

    expect(cursorElement()).toBeNull();
    expect(() => stop()).not.toThrow();
  });

  it('marks the cursor active over an interactive element', () => {
    setPointer(true);
    document.body.innerHTML = '<a href="#work" id="cta">Work</a>';
    const stop = startCursor();

    document.getElementById('cta')?.dispatchEvent(pointer('pointerover'));

    expect(cursorElement()?.dataset.cursorState).toBe('active');

    stop();
  });

  it('returns to rest when the pointer leaves the interactive element', () => {
    setPointer(true);
    document.body.innerHTML = '<a href="#work" id="cta">Work</a>';
    const stop = startCursor();

    const cta = document.getElementById('cta');
    cta?.dispatchEvent(pointer('pointerover'));
    cta?.dispatchEvent(pointer('pointerout'));

    expect(cursorElement()?.dataset.cursorState).toBe('rest');

    stop();
  });

  it('ignores movement over ordinary text', () => {
    setPointer(true);
    document.body.innerHTML = '<p id="copy">Not interactive</p>';
    const stop = startCursor();

    document.getElementById('copy')?.dispatchEvent(pointer('pointerover'));

    expect(cursorElement()?.dataset.cursorState).toBe('rest');

    stop();
  });

  it('follows the pointer with a transform, not with layout properties', async () => {
    // A transform is compositor-only. Animating inset or margin instead would
    // put a layout pass on every frame for the one element that moves most.
    setPointer(true);
    stopConductor = startConductor();
    const stop = startCursor();

    window.dispatchEvent(
      pointer('pointermove', { clientX: 400, clientY: 300 }),
    );
    for (let frame = 0; frame < 12; frame += 1) await nextFrame();

    const transform = cursorElement()?.style.transform ?? '';
    expect(transform).toMatch(/^translate3d\(/);
    expect(transform).not.toBe('translate3d(0.0px, 0.0px, 0)');

    stop();
  });

  it('stops its frame work on teardown', async () => {
    setPointer(true);
    stopConductor = startConductor();
    const stop = startCursor();
    await nextFrame();

    const cursor = cursorElement();
    stop();
    // The element is gone, so a surviving frame callback would throw on it.
    window.dispatchEvent(
      pointer('pointermove', { clientX: 900, clientY: 700 }),
    );
    await nextFrame();
    await nextFrame();

    expect(cursor?.isConnected).toBe(false);
  });
});
