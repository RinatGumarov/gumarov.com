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
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
    'href',
    '#main-content',
  );
});

it.each([
  {
    locale: 'en',
    hero: 'Senior Frontend Engineer building ambitious products.',
  },
  {
    locale: 'ru',
    hero: 'Senior Frontend Engineer, который создаёт амбициозные продукты.',
  },
] as const)(
  'server-renders complete $locale landing content',
  ({ locale, hero }) => {
    const html = renderToStaticMarkup(<App locale={locale} />);

    expect(html).toContain('data-hero="landing"');
    expect(html).toContain(hero);
    expect(html).toContain('href="https://www.tradingview.com/"');
    expect(html).toContain('href="https://t.me/RinatGumarov"');
    expect(html).toContain('href="mailto:hi@gumarov.com"');
  },
);
