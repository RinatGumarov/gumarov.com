import { describe, expect, it } from 'vitest';
import { getContent } from './index';
import { personalPhotoSlugs, screenshotProjectSlugs } from './types';

const locales = ['en', 'ru'] as const;

function collectStrings(
  value: unknown,
  pathName = '',
  collected: [string, string][] = [],
): [string, string][] {
  if (typeof value === 'string') {
    collected.push([pathName, value]);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectStrings(item, `${pathName}[${index}]`, collected),
    );
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectStrings(child, pathName ? `${pathName}.${key}` : key, collected);
    }
  }

  return collected;
}

/*
 * TypeScript makes the two locales the same shape. What it cannot see is a
 * field left in English on the Russian page, or an empty string standing in
 * for copy that was never written — which is the failure mode a bilingual page
 * actually has.
 */
describe('landing content', () => {
  it.each(locales)('carries no empty copy in %s', (locale) => {
    const empty = collectStrings(getContent(locale))
      .filter(([, value]) => value.trim() === '')
      .map(([path]) => path);

    expect(empty).toEqual([]);
  });

  it('keeps the same projects, in the same order, in both locales', () => {
    const en = getContent('en').projects;
    const ru = getContent('ru').projects;

    for (const key of ['slug', 'href', 'media'] as const) {
      expect(ru.map((project) => project[key])).toEqual(
        en.map((project) => project[key]),
      );
    }
  });

  it('translates every eyebrow and photo description into Russian', () => {
    const en = getContent('en');
    const ru = getContent('ru');

    // An eyebrow also reaches the screen-reader fallback, so English there is
    // English announced on the Russian page.
    for (const project of ru.projects) {
      expect(project.eyebrow).toMatch(/\p{Script=Cyrillic}/u);
    }
    expect(en.personal.photos.map((entry) => entry.slug)).toEqual([
      ...personalPhotoSlugs,
    ]);
    for (const [index, entry] of en.personal.photos.entries()) {
      expect(ru.personal.photos[index]?.alt).not.toBe(entry.alt);
    }
  });

  /*
   * A text scene renders no figure, so a screenshot declared for one would be
   * copy — and alt text — that reaches nobody.
   */
  it.each(locales)(
    'ships a capture for exactly the %s scenes that show one',
    (locale) => {
      const content = getContent(locale);

      expect(
        content.projects
          .filter((project) => project.media === 'screenshot')
          .map((project) => project.slug),
      ).toEqual([...screenshotProjectSlugs]);
      expect(content.projectScreenshots.map((shot) => shot.slug)).toEqual([
        ...screenshotProjectSlugs,
      ]);
    },
  );

  it('gives each locale its own title, description and social card', () => {
    const en = getContent('en').meta;
    const ru = getContent('ru').meta;

    expect(en.title).not.toBe(ru.title);
    expect(en.description).not.toBe(ru.description);
    expect(en.ogImageAlt).not.toBe(ru.ogImageAlt);
    expect([en.ogLocale, ru.ogLocale]).toEqual(['en_US', 'ru_RU']);
    expect([en.ogImage, ru.ogImage]).toEqual(['/og-en.jpg', '/og-ru.jpg']);
  });
});
