import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConductor, setSection, startConductor } from './conductor';

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-conductor');
  vi.restoreAllMocks();
});

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

describe('startConductor', () => {
  it('marks the document while it is running and clears it on stop', async () => {
    stop = startConductor();
    await nextFrame();

    expect(document.documentElement.dataset.conductor).toBe('live');

    stop();
    expect(document.documentElement.dataset.conductor).toBeUndefined();
  });

  it('writes the shared custom properties once a frame has run', async () => {
    stop = startConductor();
    await nextFrame();
    await nextFrame();

    const style = document.documentElement.style;
    expect(style.getPropertyValue('--c-energy')).not.toBe('');
    expect(style.getPropertyValue('--c-pointer-x')).not.toBe('');
    expect(style.getPropertyValue('--c-pointer-y')).not.toBe('');
    expect(style.getPropertyValue('--c-scroll-velocity')).not.toBe('');
    expect(style.getPropertyValue('--c-section-progress')).not.toBe('');
  });

  it('does not start a second loop', async () => {
    stop = startConductor();
    const secondStop = startConductor();
    await nextFrame();
    await nextFrame();

    // The no-op returned by the second call must not tear down the first.
    secondStop();
    expect(document.documentElement.dataset.conductor).toBe('live');

    // And there is exactly one loop, so the first disposer stops everything.
    // A second loop would keep advancing time after this.
    stop();
    const elapsedAfterStop = readConductor().time.elapsed;
    await settle();

    expect(readConductor().time.elapsed).toBe(elapsedAfterStop);
  });

  it('survives being stopped twice', async () => {
    stop = startConductor();
    await nextFrame();

    stop();
    expect(() => stop?.()).not.toThrow();
  });

  it('tracks pointer movement into the shared state', async () => {
    stop = startConductor();
    await nextFrame();

    // jsdom 26 has no PointerEvent constructor. The listener reads only
    // clientX/clientY, so a MouseEvent of the same type exercises it exactly.
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 120, clientY: 48 }),
    );
    await nextFrame();
    await nextFrame();

    expect(readConductor().pointer.x).toBe(120);
    expect(readConductor().pointer.y).toBe(48);
  });

  it('stops the loop while the document is hidden', async () => {
    stop = startConductor();
    await nextFrame();
    await nextFrame();

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    // Measure elapsed time rather than counting requestAnimationFrame calls:
    // the test's own `nextFrame` helper calls it too, so a spy would count
    // the test as if it were the loop.
    const elapsedWhenHidden = readConductor().time.elapsed;
    await settle();

    expect(document.documentElement.dataset.conductor).toBe('paused');
    expect(readConductor().time.elapsed).toBe(elapsedWhenHidden);
  });
});

describe('setSection', () => {
  it('publishes the active section to the shared state', async () => {
    stop = startConductor();
    await nextFrame();

    setSection(2, 'about', 0.5);
    await nextFrame();
    await nextFrame();

    expect(readConductor().section).toEqual({
      index: 2,
      id: 'about',
      progress: 0.5,
    });
    expect(
      document.documentElement.style.getPropertyValue('--c-section-progress'),
    ).toBe('0.500');
  });
});
