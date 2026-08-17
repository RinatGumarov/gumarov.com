import { afterEach, describe, expect, it, vi } from 'vitest';

/** The subset of the ScrollTrigger config these tests drive. */
interface TriggerConfig {
  trigger: HTMLElement;
  onUpdate: (self: { progress: number }) => void;
  onEnter: () => void;
  onEnterBack: () => void;
}

const { createTrigger, kill, registerPlugin } = vi.hoisted(() => {
  const kill = vi.fn();
  return {
    kill,
    // Typed through vi.fn's parameter rather than an unused argument, so
    // `mock.calls` is typed without declaring a value nothing reads.
    createTrigger: vi.fn<(config: TriggerConfig) => { kill: () => void }>(
      () => ({ kill }),
    ),
    registerPlugin: vi.fn(),
  };
});

vi.mock('gsap', () => ({
  default: { registerPlugin },
  gsap: { registerPlugin },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { create: createTrigger },
}));

/** The config the nth ScrollTrigger was created with, or a clear failure. */
function triggerConfig(index: number): TriggerConfig {
  const config = createTrigger.mock.calls[index]?.[0];
  if (!config)
    throw new Error(`no ScrollTrigger was created at index ${index}`);
  return config;
}

/** Let the font-readiness promise chain settle before asserting on it. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-variable-type');
  createTrigger.mockClear();
  kill.mockClear();
  vi.restoreAllMocks();
});

describe('startReveals', () => {
  it('creates one trigger per marked section', async () => {
    document.body.innerHTML =
      '<section data-scene="work"></section><section data-scene="about"></section>';
    const { startReveals } = await import('./reveal');

    const stop = startReveals();

    expect(createTrigger).toHaveBeenCalledTimes(2);

    stop();
    expect(kill).toHaveBeenCalledTimes(2);
  });

  it('publishes the section index, id and progress as it scrolls', async () => {
    document.body.innerHTML =
      '<section data-scene="work"></section><section data-scene="about"></section>';
    const { startReveals } = await import('./reveal');
    const { readConductor } = await import('./conductor');

    const stop = startReveals();
    triggerConfig(1).onUpdate({ progress: 0.42 });

    expect(readConductor().section).toEqual({
      index: 1,
      id: 'about',
      progress: 0.42,
    });

    stop();
  });

  it('marks a section revealed once it enters', async () => {
    document.body.innerHTML = '<section data-scene="work"></section>';
    const { startReveals } = await import('./reveal');

    const stop = startReveals();
    triggerConfig(0).onEnter();

    expect(
      document
        .querySelector('[data-scene="work"]')
        ?.getAttribute('data-scene-state'),
    ).toBe('revealed');

    stop();
  });

  it('opens the hiding gate only after the triggers exist', async () => {
    document.body.innerHTML = '<section data-scene="work"></section>';
    const { startReveals } = await import('./reveal');

    const stop = startReveals();

    expect(document.documentElement.dataset.sceneReveals).toBe('ready');

    // Teardown must close it again, or the copy stays hidden with nothing
    // left running to reveal it.
    stop();
    expect(document.documentElement.dataset.sceneReveals).toBeUndefined();
  });

  it('never opens the hiding gate when trigger creation fails', async () => {
    // The failure that matters: CSS hides the lines and the deferred chunk
    // that would reveal them is gone. The copy must simply stay visible.
    document.body.innerHTML = '<section data-scene="work"></section>';
    createTrigger.mockImplementationOnce(() => {
      throw new Error('ScrollTrigger unavailable');
    });
    const { startReveals } = await import('./reveal');

    expect(() => startReveals()).toThrow();
    expect(document.documentElement.dataset.sceneReveals).toBeUndefined();
  });

  it('reveals a section that is already on screen before opening the gate', async () => {
    document.body.innerHTML = '<section data-scene="work"></section>';
    const section = document.querySelector<HTMLElement>('[data-scene="work"]');
    vi.spyOn(section as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 400,
    } as DOMRect);
    const { startReveals } = await import('./reveal');

    const stop = startReveals();

    // Otherwise the hero-adjacent section flashes visible, hidden, visible.
    expect(section?.dataset.sceneState).toBe('revealed');

    stop();
  });

  it('marks weight morphing only once the variable font has loaded', async () => {
    const check = vi.fn(() => true);
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { check, ready: Promise.resolve() },
    });
    const { startReveals } = await import('./reveal');

    const stop = startReveals();
    await settle();

    // Animating weight on the non-variable system fallback re-lays out the
    // line and shifts the page.
    expect(document.documentElement.dataset.variableType).toBe('ready');
    expect(check).toHaveBeenCalledWith('1rem Onest');

    stop();
    Reflect.deleteProperty(document, 'fonts');
  });

  it('leaves weight morphing off when the variable font is unavailable', async () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { check: vi.fn(() => false), ready: Promise.resolve() },
    });
    const { startReveals } = await import('./reveal');

    const stop = startReveals();
    await settle();

    expect(document.documentElement.dataset.variableType).toBeUndefined();

    stop();
    Reflect.deleteProperty(document, 'fonts');
  });

  it('survives a font set that never becomes ready', async () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        check: vi.fn(() => true),
        ready: Promise.reject(new Error('no')),
      },
    });
    const { startReveals } = await import('./reveal');

    const stop = startReveals();
    await settle();

    expect(document.documentElement.dataset.variableType).toBeUndefined();

    stop();
    Reflect.deleteProperty(document, 'fonts');
  });
});
