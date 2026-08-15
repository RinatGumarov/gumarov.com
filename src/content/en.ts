import type { LandingContent } from './types';

export const en = {
  meta: {
    title: 'Rinat Gumarov — Senior Frontend Engineer',
    description:
      'Senior Frontend Engineer building complex interfaces for trading, fintech, and ambitious products.',
    siteName: 'Rinat Gumarov',
    ogLocale: 'en_US',
    ogAlternateLocale: 'ru_RU',
    ogImage: '/og-en.jpg',
    ogImageAlt:
      'Rinat Gumarov, Senior Frontend Engineer, beside the gumarov.com address and the Telegram contact @RinatGumarov.',
    socialCard: {
      name: 'Rinat Gumarov',
      role: 'Senior Frontend Engineer',
      headline:
        'Complex interfaces for trading, fintech, and ambitious products.',
      contact: 'gumarov.com · @RinatGumarov',
    },
  },
  nav: {
    work: 'Work',
    about: 'About',
    contact: 'Contact',
  },
  hero: {
    eyebrow: 'React · TypeScript · Fintech · Product',
    title: 'Senior Frontend Engineer building ambitious products.',
    body: 'I design and ship complex interfaces for trading, fintech, and products of my own.',
    workCta: 'View selected work',
    contactCta: 'Get in touch',
  },
  projectsHeading: 'Selected work',
  projects: [
    {
      slug: 'tradingview',
      name: 'TradingView',
      eyebrow: 'Trading interfaces',
      summary: 'A platform for market analysis and trading.',
      contribution:
        'Senior Frontend Engineer working across Pine Editor and Strategy Tester with ownership of complex frontend features.',
      capabilities:
        'Complex frontend systems · Performance-sensitive interfaces',
      href: 'https://www.tradingview.com/',
    },
    {
      slug: 'stoic',
      name: 'Stoic',
      eyebrow: 'Fintech from the ground up',
      summary: 'A fintech web app for automated trading strategies.',
      contribution:
        'Primary frontend engineer who built the React, TypeScript, and Next.js application from scratch.',
      capabilities: 'React · TypeScript · Next.js',
      href: 'https://stoic.ai/',
    },
    {
      slug: 'splithub',
      name: 'SplitHub',
      eyebrow: 'Product ownership',
      summary: 'An iOS expense-sharing product for groups.',
      contribution:
        'Conceived the product, shaped its UX, and shipped it through engineering to an App Store release.',
      capabilities: 'Product strategy · UX · iOS delivery',
      href: 'https://splithub.app/',
    },
    {
      slug: 'evercity',
      name: 'Evercity',
      eyebrow: 'Sustainable finance',
      summary:
        'A platform for sustainable-finance management, issuance, and monitoring.',
      contribution:
        'Contributed frontend work on a sustainable-finance platform.',
      capabilities: 'Frontend · Sustainable finance',
      href: 'https://evercity.io/',
    },
  ],
  principles: {
    heading: 'How I work',
    items: [
      'Frontend architecture that keeps complex product surfaces clear and resilient.',
      'Product thinking that turns ambiguous ideas into focused experiences.',
      'Performance and interaction quality where every state feels considered.',
      'Ownership from an early question to a production rollout.',
    ],
  },
  personal: {
    heading: 'Beyond the screen',
    body: 'Curiosity, craft, and focused energy carry beyond my frontend work. I am gradually building a project BMW E30 and keep small apps or technical experiments moving alongside it.',
    items: ['Surfing', 'Snowboarding', 'Skating', 'Motorcycles', 'Drifting'],
    photos: [
      { slug: 'surf', alt: 'Rinat riding the face of a breaking wave.' },
      { slug: 'skate', alt: 'Rinat riding a skatepark ramp at night.' },
      { slug: 'snowboard', alt: 'Rinat mid-air on a snowboard.' },
    ],
  },
  contact: {
    indexLabel: 'Contact',
    heading: 'Let’s build something ambitious',
    body: 'Have an ambitious frontend challenge or a product worth building? Let’s talk.',
    telegramLabel: 'Telegram',
    telegramHref: 'https://t.me/RinatGumarov',
    telegramHandle: '@RinatGumarov',
    emailLabel: 'Email',
    emailHref: 'mailto:hi@gumarov.com',
    emailAddress: 'hi@gumarov.com',
  },
  footer: {
    privacy:
      'Analytics is cookieless, aggregate, and does not identify visitors.',
  },
} satisfies LandingContent;
