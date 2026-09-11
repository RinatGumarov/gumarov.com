import { describe, expect, it } from 'vitest';
import { getContent } from './index';
import { personalPhotoSlugs, type ProjectVariant } from './types';

const expectedProjectSlugs = ['tradingview', 'stoic', 'splithub', 'evercity'];
const expectedProjectLinks = [
  'https://www.tradingview.com/',
  'https://stoic.ai/',
  'https://splithub.app/',
  'https://evercity.io/',
];
const expectedProjectVariants: Record<
  (typeof expectedProjectSlugs)[number],
  ProjectVariant
> = {
  tradingview: 'lead',
  stoic: 'major',
  splithub: 'product',
  evercity: 'compact',
};

describe('landing content', () => {
  it.each(['en', 'ru'] as const)('returns complete %s copy', (locale) => {
    const content = getContent(locale);

    expect(content.meta.title).not.toBe('');
    expect(content.meta.description).not.toBe('');
    expect(Object.values(content.nav)).toHaveLength(3);
    expect(content.hero.identity).not.toBe('');
    expect(content.hero.eyebrow).not.toBe('');
    expect(content.hero.body).not.toBe('');
    expect(content.hero.workCta).not.toBe('');
    expect(content.hero.contactCta).not.toBe('');
    expect(content.projectsHeading).not.toBe('');
    expect(content.engineering.heading).not.toBe('');
    expect(content.engineering.items.length).toBeGreaterThan(0);
    expect(content.personal.heading).not.toBe('');
    expect(content.personal.body).not.toBe('');
    expect(content.personal.items.length).toBeGreaterThan(0);
    expect(content.contact.heading).not.toBe('');
    expect(content.contact.body).not.toBe('');
    expect(content.footer.privacy).not.toBe('');
  });

  it.each(['en', 'ru'] as const)(
    'keeps the approved project order and destinations in %s',
    (locale) => {
      const projects = getContent(locale).projects;

      expect(projects.map((project) => project.slug)).toEqual(
        expectedProjectSlugs,
      );
      expect(projects.map((project) => project.href)).toEqual(
        expectedProjectLinks,
      );
    },
  );

  it('keeps four unique project slugs', () => {
    const slugs = getContent('en').projects.map((project) => project.slug);

    expect(slugs).toHaveLength(4);
    expect(new Set(slugs).size).toBe(4);
  });

  it.each(['en', 'ru'] as const)(
    'assigns the approved scene variant to each project in %s',
    (locale) => {
      const projects = getContent(locale).projects;

      for (const project of projects) {
        expect(project.variant).toBe(expectedProjectVariants[project.slug]);
        expect(project.linkLabel).not.toBe('');
      }
    },
  );

  it.each(['en', 'ru'] as const)(
    'gives the hero exactly three uncounted proof points in %s',
    (locale) => {
      const proofPoints = getContent(locale).hero.proofPoints;

      expect(proofPoints).toHaveLength(3);
      for (const point of proofPoints) {
        expect(point.value).not.toBe('');
        expect(point.label).not.toBe('');
      }
    },
  );

  it.each(['en', 'ru'] as const)(
    'gives the hero two non-empty, distinct title lines in %s',
    (locale) => {
      const [first, second] = getContent(locale).hero.titleLines;

      expect(first.trim().length).toBeGreaterThan(0);
      expect(second.trim().length).toBeGreaterThan(0);
      expect(first).not.toBe(second);
    },
  );

  it.each(['en', 'ru'] as const)(
    'offers the approved direct contact details in %s',
    (locale) => {
      const contact = getContent(locale).contact;

      expect(contact.telegramHref).toBe('https://t.me/RinatGumarov');
      expect(contact.telegramHandle).toBe('@RinatGumarov');
      expect(contact.emailHref).toBe('mailto:hi@gumarov.com');
      expect(contact.emailAddress).toBe('hi@gumarov.com');
    },
  );

  it('describes every personal photo in both locales without reusing English', () => {
    const en = getContent('en').personal.photos;
    const ru = getContent('ru').personal.photos;

    expect(en.map((photo) => photo.slug)).toEqual([...personalPhotoSlugs]);
    expect(ru.map((photo) => photo.slug)).toEqual(en.map((p) => p.slug));

    for (const [index, photo] of en.entries()) {
      expect(photo.alt.trim().length).toBeGreaterThan(0);
      expect(ru[index]?.alt.trim().length).toBeGreaterThan(0);
      expect(ru[index]?.alt).not.toBe(photo.alt);
    }
  });

  it('localizes the contact section label instead of hard-coding English', () => {
    expect(getContent('en').contact.indexLabel).toBe('Contact');
    expect(getContent('ru').contact.indexLabel).toBe('Контакты');
  });

  it.each(['en', 'ru'] as const)(
    'carries complete sharing metadata in %s',
    (locale) => {
      const meta = getContent(locale).meta;

      expect(meta.siteName).not.toBe('');
      expect(meta.ogLocale).toBe(locale === 'ru' ? 'ru_RU' : 'en_US');
      expect(meta.ogAlternateLocale).toBe(locale === 'ru' ? 'en_US' : 'ru_RU');
      expect(meta.ogImage).toBe(locale === 'ru' ? '/og-ru.jpg' : '/og-en.jpg');
      expect(meta.ogImageAlt).not.toBe('');
      expect(Object.values(meta.socialCard).every(Boolean)).toBe(true);
    },
  );

  it('keeps every shared metadata value distinct between locales', () => {
    const english = getContent('en').meta;
    const russian = getContent('ru').meta;

    expect(english.title).not.toBe(russian.title);
    expect(english.description).not.toBe(russian.description);
    expect(english.ogImage).not.toBe(russian.ogImage);
    expect(english.ogLocale).not.toBe(russian.ogLocale);
    expect(english.ogImageAlt).not.toBe(russian.ogImageAlt);
    expect(english.socialCard.headline).not.toBe(russian.socialCard.headline);
  });

  it.each(['en', 'ru'] as const)(
    'keeps Evercity inside frontend-first positioning in %s',
    (locale) => {
      const evercity = getContent(locale).projects.find(
        (project) => project.slug === 'evercity',
      );

      expect(evercity).toBeDefined();
      expect(evercity?.contribution.toLowerCase()).not.toMatch(
        /full[\s-]?stack/u,
      );
      expect(evercity?.capabilities.toLowerCase()).not.toMatch(
        /full[\s-]?stack/u,
      );
      expect(evercity?.contribution.toLowerCase()).toContain('frontend');
    },
  );

  it.each(['en', 'ru'] as const)(
    'does not make unsupported numeric impact claims in %s',
    (locale) => {
      const content = getContent(locale);
      const visibleCopy = JSON.stringify(content);

      expect(visibleCopy).not.toMatch(
        /\b\d[\d,.]*\s*(?:\+\s*)?(?:users?|customers?|clients?|dau|aum|%)/i,
      );
    },
  );

  it('keeps SplitHub’s approved metrics intact with their qualifiers attached', () => {
    const en = getContent('en').projects.find((p) => p.slug === 'splithub');
    const ru = getContent('ru').projects.find((p) => p.slug === 'splithub');

    expect(en?.metrics).toEqual([
      { value: '350+', label: 'registered users' },
      { value: 'Around 50', label: 'daily active users' },
    ]);
    expect(ru?.metrics).toEqual([
      { value: '350+', label: 'зарегистрированных пользователей' },
      { value: 'Примерно 50', label: 'активных пользователей в день' },
    ]);
    expect(en?.contribution).toContain('two-person team');
    expect(ru?.contribution).toContain('команде из двух человек');
  });

  it('keeps the 9+ years frontend claim in the hero proof points', () => {
    expect(getContent('en').hero.proofPoints[0]).toEqual({
      value: '9+ years',
      label: 'in frontend engineering',
    });
    expect(getContent('ru').hero.proofPoints[0]).toEqual({
      value: '9+ лет',
      label: 'frontend-разработки',
    });
  });
});
