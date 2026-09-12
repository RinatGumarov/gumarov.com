import { describe, expect, it } from 'vitest';
import { getContent } from './index';
import {
  personalPhotoSlugs,
  screenshotProjectSlugs,
  type ProjectVariant,
} from './types';

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

/**
 * A quantified claim, as a reader meets one: a number — optionally carrying a
 * currency mark, a magnitude suffix (`20K`, `$230M`) or a `+` — followed by the
 * thing it counts, with up to two qualifier words allowed in between. That gap
 * is the point: `350+ registered users` puts a word between the number and its
 * noun, and a pattern that demands they touch sees nothing. The noun is any
 * word rather than a closed list, because the plan forbids `40 interviews` and
 * `500 ms → 200 ms` just as firmly as it forbids `20K+ clients`; what makes a
 * metric acceptable is the allowlist below, not the noun it happens to use.
 *
 * The leading lookbehind keeps a digit that belongs to a name out of it, so
 * "BMW E30" is a car and not a claim.
 */
const quantifiedClaim =
  /(?<![\p{L}\p{N}])[$€£₽¥]?\s?\d[\d\s.,]*[kKmMbB]?\s*\+?\s*(?:\p{L}[\p{L}’'-]*\s+){0,2}\p{L}[\p{L}’'-]+/gu;

/**
 * The quantified claims the plan approves, written exactly as the page renders
 * them. Everything else a scan turns up is unsupported. Extending this list is
 * the only sanctioned way to add a number to the page — and the test below
 * refuses entries that no longer match shipped copy.
 */
const approvedMetricClaims = [
  '9+ years in frontend engineering',
  '9+ лет frontend-разработки',
  // Splithub: registered users, confirmed in the candidate profile. Written
  // once as the project's own metric and once as the proof band's label.
  '350 registered users',
  '350 зарегистрированных пользователей',
  'From zero to the App Store · 350 users',
  'С нуля до App Store · 350 пользователей',
  // Frontend Performance Lab: row counts in a synthetic dataset, and the two
  // modes' documented ceilings. Not a speed claim — see the note copy.
  '100,000 rows',
  '100 000 строк',
  'up to 10K rows',
  'до 10K строк',
  'up to 100K',
  'до 100K',
];

/** Every quantified claim in `copy` that the allowlist does not account for. */
function findUnsupportedClaims(copy: string) {
  const unaccounted = approvedMetricClaims.reduce(
    // A separator rather than nothing, so removing an approved claim can never
    // splice its neighbours into a new number-plus-noun pair.
    (rest, approved) => rest.split(approved).join(' — '),
    copy,
  );

  return unaccounted.match(quantifiedClaim) ?? [];
}

/**
 * Every localized string in the content tree, as one line of prose each.
 *
 * A stat is collected as `"<value> <label>"` — the single line the page draws
 * it on — because that join is exactly where the claim lives: scanning
 * `"350+"` and `"registered users"` apart finds a bare number and a bare noun,
 * neither of which is a metric.
 */
function collectCopy(value: unknown, collected: string[] = []): string[] {
  if (typeof value === 'string') {
    collected.push(value);
    return collected;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectCopy(item, collected);
    return collected;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (typeof record.value === 'string' && typeof record.label === 'string') {
      collected.push(`${record.value} ${record.label}`);
      return collected;
    }

    for (const item of Object.values(record)) collectCopy(item, collected);
  }

  return collected;
}

/**
 * The strings a reader actually meets, with identifiers left out.
 *
 * `slug`, `variant`, `media` and every `href` name an asset, pick a rendering
 * or address a destination; none of them is ever page text. The brand-spelling
 * guard below cares about copy, alt text and accessible labels, and the URL
 * `https://splithub.app/` is deliberately lowercase — asserting a capital there
 * would demand a broken link.
 */
function collectReaderFacingCopy(
  value: unknown,
  key = '',
  collected: string[] = [],
): string[] {
  const isIdentifier =
    key === 'slug' ||
    key === 'variant' ||
    key === 'media' ||
    key === 'href' ||
    key.endsWith('Href') ||
    key === 'ogImage';

  if (typeof value === 'string') {
    if (!isIdentifier) collected.push(value);
    return collected;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectReaderFacingCopy(item, key, collected);
    return collected;
  }

  if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) {
      collectReaderFacingCopy(child, childKey, collected);
    }
  }

  return collected;
}

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
    expect(content.performanceLab.name).not.toBe('');
    expect(content.performanceLab.thesis).not.toBe('');
    expect(content.performanceLab.description).not.toBe('');
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

  /*
   * The mirror of the photo-alt test above, for the label that sits above every
   * project title. An untranslated eyebrow is not only visible copy — it also
   * reaches the screen-reader fallback for a project whose screenshot is gone
   * (`ProjectScene` builds `${name}: ${eyebrow}`), so English there is English
   * announced on the Russian page.
   */
  it('labels every project in both locales without reusing the English eyebrow', () => {
    const en = getContent('en').projects;
    const ru = getContent('ru').projects;

    expect(ru.map((project) => project.slug)).toEqual(
      en.map((project) => project.slug),
    );

    for (const [index, project] of en.entries()) {
      const russian = ru[index];

      expect(project.eyebrow.trim().length).toBeGreaterThan(0);
      expect(russian?.eyebrow.trim().length).toBeGreaterThan(0);
      expect(russian?.eyebrow).not.toBe(project.eyebrow);
      // And not merely different: the Russian label has to actually be Russian,
      // so a second English string cannot slip in by being reworded.
      expect(russian?.eyebrow).toMatch(/\p{Script=Cyrillic}/u);
    }
  });

  /*
   * The media mode is the contract, not "a screenshot entry happens to be
   * missing". A project in text mode renders no figure at all, so a screenshot
   * declared for one would be copy — and an alt string — that reaches nobody.
   */
  it.each(['en', 'ru'] as const)(
    'ships a capture for exactly the screenshot projects in %s',
    (locale) => {
      const content = getContent(locale);
      const withScreenshots = content.projects
        .filter((project) => project.media === 'screenshot')
        .map((project) => project.slug);

      expect(withScreenshots).toEqual([...screenshotProjectSlugs]);
      expect(content.projectScreenshots.map((shot) => shot.slug)).toEqual([
        ...screenshotProjectSlugs,
      ]);

      for (const screenshot of content.projectScreenshots) {
        expect(screenshot.alt.trim().length).toBeGreaterThan(0);
        expect(screenshot.caption.trim().length).toBeGreaterThan(0);
      }
    },
  );

  it.each(['en', 'ru'] as const)(
    'declares Stoic and Evercity as text cases in %s',
    (locale) => {
      const content = getContent(locale);
      const textSlugs = content.projects
        .filter((project) => project.media === 'text')
        .map((project) => project.slug);

      expect(textSlugs).toEqual(['stoic', 'evercity']);
      for (const project of content.projects) {
        if (project.media !== 'text') continue;
        // `proofs` renders beneath a capture, so a text case must not carry one.
        expect(project.proofs).toBeUndefined();
      }
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
      const offenders = collectCopy(getContent(locale)).flatMap(
        findUnsupportedClaims,
      );

      expect(offenders).toEqual([]);
    },
  );

  /*
   * The guard above is the only thing standing between a fabricated metric and
   * a real person's CV, so it is pinned against the claims the plan explicitly
   * forbids. Each of these slipped past the previous pattern, which required
   * the noun to sit immediately after the number and knew only a closed list of
   * nouns.
   */
  it.each([
    '20K+ clients',
    '$230M AUM',
    '500 ms → 200 ms',
    '40 interviews',
    // The same claims as they would actually be written into a sentence.
    'Grew the platform to 20K+ clients across three regions.',
    'Shipped a rebalancing flow covering $230M AUM.',
    'Cut first render from 500 ms to 200 ms.',
    'Ran 40 interviews with active traders.',
    // Near-misses on the approved claims: the allowlist is an exact-phrase
    // pass, not a licence to attach any noun to an approved number.
    '350+ registered clients',
    '900+ registered users',
    'Около 20K клиентов',
  ])('flags the unsupported claim %j', (claim) => {
    expect(findUnsupportedClaims(claim)).not.toEqual([]);
  });

  it.each(approvedMetricClaims)(
    'lets the approved claim %j through the allowlist',
    (claim) => {
      expect(findUnsupportedClaims(claim)).toEqual([]);
    },
  );

  /*
   * And the allowlist only ever describes copy that is really on the page — a
   * stale entry here would quietly license a claim nobody can support.
   */
  it('keeps every allowlisted claim backed by copy that is actually shipped', () => {
    const shipped = new Set([
      ...collectCopy(getContent('en')),
      ...collectCopy(getContent('ru')),
    ]);

    for (const claim of approvedMetricClaims) {
      expect([...shipped].some((copy) => copy.includes(claim))).toBe(true);
    }
  });

  it('keeps Splithub’s single headline metric and its shipped state', () => {
    const en = getContent('en').projects.find((p) => p.slug === 'splithub');
    const ru = getContent('ru').projects.find((p) => p.slug === 'splithub');

    expect(en?.metrics).toEqual([{ value: '350', label: 'registered users' }]);
    expect(ru?.metrics).toEqual([
      { value: '350', label: 'зарегистрированных пользователей' },
    ]);
    expect(en?.availability).toBe('On the App Store');
    expect(ru?.availability).toBe('В App Store');
    expect(en?.contribution).toContain('full development cycle');
    expect(ru?.contribution).toContain('полный цикл');
  });

  it.each(['en', 'ru'] as const)(
    'states the proof band as the full cycle and 350 users in %s',
    (locale) => {
      const splithub = getContent(locale).hero.proofPoints.at(2);

      expect(splithub?.value).toBe('Splithub');
      expect(splithub?.label).toBe(
        locale === 'ru'
          ? 'С нуля до App Store · 350 пользователей'
          : 'From zero to the App Store · 350 users',
      );
    },
  );

  /*
   * The product is spelled Splithub — one capital, the way the product itself
   * spells it. The slug, the URL and the analytics identifier are lowercase
   * identifiers and are deliberately not covered here; this is about copy a
   * reader sees, including alt text and accessible labels.
   */
  it.each(['en', 'ru'] as const)(
    'spells the product Splithub in %s',
    (locale) => {
      const offenders = collectReaderFacingCopy(getContent(locale)).filter(
        (copy) => /split\s?hub/iu.test(copy) && !copy.includes('Splithub'),
      );

      expect(offenders).toEqual([]);
    },
  );

  /*
   * The full-cycle wording describes involvement and responsibility. It must
   * not drift into sole authorship or into owning the App Store account, since
   * neither is true: Splithub was built with a co-author and released through
   * their developer account.
   */
  it.each(['en', 'ru'] as const)(
    'never claims solo authorship or account ownership for Splithub in %s',
    (locale) => {
      const copy = collectCopy(getContent(locale)).join(' ').toLowerCase();

      for (const forbidden of [
        'solo',
        'single-handed',
        'sole developer',
        'only developer',
        'my app store',
        'my developer account',
        'в одиночку',
        'единственный разработчик',
        'создал один',
        'мой developer account',
        'мой аккаунт',
      ]) {
        expect(copy).not.toContain(forbidden);
      }
    },
  );

  it.each(['en', 'ru'] as const)(
    'points the performance lab at its verified demo and repository in %s',
    (locale) => {
      const lab = getContent(locale).performanceLab;

      expect(lab.name).toBe('Frontend Performance Lab');
      expect(lab.demoHref).toBe(
        'https://rinatgumarov.github.io/frontend-performance-lab/',
      );
      expect(lab.sourceHref).toBe(
        'https://github.com/RinatGumarov/frontend-performance-lab',
      );
      expect(lab.demoCta.trim().length).toBeGreaterThan(0);
      expect(lab.sourceCta.trim().length).toBeGreaterThan(0);
      expect(lab.newTabHint.trim().length).toBeGreaterThan(0);
      // The note carries the limits the demo actually has; without it the
      // headline row count reads as a promise about both modes.
      expect(lab.note).toMatch(/10K/u);
      expect(lab.note).toMatch(/100K/u);
    },
  );

  /*
   * The lab is a rendering experiment on synthetic data, not a benchmark: no
   * frame rate, no millisecond figure, and no "zero renders" absolute.
   */
  it.each(['en', 'ru'] as const)(
    'makes no speed promise in the performance lab copy in %s',
    (locale) => {
      const lab = getContent(locale).performanceLab;
      const copy = Object.values(lab).join(' ');

      expect(copy).not.toMatch(/\bfps\b/iu);
      expect(copy).not.toMatch(/\d+\s?ms\b/iu);
      expect(copy).not.toMatch(/\bкадр(ов)?\/с/iu);
      expect(copy).not.toMatch(/60\s?(hz|гц)/iu);
    },
  );

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
