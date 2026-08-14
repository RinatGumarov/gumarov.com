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
  Project,
  ProjectSlug,
} from './types';
export { projectSlugs } from './types';
