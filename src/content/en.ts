import type { LandingContent } from './types';

export const en = {
  meta: {
    title: 'Rinat Gumarov — Senior Frontend Engineer',
    description:
      'Senior Frontend Engineer building complex interfaces for trading, fintech, and ambitious products.',
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
      href: 'https://www.tradingview.com/',
    },
    {
      slug: 'stoic',
      name: 'Stoic',
      eyebrow: 'Fintech from the ground up',
      summary: 'A fintech web app for automated trading strategies.',
      contribution:
        'Primary frontend engineer who built the React, TypeScript, and Next.js application from scratch.',
      href: 'https://stoic.ai/',
    },
    {
      slug: 'splithub',
      name: 'SplitHub',
      eyebrow: 'Product ownership',
      summary: 'An iOS expense-sharing product for groups.',
      contribution:
        'Conceived the product, shaped its UX, and shipped it through engineering to an App Store release.',
      href: 'https://splithub.app/',
    },
    {
      slug: 'evercity',
      name: 'Evercity',
      eyebrow: 'Sustainable finance',
      summary:
        'A platform for sustainable-finance management, issuance, and monitoring.',
      contribution:
        'Contributed to frontend and full-stack work on a sustainable-finance platform.',
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
    body: 'Away from the screen, I gravitate toward speed, balance, and room to experiment. I am gradually building a project BMW E30 and usually another app or technical experiment alongside it.',
    items: ['Surfing', 'Snowboarding', 'Skating', 'Motorcycles', 'Drifting'],
  },
  contact: {
    heading: 'Let’s build something ambitious',
    body: 'Have an ambitious frontend challenge or a product worth building? Let’s talk.',
    telegramLabel: 'Telegram',
    telegramHref: 'https://t.me/RinatGumarov',
    telegramHandle: '@RinatGumarov',
    emailLabel: 'Email',
    emailHref: 'mailto:hi@gumarov.com',
    emailAddress: 'hi@gumarov.com',
  },
} satisfies LandingContent;
