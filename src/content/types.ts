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

/**
 * Whether a scene carries a real capture or is a text-only case.
 *
 * This is an explicit field rather than "a screenshot entry happens to be
 * missing". A scene with no capture used to fall through to a decorative
 * geometry fallback, so deleting a screenshot swapped one picture for another
 * instead of removing the picture — exactly the outcome the refinement brief
 * rules out for Stoic and Evercity. Declaring the mode makes "this project has
 * no image" a statement the renderer can honour, and the type below makes
 * "text mode plus a screenshot" unrepresentable.
 */
export type ProjectMedia = 'screenshot' | 'text';

interface ProjectBase {
  slug: ProjectSlug;
  name: string;
  eyebrow: string;
  /**
   * What the product is, in one line. Optional because the closing compact row
   * carries a single sentence of contribution and nothing else — a summary
   * declared there would be copy the page never renders.
   */
  summary?: string;
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
  /**
   * A short shipped-state mark rendered beside the metrics as a subordinate
   * badge — deliberately not a second `ProofPoint`, so the one headline number
   * keeps the weight and the availability reads as status, not as a rival
   * statistic.
   */
  availability?: string;
}

export type Project = ProjectBase &
  (
    | { media: 'screenshot' }
    | {
        media: 'text';
        /**
         * Text scenes carry no `<figure>`, no reserved visual column and no
         * decorative substitute, so nothing here may describe a picture.
         */
        proofs?: never;
      }
  );

/**
 * The projects that ship an approved capture. A screenshot entry for any other
 * slug would describe an image the page never renders, so the type refuses it
 * rather than letting it sit in the content file looking like shipped copy.
 */
export const screenshotProjectSlugs = ['tradingview', 'splithub'] as const;
export type ScreenshotProjectSlug = (typeof screenshotProjectSlugs)[number];

export interface ProjectScreenshot {
  slug: ScreenshotProjectSlug;
  /** Localized description of the interface shown in the screenshot. */
  alt: string;
  /** Localized short caption rendered beneath the screenshot. */
  caption: string;
}

/**
 * The three activity frames the About strip shows, in render order. The
 * portrait is the hero's alone: it appears exactly once on the page, so it is
 * deliberately absent here.
 */
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
 * The personal open-source experiment that closes the work sequence. It links
 * out to a demo and a repository and renders no capture, no preview canvas and
 * no embedded copy of the lab, so every field here is either text or a
 * destination.
 */
export interface PerformanceLab {
  eyebrow: string;
  /** The experiment's own name; identical in both locales. */
  name: string;
  /** The one-line claim that carries the block. */
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
