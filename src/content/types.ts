export type Locale = 'en' | 'ru';

export const projectSlugs = [
  'tradingview',
  'stoic',
  'splithub',
  'evercity',
] as const;

export type ProjectSlug = (typeof projectSlugs)[number];

/** A single labeled fact, e.g. a stat or a name paired with its description. */
export interface ProofPoint {
  value: string;
  label: string;
}

/** A short, titled claim backing a project's contribution. */
export interface ProjectProof {
  title: string;
  body: string;
}

/** The visual treatment a project scene renders with; assigned explicitly per project. */
export type ProjectVariant = 'lead' | 'major' | 'product' | 'compact';

export interface Project {
  slug: ProjectSlug;
  name: string;
  eyebrow: string;
  summary: string;
  contribution: string;
  capabilities: string;
  href: string;
  variant: ProjectVariant;
  /** Localized label for the explicit outbound link, e.g. "Visit TradingView". */
  linkLabel: string;
  /** Short, titled claims shown beneath the project's screenshot. Absent means no block, not an empty one. */
  proofs?: readonly ProjectProof[];
  /** Small stats shown beside the project's description. Absent means no block, not an empty one. */
  metrics?: readonly ProofPoint[];
}

export interface ProjectScreenshot {
  slug: ProjectSlug;
  /** Localized description of the interface shown in the screenshot. */
  alt: string;
  /** Localized short caption rendered beneath the screenshot. */
  caption: string;
}

export const personalPhotoSlugs = [
  'surf',
  'skate',
  'snowboard',
  'drift-rear',
  'powder',
  'drift-front',
] as const;
export type PersonalPhotoSlug = (typeof personalPhotoSlugs)[number];

export interface PersonalPhotoAlt {
  slug: PersonalPhotoSlug;
  /** Localized description of what the photo shows. */
  alt: string;
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
    /** The name shown near the portrait at the top of the hero. */
    identity: string;
    eyebrow: string;
    /** The two structural phrases of the h1, rendered as separate lines. */
    titleLines: readonly [string, string];
    body: string;
    /** The short, uncounted trust signals shown right below the hero. */
    proofPoints: readonly ProofPoint[];
    workCta: string;
    contactCta: string;
  };
  projectsHeading: string;
  projects: readonly Project[];
  projectScreenshots: readonly ProjectScreenshot[];
  engineering: { heading: string; items: readonly ProjectProof[] };
  personal: {
    heading: string;
    body: string;
    items: readonly string[];
    photos: readonly PersonalPhotoAlt[];
  };
  contact: Contact;
  footer: { privacy: string };
}
