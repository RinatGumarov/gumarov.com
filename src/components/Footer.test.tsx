import { render, screen, within } from '@testing-library/react';
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

it('keeps the year, the privacy note and both contact paths in the markup', () => {
  const content = getContent('en');
  render(
    <Footer
      locale="en"
      contact={content.contact}
      privacy={content.footer.privacy}
    />,
  );

  const footer = screen.getByRole('contentinfo');
  expect(footer).toHaveTextContent(String(new Date().getUTCFullYear()));
  expect(within(footer).getByText(content.footer.privacy)).toBeInTheDocument();
  expect(
    within(footer).getByRole('link', { name: 'Telegram: @RinatGumarov' }),
  ).toHaveAttribute('href', content.contact.telegramHref);
  expect(
    within(footer).getByRole('link', { name: 'Email: hi@gumarov.com' }),
  ).toHaveAttribute('href', content.contact.emailHref);
});

it('reports a footer contact click without changing the link', async () => {
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
  telegram.addEventListener('click', (event) => event.preventDefault());
  await user.click(telegram);

  expect(trackAnalyticsEventMock).toHaveBeenCalledWith({
    name: 'contact_clicked',
    properties: { channel: 'telegram', section: 'footer', locale: 'ru' },
  });
  expect(telegram).toHaveAttribute('href', content.contact.telegramHref);
});
