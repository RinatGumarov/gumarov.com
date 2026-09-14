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

/** The scene composition a project renders with, assigned explicitly. */
export type ProjectVariant = 'lead' | 'major' | 'product' | 'compact';

/**
 * Declared, not inferred from a missing screenshot: a scene without a capture
 * used to fall through to a decorative graphic, so deleting a capture swapped
 * one picture for another instead of removing the picture.
 */
export type ProjectMedia = 'screenshot' | 'text';

interface ProjectBase {
  slug: ProjectSlug;
  name: string;
  eyebrow: string;
  /** What the product is, in one line. The compact row renders none. */
  summary?: string;
  contribution: string;
  capabilities: string;
  href: string;
  variant: ProjectVariant;
  /** Localized label for the explicit outbound link, e.g. "Visit TradingView". */
  linkLabel: string;
  /** Titled claims beneath the capture. Absent means no block, not an empty one. */
  proofs?: readonly ProjectProof[];
  /** Stats beside the description. Absent means no block, not an empty one. */
  metrics?: readonly ProofPoint[];
  /**
   * A shipped-state mark beside the metrics. Not a second `ProofPoint`, so the
   * one headline number keeps the weight and this reads as status.
   */
  availability?: string;
}

// A text scene renders no figure, so it cannot carry copy describing one.
export type Project = ProjectBase &
  ({ media: 'screenshot' } | { media: 'text'; proofs?: never });

/** The projects that ship a capture; a screenshot for any other slug renders nowhere. */
export const screenshotProjectSlugs = ['tradingview', 'splithub'] as const;
export type ScreenshotProjectSlug = (typeof screenshotProjectSlugs)[number];

export interface ProjectScreenshot {
  slug: ScreenshotProjectSlug;
  /** Localized description of the interface shown in the screenshot. */
  alt: string;
  /** Localized short caption rendered beneath the screenshot. */
  caption: string;
}

/** The three activity frames the About strip shows, in render order. */
export const personalPhotoSlugs = ['surf', 'snowboard', 'drift-front'] as const;
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

/**
 * The open-source experiment that closes the work sequence. It is links and
 * text only — nothing here embeds the lab — so every field is copy or a URL.
 */
export interface PerformanceLab {
  eyebrow: string;
  /** The experiment's own name; identical in both locales. */
  name: string;
  thesis: string;
  description: string;
  /** The honest limits of the demo: synthetic data and per-mode row ceilings. */
  note: string;
  demoCta: string;
  demoHref: string;
  sourceCta: string;
  sourceHref: string;
  /** Announced to assistive technology because both links open a new tab. */
  newTabHint: string;
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
  performanceLab: PerformanceLab;
  personal: {
    heading: string;
    body: string;
    items: readonly string[];
    photos: readonly [PersonalPhotoAlt, PersonalPhotoAlt, PersonalPhotoAlt];
  };
  contact: Contact;
  footer: { privacy: string };
}
