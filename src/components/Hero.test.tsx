import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { getContent } from '../content';
import { Hero } from './Hero';

vi.mock('../lib/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));

const content = getContent('en').hero;
const renderHero = () =>
  render(<Hero content={content} motionEnabled={false} />);

it('presents the heading as two lines, with both calls to action', () => {
  renderHero();

  const heading = screen.getByRole('heading', {
    level: 1,
    name: content.titleLines.join(' '),
  });
  // Two structural spans, not a `<br>` inside a translated string.
  expect(heading.querySelectorAll('br')).toHaveLength(0);
  expect(heading.children).toHaveLength(2);

  expect(screen.getByRole('link', { name: content.workCta })).toHaveAttribute(
    'href',
    '#work',
  );
  expect(
    screen.getByRole('link', { name: content.contactCta }),
  ).toHaveAttribute('href', '#contact');
});

/*
 * The SVG ribbon is the composition, not a placeholder: it is what a visitor
 * sees with JavaScript disabled, with reduced motion, on touch, and wherever
 * WebGL is missing. The canvas over it is the enhancement and starts empty.
 */
it('renders the complete decoration, hidden from assistive technology', () => {
  const { container } = renderHero();
  const hero = container.querySelector('[data-hero="landing"]');
  const ribbons = [...container.querySelectorAll('[data-hero-ribbon]')];

  expect(hero).toHaveAttribute('data-hero-visual', 'static');
  expect(
    ribbons.map((layer) => layer.getAttribute('data-hero-ribbon')),
  ).toEqual(['shadow', 'svg']);
  for (const layer of ribbons) {
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer.querySelectorAll('path').length).toBeGreaterThan(0);
  }
  expect(hero?.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  expect(
    container.querySelector('[data-hero="landing"] canvas'),
  ).not.toBeNull();
});

it('leaves the hero motionless with the motion gate closed', () => {
  const { container } = renderHero();
  const hero = container.querySelector('[data-hero="landing"]') as HTMLElement;

  // The ribbon is the hero's only pointer-driven motion; the shared parallax
  // layer must not be summed on top of it.
  expect(hero.querySelectorAll('[data-motion-parallax]')).toHaveLength(0);
  for (const property of ['--hero-tilt-x', '--hero-shift-x']) {
    expect(hero.style.getPropertyValue(property)).toBe('');
  }
});

it('keeps the copy readable when the avatar fails to load', () => {
  const { container } = renderHero();
  const picture = container.querySelector('[data-hero="landing"] picture');

  expect(picture).not.toHaveAttribute('data-image-state');
  fireEvent.error(picture?.querySelector('img') as HTMLImageElement);

  expect(picture).toHaveAttribute('data-image-state', 'failed');
  // The name beside the avatar carries the identity, so nothing else is needed.
  expect(screen.getByText(content.identity)).toBeInTheDocument();
  expect(
    screen.getByRole('heading', {
      level: 1,
      name: content.titleLines.join(' '),
    }),
  ).toBeInTheDocument();
});
