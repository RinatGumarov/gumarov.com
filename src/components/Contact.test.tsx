import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { Locale } from '../content';
import { getContent } from '../content';
import { Contact } from './Contact';

const { trackAnalyticsEventMock } = vi.hoisted(() => ({
  trackAnalyticsEventMock: vi.fn(),
}));

vi.mock('../lib/analytics', () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

it.each([
  ['en', 'Contact'],
  ['ru', 'Контакты'],
] as const)(
  'renders the %s section label from localized content',
  (locale, label) => {
    const content = getContent(locale as Locale).contact;
    render(<Contact content={content} locale={locale as Locale} />);

    expect(screen.getByText(`04 / ${label}`)).toBeInTheDocument();
  },
);

it('offers direct, clearly named Telegram and email contact paths', async () => {
  const user = userEvent.setup();
  const content = getContent('en').contact;
  render(<Contact content={content} locale="en" />);

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

  const telegram = screen.getByRole('link', {
    name: 'Telegram: @RinatGumarov',
  });
  const email = screen.getByRole('link', { name: 'Email: hi@gumarov.com' });
  telegram.addEventListener('click', (event) => event.preventDefault());
  email.addEventListener('click', (event) => event.preventDefault());
  await user.click(telegram);
  await user.click(email);

  expect(trackAnalyticsEventMock.mock.calls).toEqual([
    [
      {
        name: 'contact_clicked',
        properties: {
          channel: 'telegram',
          section: 'contact',
          locale: 'en',
        },
      },
    ],
    [
      {
        name: 'contact_clicked',
        properties: {
          channel: 'email',
          section: 'contact',
          locale: 'en',
        },
      },
    ],
  ]);
});
