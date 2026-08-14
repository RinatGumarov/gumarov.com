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
  heading: string;
  body: string;
  telegramLabel: string;
  telegramHref: string;
  telegramHandle: string;
  emailLabel: string;
  emailHref: string;
  emailAddress: string;
}

export interface LandingContent {
  meta: { title: string; description: string };
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
}
