import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from './App';

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
