import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from './App';
import { getContent } from './content';

it('renders the personal landing landmark', () => {
  render(<App locale="en" />);

  expect(screen.getByRole('main')).toHaveAttribute('data-locale', 'en');
});

it('keeps global landmarks distinct with one page heading and a skip target', () => {
  render(<App locale="en" />);

  const header = screen.getByRole('banner');
  const main = screen.getByRole('main');

  expect(main).not.toContainElement(header);
  expect(main).toHaveAttribute('id', 'main-content');
  // Exactly one h1: no decorative element (including an SVG) duplicates it.
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
    'href',
    '#main-content',
  );
});

it('keeps the work, about, and contact anchors reachable', () => {
  const { container } = render(<App locale="en" />);

  expect(container.querySelector('#work')).toBeInTheDocument();
  expect(container.querySelector('#about')).toBeInTheDocument();
  expect(container.querySelector('#contact')).toBeInTheDocument();
});

it.each([
  {
    locale: 'en',
    titleLines: ['Complex interfaces.', 'Effortless interactions.'],
  },
  {
    locale: 'ru',
    titleLines: ['Сложные интерфейсы.', 'Простые действия.'],
  },
] as const)(
  'server-renders complete $locale landing content',
  ({ locale, titleLines }) => {
    const html = renderToStaticMarkup(<App locale={locale} />);

    expect(html).toContain('data-hero="landing"');
    for (const line of titleLines) {
      expect(html).toContain(line);
    }
    expect(html).toContain('href="https://www.tradingview.com/"');
    expect(html).toContain('href="https://t.me/RinatGumarov"');
    expect(html).toContain('href="mailto:hi@gumarov.com"');
  },
);

/*
 * The Frontend Performance Lab replaces the old three engineering cards. Both
 * halves of that matter: the new block is on the page, and the block it
 * replaced is not still sitting beside it.
 */
it('puts the performance lab between the work and the about section', () => {
  const { container } = render(<App locale="en" />);
  const lab = container.querySelector('[data-section="performance-lab"]');
  const work = container.querySelector('#work');
  const about = container.querySelector('#about');

  if (!lab || !work || !about) {
    throw new Error('The page is missing the work, lab, or about section.');
  }

  expect(
    work.compareDocumentPosition(lab) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    lab.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it('keeps the four commercial cases and adds no fifth project scene', () => {
  const { container } = render(<App locale="en" />);

  expect(container.querySelectorAll('[data-project-slug]')).toHaveLength(4);
  expect(
    container.querySelector(
      '[data-section="performance-lab"] [data-project-slug]',
    ),
  ).toBeNull();
});

it('replaces the engineering cards rather than keeping both blocks', () => {
  const { container } = render(<App locale="en" />);
  const engineering = getContent('en');

  expect(container.querySelector('#engineering-heading')).toBeNull();
  expect(
    container.querySelector('[data-section="performance-lab"]'),
  ).not.toBeNull();
  // The three old card bodies are gone from the document entirely.
  for (const stale of [
    'Virtualized version history, so the entire list does not need to render at once.',
    'Autosave, history, and restoring previous changes in the editor.',
  ]) {
    expect(container.textContent).not.toContain(stale);
  }
  expect(container.textContent).toContain(engineering.performanceLab.thesis);
});

it('opens both lab links in a new tab with a named destination and a notice', () => {
  const { container } = render(<App locale="en" />);
  const lab = container.querySelector(
    '[data-section="performance-lab"]',
  ) as HTMLElement;
  const content = getContent('en').performanceLab;

  // No embedded copy of the lab, and no fake controls standing in for it.
  expect(
    lab.querySelectorAll('iframe, canvas, button, input, select'),
  ).toHaveLength(0);

  const demo = within(lab).getByRole('link', {
    name: new RegExp(content.demoCta, 'u'),
  });
  expect(demo).toHaveAttribute('href', content.demoHref);
  expect(demo).toHaveAttribute('target', '_blank');
  expect(demo).toHaveAttribute('rel', 'noopener noreferrer');
  expect(demo).toHaveAccessibleName(
    new RegExp(content.newTabHint.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
  );

  const source = within(lab).getByRole('link', {
    name: new RegExp(content.sourceCta, 'u'),
  });
  expect(source).toHaveAttribute('href', content.sourceHref);
  expect(source).toHaveAttribute('target', '_blank');
  expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  // Both links leave the site, so both say so.
  expect(source).toHaveAccessibleName(
    new RegExp(content.newTabHint.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
  );

  // The limits stay beside the claim.
  expect(within(lab).getByText(content.note)).toBeVisible();
});

it.each(['en', 'ru'] as const)(
  'server-renders the lab links so they work without JavaScript in %s',
  (locale) => {
    const html = renderToStaticMarkup(<App locale={locale} />);
    const lab = getContent(locale).performanceLab;

    expect(html).toContain(`href="${lab.demoHref}"`);
    expect(html).toContain(`href="${lab.sourceHref}"`);
    expect(html).not.toContain('<iframe');
  },
);

it.each(['en', 'ru'] as const)(
  'shows exactly one avatar and three activity photos in %s',
  (locale) => {
    const { container } = render(<App locale={locale} />);
    const images = [...container.querySelectorAll('img')];
    const portraits = images.filter((image) =>
      (image.getAttribute('src') ?? '').includes('/assets/portrait/'),
    );
    const personal = images.filter((image) =>
      (image.getAttribute('src') ?? '').includes('/assets/personal/'),
    );

    expect(portraits).toHaveLength(1);
    expect(portraits[0]?.closest('[data-hero="landing"]')).not.toBeNull();
    expect(personal).toHaveLength(3);
    expect(
      personal.map(
        (image) =>
          (image.getAttribute('src') ?? '').split('/').at(-1)?.split('-')[0],
      ),
    ).toEqual(['surf', 'snowboard', 'drift']);
  },
);
