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
    identity: 'Rinat Gumarov',
    eyebrow: 'Senior Frontend Engineer · React · TypeScript',
    titleLines: ['Complex interfaces.', 'Effortless interactions.'],
    body: 'I work on Pine Editor and Strategy Tester at TradingView. I build interfaces for trading, fintech, and products of my own—from architecture to interaction details.',
    proofPoints: [
      { value: '9+ years', label: 'in frontend engineering' },
      { value: 'TradingView', label: 'Pine Editor · Strategy Tester' },
      { value: 'Splithub', label: 'From zero to the App Store · 350 users' },
    ],
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
        'I work on Pine Editor and Strategy Tester: code editing, version history, and interfaces for analysing trading strategies.',
      capabilities:
        'Complex frontend systems · Performance-sensitive interfaces',
      href: 'https://www.tradingview.com/',
      variant: 'lead',
      media: 'screenshot',
      linkLabel: 'Visit TradingView',
      proofs: [
        {
          title: 'Working with code',
          body: 'Autosave, version history, visual diffs, and rollback for working with script changes.',
        },
        {
          title: 'Initial rendering',
          body: 'Monaco and LSP initialization moved out of the critical loading path; version history virtualized.',
        },
        {
          title: 'Editor architecture',
          body: 'Separate builds for the full editor, detached window, and dialog.',
        },
      ],
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
      variant: 'major',
      media: 'text',
      linkLabel: 'Visit Stoic',
    },
    {
      slug: 'splithub',
      name: 'Splithub',
      eyebrow: 'From idea to the App Store',
      summary: 'An iOS app for sharing expenses.',
      contribution:
        'Took the product through the full development cycle: from idea and UX to the SwiftUI app, backend, and App Store launch.',
      capabilities: 'UX · SwiftUI · Backend · Launch',
      href: 'https://splithub.app/',
      variant: 'product',
      media: 'screenshot',
      linkLabel: 'Visit Splithub',
      metrics: [{ value: '350', label: 'registered users' }],
      availability: 'On the App Store',
    },
    {
      slug: 'evercity',
      name: 'Evercity',
      eyebrow: 'Sustainable finance',
      contribution:
        'Contributed frontend work on a sustainable-finance platform.',
      capabilities: 'Frontend · Sustainable finance',
      href: 'https://evercity.io/',
      variant: 'compact',
      media: 'text',
      linkLabel: 'Visit Evercity',
    },
  ],
  projectScreenshots: [
    {
      slug: 'tradingview',
      alt: 'TradingView with the Pine Editor open beside a chart and the Strategy Tester listing trades.',
      caption: 'Pine Editor and Strategy Tester',
    },
    {
      slug: 'splithub',
      alt: 'Splithub on iPhone: balances by currency, the net total in your favour, and the list of friends with amounts.',
      caption: 'Splithub on iOS',
    },
  ],
  performanceLab: {
    eyebrow: 'Interactive experiment · Open source',
    name: 'Frontend Performance Lab',
    thesis: '100,000 rows. Explore how they render.',
    description:
      'Compare Baseline and Optimized on the same dataset: scroll the table, explore the chart, and inspect render counters. Virtualization and isolated tooltip updates with React and TypeScript.',
    note: 'Synthetic data. Compare modes at up to 10K rows; explore Optimized at up to 100K.',
    demoCta: 'Try the live demo',
    demoHref: 'https://rinatgumarov.github.io/frontend-performance-lab/',
    sourceCta: 'View source',
    sourceHref: 'https://github.com/RinatGumarov/frontend-performance-lab',
    newTabHint: 'opens in a new tab',
  },
  personal: {
    heading: 'Beyond the screen',
    body: 'Away from the screen: surfing, snowboarding, skating, and drifting a BMW E30 I partly built myself.',
    items: ['Surfing', 'Snowboarding', 'Skating', 'Motorcycles', 'Drifting'],
    photos: [
      { slug: 'surf', alt: 'Rinat riding the face of a breaking wave.' },
      { slug: 'snowboard', alt: 'Rinat mid-air on a snowboard.' },
      {
        slug: 'drift-front',
        alt: 'Rinat’s BMW E30 mid-drift on track, seen head-on.',
      },
    ],
  },
  contact: {
    indexLabel: 'Contact',
    heading: 'Have something in mind? Let’s talk.',
    body: 'Complex frontend work, a new product, or an interesting collaboration—get in touch.',
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
