import type { LandingContent } from './types';

export const ru = {
  meta: {
    title: 'Ринат Гумаров — Senior Frontend Engineer',
    description:
      'Senior Frontend Engineer, который создаёт сложные интерфейсы для трейдинга, финтеха и амбициозных продуктов.',
    siteName: 'Ринат Гумаров',
    ogLocale: 'ru_RU',
    ogAlternateLocale: 'en_US',
    ogImage: '/og-ru.jpg',
    ogImageAlt:
      'Ринат Гумаров, Senior Frontend Engineer, рядом с адресом gumarov.com и контактом в Telegram @RinatGumarov.',
    socialCard: {
      name: 'Ринат Гумаров',
      role: 'Senior Frontend Engineer',
      headline:
        'Сложные интерфейсы для трейдинга, финтеха и амбициозных продуктов.',
      contact: 'gumarov.com · @RinatGumarov',
    },
  },
  nav: {
    work: 'Проекты',
    about: 'Обо мне',
    contact: 'Контакты',
  },
  hero: {
    identity: 'Ринат Гумаров',
    eyebrow: 'Senior Frontend Engineer · React · TypeScript',
    titleLines: ['Сложные интерфейсы.', 'Простые действия.'],
    body: 'Развиваю Pine Editor и Strategy Tester в TradingView. Создаю интерфейсы для трейдинга, финтеха и собственных продуктов — от архитектуры до деталей взаимодействия.',
    proofPoints: [
      { value: '9+ лет', label: 'frontend-разработки' },
      { value: 'TradingView', label: 'Pine Editor · Strategy Tester' },
      { value: 'Splithub', label: 'С нуля до App Store · 350 пользователей' },
    ],
    workCta: 'Смотреть проекты',
    contactCta: 'Связаться',
  },
  projectsHeading: 'Избранные проекты',
  projects: [
    {
      slug: 'tradingview',
      name: 'TradingView',
      eyebrow: 'Интерфейсы для трейдинга',
      summary: 'Платформа для анализа рынков и трейдинга.',
      contribution:
        'Развиваю Pine Editor и Strategy Tester: редактор кода, историю версий и интерфейсы анализа торговых стратегий.',
      capabilities:
        'Сложные frontend-системы · Интерфейсы с высокими требованиями к производительности',
      href: 'https://www.tradingview.com/',
      variant: 'lead',
      media: 'screenshot',
      linkLabel: 'Открыть TradingView',
      proofs: [
        {
          title: 'Работа с кодом',
          body: 'Autosave, история версий, visual diff и rollback для работы с изменениями скриптов.',
        },
        {
          title: 'Первый рендер',
          body: 'Инициализация Monaco и LSP вынесена из критического пути загрузки; история версий виртуализирована.',
        },
        {
          title: 'Архитектура редактора',
          body: 'Отдельные сборки полного редактора, отдельного окна и диалога.',
        },
      ],
    },
    {
      slug: 'stoic',
      name: 'Stoic',
      eyebrow: 'Финтех с нуля',
      summary: 'Финтех-продукт для автоматизированных торговых стратегий.',
      contribution:
        'Основной frontend-инженер: с нуля создал веб-приложение на React, TypeScript и Next.js.',
      capabilities: 'React · TypeScript · Next.js',
      href: 'https://stoic.ai/',
      variant: 'major',
      media: 'text',
      linkLabel: 'Открыть Stoic',
    },
    {
      slug: 'splithub',
      name: 'Splithub',
      eyebrow: 'От идеи до App Store',
      summary: 'iOS-приложение для совместного учёта расходов.',
      contribution:
        'Прошёл полный цикл создания продукта: от идеи и UX до SwiftUI-приложения, бэкенда и запуска в App Store.',
      capabilities: 'UX · SwiftUI · Backend · Запуск',
      href: 'https://splithub.app/',
      variant: 'product',
      media: 'screenshot',
      linkLabel: 'Открыть Splithub',
      metrics: [{ value: '350', label: 'зарегистрированных пользователей' }],
      availability: 'В App Store',
    },
    {
      slug: 'evercity',
      name: 'Evercity',
      eyebrow: 'Устойчивое финансирование',
      contribution:
        'Участвовал во frontend-разработке платформы устойчивого финансирования.',
      capabilities: 'Frontend · Устойчивое финансирование',
      href: 'https://evercity.io/',
      variant: 'compact',
      media: 'text',
      linkLabel: 'Открыть Evercity',
    },
  ],
  projectScreenshots: [
    {
      slug: 'tradingview',
      alt: 'TradingView: Pine Editor рядом с графиком и Strategy Tester со списком сделок.',
      caption: 'Pine Editor и Strategy Tester',
    },
    {
      slug: 'splithub',
      alt: 'Splithub на iPhone: балансы по валютам, итог в вашу пользу и список участников с суммами.',
      caption: 'Splithub на iOS',
    },
  ],
  performanceLab: {
    eyebrow: 'Интерактивный эксперимент · Open source',
    name: 'Frontend Performance Lab',
    thesis: '100 000 строк. Проверьте, как они рендерятся.',
    description:
      'Сравните Baseline и Optimized на одном наборе данных: прокрутите таблицу, исследуйте график и посмотрите на счётчики рендеров. Виртуализация и изоляция обновлений tooltip на React и TypeScript.',
    note: 'Синтетические данные. Сравнение режимов — до 10K строк; Optimized — до 100K. Демо на английском.',
    demoCta: 'Попробовать демо',
    demoHref: 'https://rinatgumarov.github.io/frontend-performance-lab/',
    sourceCta: 'Исходный код',
    sourceHref: 'https://github.com/RinatGumarov/frontend-performance-lab',
    newTabHint: 'откроется в новой вкладке',
  },
  personal: {
    heading: 'Вне экрана',
    body: 'Вне экрана — сёрфинг, сноуборд, скейт и дрифт на BMW E30, который я частично собирал сам.',
    items: ['Сёрфинг', 'Сноуборд', 'Скейтбординг', 'Мотоциклы', 'Дрифт'],
    photos: [
      { slug: 'surf', alt: 'Ринат едет по склону волны.' },
      { slug: 'snowboard', alt: 'Ринат в прыжке на сноуборде.' },
      {
        slug: 'drift-front',
        alt: 'BMW E30 Рината в заносе на трассе, вид спереди.',
      },
    ],
  },
  contact: {
    indexLabel: 'Контакты',
    heading: 'Есть задача? Давайте обсудим.',
    body: 'Сложный frontend, новый продукт или интересная коллаборация — напишите мне.',
    telegramLabel: 'Telegram',
    telegramHref: 'https://t.me/RinatGumarov',
    telegramHandle: '@RinatGumarov',
    emailLabel: 'Email',
    emailHref: 'mailto:hi@gumarov.com',
    emailAddress: 'hi@gumarov.com',
  },
  footer: {
    privacy:
      'Аналитика собирается без cookies, только в агрегированном виде и не идентифицирует посетителей.',
  },
} satisfies LandingContent;
