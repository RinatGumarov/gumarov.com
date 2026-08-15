export type Locale = 'en' | 'ru';

export const projectSlugs = [
  'tradingview',
  'stoic',
  'splithub',
  'evercity',
] as const;

export type ProjectSlug = (typeof projectSlugs)[number];

export interface Project {
  slug: ProjectSlug;
  name: string;
  eyebrow: string;
  summary: string;
  contribution: string;
  capabilities: string;
  href: string;
}

export interface Contact {
  /** Localized section label rendered beside the section number. */
  indexLabel: string;
  heading: string;
  body: string;
  telegramLabel: string;
  telegramHref: string;
  telegramHandle: string;
  emailLabel: string;
  emailHref: string;
  emailAddress: string;
}

/** Localized copy rendered into the pre-generated Open Graph card. */
export interface SocialCardCopy {
  name: string;
  role: string;
  headline: string;
  contact: string;
}

export interface PageMeta {
  title: string;
  description: string;
  siteName: string;
  ogLocale: string;
  ogAlternateLocale: string;
  ogImage: string;
  ogImageAlt: string;
  socialCard: SocialCardCopy;
}

export interface LandingContent {
  meta: PageMeta;
  nav: { work: string; about: string; contact: string };
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    workCta: string;
    contactCta: string;
  };
  projectsHeading: string;
  projects: readonly Project[];
  principles: { heading: string; items: readonly string[] };
  personal: { heading: string; body: string; items: readonly string[] };
  contact: Contact;
  footer: { privacy: string };
}
