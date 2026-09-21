import { act, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { getContent } from './content';

afterEach(() => vi.unstubAllGlobals());

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

/*
 * Every section below the hero brings its own blocks in the first time it is
 * scrolled to, and each block waits one step longer than the one above it. The
 * facts row is the one exception in the other direction: it is nested inside a
 * project scene as well, and there it is part of the scene's copy rather than a
 * section of its own, so it opens no second scope inside one.
 */
it('gives every section below the hero one reveal scope of indexed blocks', () => {
  const observers = installIntersectionObservers();
  const { container } = render(<App locale="en" />);

  const scopes = [...container.querySelectorAll('[data-motion-scope]')];
  expect(
    scopes.map((scope) => scope.getAttribute('data-motion-scope')),
  ).toEqual([
    'proof',
    'project',
    'project',
    'project',
    'project',
    'lab',
    'personal',
    'contact',
  ]);

  const stagger = (scope: Element | undefined) =>
    [...(scope?.querySelectorAll('[data-motion-reveal]') ?? [])].map((block) =>
      (block as HTMLElement).style.getPropertyValue('--reveal-index'),
    );
  const [proof, , , , , lab, , contact] = scopes;
  expect(stagger(proof)).toEqual(['0', '1', '2']);
  expect(stagger(lab)).toEqual(['0', '1']);
  expect(stagger(contact)).toEqual(['0', '1']);

  for (const scope of scopes) {
    expect(scope).not.toHaveAttribute('data-motion-viewed');
  }
  act(() => observers.emit(true));
  for (const scope of scopes) {
    expect(scope).toHaveAttribute('data-motion-viewed', 'true');
  }
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

/**
 * Every section watches itself, so the page holds one observer per section —
 * plus the one that keeps the address bar on the section in view. `emit`
 * reports every watched element to the observer watching it, the way the
 * browser would on the first scroll through the page.
 */
function installIntersectionObservers() {
  const watchers: {
    callback: IntersectionObserverCallback;
    elements: Element[];
  }[] = [];

  class Observer implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds = [0.18];
    readonly elements: Element[] = [];

    constructor(callback: IntersectionObserverCallback) {
      watchers.push({ callback, elements: this.elements });
    }

    observe = (element: Element) => this.elements.push(element);
    disconnect = vi.fn();
    takeRecords = () => [];
    unobserve = vi.fn();
  }

  vi.stubGlobal('IntersectionObserver', Observer);

  return {
    emit(isIntersecting: boolean) {
      for (const { callback, elements } of watchers) {
        callback(
          elements.map(
            (target) =>
              ({
                target,
                isIntersecting,
                intersectionRatio: isIntersecting ? 1 : 0,
              }) as IntersectionObserverEntry,
          ),
          {} as IntersectionObserver,
        );
      }
    },
  };
}
