import { en } from './en';
import { ru } from './ru';
import type { LandingContent, Locale } from './types';

const contentByLocale: Record<Locale, LandingContent> = { en, ru };

export function getContent(locale: Locale): LandingContent {
  return contentByLocale[locale];
}

export type {
  Contact,
  LandingContent,
  Locale,
  PageMeta,
  PerformanceLab,
  PersonalPhotoAlt,
  PersonalPhotoSlug,
  Project,
  ProjectMedia,
  ProjectProof,
  ProjectScreenshot,
  ProjectSlug,
  ProjectVariant,
  ProofPoint,
  ScreenshotProjectSlug,
  SocialCardCopy,
} from './types';
export {
  personalPhotoSlugs,
  projectSlugs,
  screenshotProjectSlugs,
} from './types';
