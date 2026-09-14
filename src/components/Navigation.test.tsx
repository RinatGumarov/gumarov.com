import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { getContent } from '../content';
import { Navigation } from './Navigation';

it('offers a skip link and plain anchors for every section', () => {
  render(<Navigation locale="en" labels={getContent('en').nav} />);

  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
    'href',
    '#main-content',
  );
  for (const [label, href] of [
    ['Work', '#work'],
    ['About', '#about'],
    ['Contact', '#contact'],
  ]) {
    expect(screen.getByRole('link', { name: label })).toHaveAttribute(
      'href',
      href,
    );
  }
});
