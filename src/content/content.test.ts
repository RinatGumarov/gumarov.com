import { describe, expect, it } from 'vitest';
import { getContent } from './index';
import { personalPhotoSlugs, screenshotProjectSlugs } from './types';

const locales = ['en', 'ru'] as const;

/** Every string in the content tree, with its path, for structural checks. */
function collectStrings(
  value: unknown,
  pathName = '',
  collected: [string, string][] = [],
): [string, string][] {
  if (typeof value === 'string') {
    collected.push([pathName, value]);
    return collected;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectStrings(item, `${pathName}[${index}]`, collected),
    );
    return collected;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectStrings(child, pathName ? `${pathName}.${key}` : key, collected);
    }
  }

  return collected;
}

describe('landing content', () => {
  it.each(locales)('carries no empty copy in %s', (locale) => {
    const empty = collectStrings(getContent(locale))
      .filter(([, value]) => value.trim() === '')
      .map(([path]) => path);

    expect(empty).toEqual([]);
  });

  /*
   * Both locales are one structure with two sets of words. Everything below
   * checks that they stayed that way — a field translated in one locale and
   * forgotten in the other is the failure mode a bilingual page actually has.
   */
  it('keeps the same projects, in the same order, in both locales', () => {
    const en = getContent('en').projects;
    const ru = getContent('ru').projects;

    expect(en.map((project) => project.slug)).toEqual([
      'tradingview',
      'stoic',
      'splithub',
      'evercity',
    ]);
    expect(ru.map((project) => project.slug)).toEqual(
      en.map((project) => project.slug),
    );
    expect(ru.map((project) => project.href)).toEqual(
      en.map((project) => project.href),
    );
    expect(ru.map((project) => project.media)).toEqual(
      en.map((project) => project.media),
    );
  });

  it('translates every project eyebrow rather than reusing the English one', () => {
    const en = getContent('en').projects;
    const ru = getContent('ru').projects;

    for (const [index, project] of en.entries()) {
      const russian = ru[index];

      expect(russian?.eyebrow).not.toBe(project.eyebrow);
      // Not merely different: an eyebrow also reaches the screen-reader
      // fallback for a scene whose capture is gone, so English there is
      // English announced on the Russian page.
      expect(russian?.eyebrow).toMatch(/\p{Script=Cyrillic}/u);
    }
  });

  it('describes every personal photo in both locales', () => {
    const en = getContent('en').personal.photos;
    const ru = getContent('ru').personal.photos;

    expect(en.map((photo) => photo.slug)).toEqual([...personalPhotoSlugs]);
    expect(ru.map((photo) => photo.slug)).toEqual(
      en.map((photo) => photo.slug),
    );
    for (const [index, photo] of en.entries()) {
      expect(ru[index]?.alt).not.toBe(photo.alt);
    }
  });

  /*
   * The media mode is the contract, not "a screenshot entry happens to be
   * missing". A scene in text mode renders no figure at all, so a screenshot
   * declared for one would be copy — and an alt string — that reaches nobody.
   */
  it.each(locales)(
    'ships a capture for exactly the screenshot scenes in %s',
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

      for (const project of content.projects) {
        // `proofs` render beneath a capture, so a text case must not carry them.
        if (project.media === 'text') expect(project.proofs).toBeUndefined();
      }
    },
  );

  it.each(locales)('offers the same direct contact details in %s', (locale) => {
    const contact = getContent(locale).contact;

    expect(contact.telegramHref).toBe('https://t.me/RinatGumarov');
    expect(contact.telegramHandle).toBe('@RinatGumarov');
    expect(contact.emailHref).toBe('mailto:hi@gumarov.com');
    expect(contact.emailAddress).toBe('hi@gumarov.com');
  });

  it('gives each locale its own sharing metadata', () => {
    const en = getContent('en').meta;
    const ru = getContent('ru').meta;

    expect([en.ogLocale, ru.ogLocale]).toEqual(['en_US', 'ru_RU']);
    expect([en.ogAlternateLocale, ru.ogAlternateLocale]).toEqual([
      'ru_RU',
      'en_US',
    ]);
    expect([en.ogImage, ru.ogImage]).toEqual(['/og-en.jpg', '/og-ru.jpg']);
    expect(en.title).not.toBe(ru.title);
    expect(en.description).not.toBe(ru.description);
    expect(en.ogImageAlt).not.toBe(ru.ogImageAlt);
  });

  it('points both locales at the same performance lab', () => {
    const en = getContent('en').performanceLab;
    const ru = getContent('ru').performanceLab;

    expect(ru.name).toBe(en.name);
    expect(ru.demoHref).toBe(en.demoHref);
    expect(ru.sourceHref).toBe(en.sourceHref);
    expect(ru.thesis).not.toBe(en.thesis);
  });
});
