import { afterEach, describe, expect, it, vi } from 'vitest';

const { quickTo, quickToSetter } = vi.hoisted(() => {
  const quickToSetter = vi.fn();
  return { quickToSetter, quickTo: vi.fn(() => quickToSetter) };
});

vi.mock('gsap', () => ({
  default: { quickTo },
  gsap: { quickTo },
}));

const originalMatchMedia = window.matchMedia;

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

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.body.innerHTML = '';
  quickTo.mockClear();
  quickToSetter.mockClear();
  vi.restoreAllMocks();
});

describe('startCursor', () => {
  it('adds one hidden-from-assistive-technology cursor element', async () => {
    setPointer(true);
    const { startCursor } = await import('./cursor');

    const stop = startCursor();

    const cursor = document.querySelector('[data-conductor-cursor]');
    expect(cursor).not.toBeNull();
    // It is decoration over content that is already announced; a screen reader
    // must not meet it at all.
    expect(cursor?.getAttribute('aria-hidden')).toBe('true');

    stop();
    expect(document.querySelector('[data-conductor-cursor]')).toBeNull();
  });

  it('adds nothing for a coarse pointer', async () => {
    setPointer(false);
    const { startCursor } = await import('./cursor');

    const stop = startCursor();

    expect(document.querySelector('[data-conductor-cursor]')).toBeNull();
    expect(() => stop()).not.toThrow();
  });

  it('marks the cursor active over an interactive element', async () => {
    setPointer(true);
    document.body.innerHTML = '<a href="#work" id="cta">Work</a>';
    const { startCursor } = await import('./cursor');
    const stop = startCursor();

    document.getElementById('cta')?.dispatchEvent(pointer('pointerover'));

    expect(
      document
        .querySelector('[data-conductor-cursor]')
        ?.getAttribute('data-cursor-state'),
    ).toBe('active');

    stop();
  });

  it('returns to rest when the pointer leaves the interactive element', async () => {
    setPointer(true);
    document.body.innerHTML = '<a href="#work" id="cta">Work</a>';
    const { startCursor } = await import('./cursor');
    const stop = startCursor();

    const cta = document.getElementById('cta');
    cta?.dispatchEvent(pointer('pointerover'));
    cta?.dispatchEvent(pointer('pointerout'));

    expect(
      document
        .querySelector('[data-conductor-cursor]')
        ?.getAttribute('data-cursor-state'),
    ).toBe('rest');

    stop();
  });

  it('ignores movement over ordinary text', async () => {
    setPointer(true);
    document.body.innerHTML = '<p id="copy">Not interactive</p>';
    const { startCursor } = await import('./cursor');
    const stop = startCursor();

    document.getElementById('copy')?.dispatchEvent(pointer('pointerover'));

    expect(
      document
        .querySelector('[data-conductor-cursor]')
        ?.getAttribute('data-cursor-state'),
    ).toBe('rest');

    stop();
  });
});
