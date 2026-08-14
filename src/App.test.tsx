import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from './App';

it('renders the personal landing landmark', () => {
  render(<App locale="en" />);

  expect(screen.getByRole('main')).toHaveAttribute('data-locale', 'en');
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

    expect(html).toContain(hero);
    expect(html).toContain('href="https://www.tradingview.com/"');
    expect(html).toContain('href="https://t.me/RinatGumarov"');
    expect(html).toContain('href="mailto:hi@gumarov.com"');
  },
);
