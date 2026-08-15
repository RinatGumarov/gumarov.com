import { describe, expect, it } from 'vitest';
import { getContent } from './index';

const expectedProjectSlugs = ['tradingview', 'stoic', 'splithub', 'evercity'];
const expectedProjectLinks = [
  'https://www.tradingview.com/',
  'https://stoic.ai/',
  'https://splithub.app/',
  'https://evercity.io/',
];

describe('landing content', () => {
  it.each(['en', 'ru'] as const)('returns complete %s copy', (locale) => {
    const content = getContent(locale);

    expect(content.meta.title).not.toBe('');
    expect(content.meta.description).not.toBe('');
    expect(Object.values(content.nav)).toHaveLength(3);
    expect(Object.values(content.hero)).toHaveLength(5);
    expect(content.projectsHeading).not.toBe('');
    expect(content.principles.heading).not.toBe('');
    expect(content.principles.items.length).toBeGreaterThan(0);
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
});
