import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setSection } from './conductor';

gsap.registerPlugin(ScrollTrigger);

/**
 * Weight morphing is only safe once Onest is really available: it is variable
 * across 100–900, while the system fallback is not, so morphing before the
 * swap re-lays out every line and shifts the page. Onest deliberately loads
 * after first paint, so this cannot be assumed.
 */
async function markVariableTypeReady(): Promise<void> {
  const fonts = document.fonts;
  if (!fonts) return;

  try {
    await fonts.ready;
  } catch {
    return;
  }

  if (fonts.check('1rem Onest')) {
    document.documentElement.dataset.variableType = 'ready';
  }
}

export function startReveals(): () => void {
  if (typeof document === 'undefined') return () => undefined;

  void markVariableTypeReady();

  const sections = [...document.querySelectorAll<HTMLElement>('[data-scene]')];
  const triggers = sections.map((section, index) =>
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        setSection(index, section.dataset.scene ?? '', self.progress);
      },
      onEnter: () => {
        section.dataset.sceneState = 'revealed';
      },
      onEnterBack: () => {
        section.dataset.sceneState = 'revealed';
      },
    }),
  );

  /*
   * A section already on screen is revealed before the gate opens, so nothing
   * flashes from visible to hidden and back on load. Done from the rect rather
   * than from ScrollTrigger's onEnter, which is not guaranteed to have fired
   * by the time this returns.
   */
  for (const section of sections) {
    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      section.dataset.sceneState = 'revealed';
    }
  }

  /*
   * Only now may CSS hide an unrevealed line. This attribute is the proof that
   * the code which reveals them is alive: `data-motion-state` cannot serve,
   * because the eager bundle sets that one, and a failed runtime chunk would
   * leave the copy hidden with nothing left to reveal it.
   */
  document.documentElement.dataset.sceneReveals = 'ready';

  return () => {
    for (const trigger of triggers) trigger.kill();
    delete document.documentElement.dataset.sceneReveals;
    delete document.documentElement.dataset.variableType;
  };
}
