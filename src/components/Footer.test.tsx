import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { getContent } from '../content';
import { Footer } from './Footer';

const { trackAnalyticsEventMock } = vi.hoisted(() => ({
  trackAnalyticsEventMock: vi.fn(),
}));

vi.mock('../lib/analytics', () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

it('reports footer contact and language actions without changing their links', async () => {
  const user = userEvent.setup();
  const content = getContent('ru');
  render(
    <Footer
      locale="ru"
      contact={content.contact}
      privacy={content.footer.privacy}
    />,
  );

  const telegram = screen.getByRole('link', {
    name: `${content.contact.telegramLabel}: ${content.contact.telegramHandle}`,
  });
  const email = screen.getByRole('link', {
    name: `${content.contact.emailLabel}: ${content.contact.emailAddress}`,
  });
  const english = screen.getByRole('link', { name: 'English' });
  for (const link of [telegram, email, english]) {
    link.addEventListener('click', (event) => event.preventDefault());
    await user.click(link);
  }

  expect(trackAnalyticsEventMock.mock.calls).toEqual([
    [
      {
        name: 'contact_clicked',
        properties: {
          channel: 'telegram',
          section: 'footer',
          locale: 'ru',
        },
      },
    ],
    [
      {
        name: 'contact_clicked',
        properties: { channel: 'email', section: 'footer', locale: 'ru' },
      },
    ],
    [
      {
        name: 'language_changed',
        properties: { from: 'ru', to: 'en' },
      },
    ],
  ]);
  expect(telegram).toHaveAttribute('href', 'https://t.me/RinatGumarov');
  expect(email).toHaveAttribute('href', 'mailto:hi@gumarov.com');
});
