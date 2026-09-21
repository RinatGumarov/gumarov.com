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
 * The heading arrives a word at a time, so every word is a box of its own in
 * the served markup. To assistive technology that is noise, so the words are
 * hidden and the h1 carries the whole phrase as its label; to everything else
 * the text is unchanged — same order, same whitespace, still selectable.
 */
it('splits the heading into words without breaking up the phrase', () => {
  renderHero();

  const phrase = content.titleLines.join(' ');
  const heading = screen.getByRole('heading', { level: 1, name: phrase });
  expect(heading).toHaveAttribute('aria-label', phrase);

  const words = [
    ...heading.querySelectorAll<HTMLElement>('[data-motion-word]'),
  ];
  expect(words.map((word) => word.textContent)).toEqual(phrase.split(' '));
  for (const [index, word] of words.entries()) {
    expect(word).toHaveAttribute('aria-hidden', 'true');
    expect(word.style.getPropertyValue('--word-index')).toBe(String(index));
  }

  // The whitespace never moves inside a word box: it stays between them as the
  // text it always was, so the heading wraps exactly where it used to.
  expect(heading.textContent).toBe(phrase);
});

/*
 * A non-breaking space is not a break opportunity, so the pair it joins has to
 * stay inside one box — splitting there would let the two halves land on
 * different lines, which is the one thing the character exists to prevent.
 */
it('keeps a pair joined by a non-breaking space in a single word', () => {
  render(
    <Hero
      content={{
        ...content,
        titleLines: ['Complex\u00a0interfaces.', 'Effortless interactions.'],
      }}
      motionEnabled={false}
    />,
  );

  const words = [
    ...screen
      .getByRole('heading', { level: 1 })
      .querySelectorAll('[data-motion-word]'),
  ];

  expect(words.map((word) => word.textContent)).toEqual([
    'Complex\u00a0interfaces.',
    'Effortless',
    'interactions.',
  ]);
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
