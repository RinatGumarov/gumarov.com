import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { getContent } from '../content';
import { Hero } from './Hero';

it('presents the localized frontend-first hero with direct conversion links', () => {
  const { container } = render(<Hero content={getContent('en').hero} />);

  expect(
    screen.getByRole('heading', {
      level: 1,
      name: 'Senior Frontend Engineer building ambitious products.',
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'View selected work' }),
  ).toHaveAttribute('href', '#work');
  expect(screen.getByRole('link', { name: 'Get in touch' })).toHaveAttribute(
    'href',
    '#contact',
  );
  expect(
    container.querySelector('[data-hero="landing"] picture img'),
  ).toHaveAttribute('src', expect.stringMatching(/^data:image\//));
});
