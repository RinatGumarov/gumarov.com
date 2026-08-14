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
