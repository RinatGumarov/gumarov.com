import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { getContent } from '../content';
import { Contact } from './Contact';

it('offers direct, clearly named Telegram and email contact paths', () => {
  const content = getContent('en').contact;
  render(<Contact content={content} />);

  expect(
    screen.getByRole('heading', { level: 2, name: content.heading }),
  ).toBeInTheDocument();
  expect(screen.getByText(content.body)).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Telegram: @RinatGumarov' }),
  ).toHaveAttribute('href', 'https://t.me/RinatGumarov');
  expect(
    screen.getByRole('link', { name: 'Email: hi@gumarov.com' }),
  ).toHaveAttribute('href', 'mailto:hi@gumarov.com');
});
