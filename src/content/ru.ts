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
    eyebrow: 'React · TypeScript · Fintech · Product',
    title: 'Senior Frontend Engineer, который создаёт амбициозные продукты.',
    body: 'Проектирую и запускаю сложные интерфейсы для трейдинга, финтеха и собственных продуктов.',
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
        'Senior Frontend Engineer: развиваю сложные frontend-функции в Pine Editor и Strategy Tester.',
      capabilities:
        'Сложные frontend-системы · Интерфейсы с высокими требованиями к производительности',
      href: 'https://www.tradingview.com/',
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
    },
    {
      slug: 'splithub',
      name: 'SplitHub',
      eyebrow: 'Владение продуктом',
      summary: 'iOS-продукт для совместного учёта расходов.',
      contribution:
        'Придумал продукт, сформировал UX и довёл его от разработки до релиза в App Store.',
      capabilities: 'Продуктовая стратегия · UX · iOS-разработка',
      href: 'https://splithub.app/',
    },
    {
      slug: 'evercity',
      name: 'Evercity',
      eyebrow: 'Устойчивое финансирование',
      summary:
        'Платформа для управления, выпуска и мониторинга устойчивого финансирования.',
      contribution:
        'Участвовал во frontend-разработке платформы устойчивого финансирования.',
      capabilities: 'Frontend · Устойчивое финансирование',
      href: 'https://evercity.io/',
    },
  ],
  principles: {
    heading: 'Как я работаю',
    items: [
      'Строю frontend-архитектуру, в которой сложные продукты остаются понятными и устойчивыми.',
      'Превращаю неоднозначные идеи в сфокусированный пользовательский опыт.',
      'Уделяю внимание производительности и качеству взаимодействия в каждом состоянии интерфейса.',
      'Беру ответственность за путь от первого вопроса до запуска в production.',
    ],
  },
  personal: {
    heading: 'Вне экрана',
    body: 'Любознательность, интерес к ремеслу и сфокусированная энергия не заканчиваются на frontend-работе. Постепенно собираю проектный BMW E30 и параллельно развиваю небольшие приложения и технические эксперименты.',
    items: ['Сёрфинг', 'Сноуборд', 'Скейтбординг', 'Мотоциклы', 'Дрифт'],
  },
  contact: {
    heading: 'Давайте сделаем что-то амбициозное',
    body: 'Есть амбициозная frontend-задача или продукт, который стоит создать? Давайте поговорим.',
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
