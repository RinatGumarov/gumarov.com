import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { App } from './App';
import { getContent } from './content';

it('keeps the landmarks distinct, with one page heading and a skip target', () => {
  render(<App locale="en" />);

  const main = screen.getByRole('main');
  expect(main).not.toContainElement(screen.getByRole('banner'));
  expect(main).toHaveAttribute('id', 'main-content');
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
    'href',
    '#main-content',
  );
});

/*
 * The page has to be complete before any JavaScript runs: every heading,
 * project destination and contact detail is in the served markup.
 */
it.each(['en', 'ru'] as const)('server-renders the whole %s page', (locale) => {
  const content = getContent(locale);
  const html = renderToStaticMarkup(<App locale={locale} />);

  for (const line of content.hero.titleLines) expect(html).toContain(line);
  for (const project of content.projects) {
    expect(html).toContain(`href="${project.href}"`);
  }
  expect(html).toContain(`href="${content.performanceLab.demoHref}"`);
  expect(html).toContain(`href="${content.contact.telegramHref}"`);
  expect(html).toContain(`href="${content.contact.emailHref}"`);
  expect(html).toContain('data-hero="landing"');
});

it('sends both lab links off-site in a new tab, with a notice', () => {
  const { container } = render(<App locale="en" />);
  const lab = container.querySelector(
    '[data-section="performance-lab"]',
  ) as HTMLElement;
  const content = getContent('en');

  // The lab is a separate deployed app: no iframe, no bundle, no mock controls.
  expect(lab.querySelectorAll('iframe, canvas, button, input')).toHaveLength(0);

  for (const [cta, href] of [
    [content.performanceLab.demoCta, content.performanceLab.demoHref],
    [content.performanceLab.sourceCta, content.performanceLab.sourceHref],
  ] as const) {
    const link = lab.querySelector(`a[href="${href}"]`);
    expect(link).toHaveTextContent(cta);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // Both links leave the site, so both say so out loud.
    expect(link?.textContent).toContain(content.performanceLab.newTabHint);
  }
});
