import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { preferredLocaleStorageKey } from '../lib/locale';
import { LocaleLinks } from './LocaleLinks';

const { trackAnalyticsEventMock } = vi.hoisted(() => ({
  trackAnalyticsEventMock: vi.fn(),
}));

vi.mock('../lib/analytics', () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

beforeEach(() => {
  window.localStorage.clear();
  trackAnalyticsEventMock.mockReset();
  window.history.replaceState({}, '', '/en/');
});

/** The switch has to keep working when JavaScript never runs. */
it('renders both languages as real links and marks the active one', () => {
  render(<LocaleLinks locale="en" />);

  expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute(
    'href',
    '/en/',
  );
  expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(screen.getByRole('link', { name: 'Русский' })).toHaveAttribute(
    'href',
    '/ru/',
  );
  expect(screen.getByRole('link', { name: 'Русский' })).not.toHaveAttribute(
    'aria-current',
  );
});

it('persists the choice and carries the current section across', async () => {
  const user = userEvent.setup();
  window.history.replaceState({}, '', '/en/#work');
  render(<LocaleLinks locale="en" />);
  const russian = screen.getByRole('link', { name: 'Русский' });
  russian.addEventListener('click', (event) => event.preventDefault());

  await user.click(russian);

  expect(window.localStorage.getItem(preferredLocaleStorageKey)).toBe('ru');
  expect(russian).toHaveAttribute('href', '/ru/#work');
  expect(trackAnalyticsEventMock).toHaveBeenCalledWith({
    name: 'language_changed',
    properties: { from: 'en', to: 'ru' },
  });
});

it('does not report selecting the already-active language as a change', async () => {
  const user = userEvent.setup();
  render(<LocaleLinks locale="en" />);
  const english = screen.getByRole('link', { name: 'English' });
  english.addEventListener('click', (event) => event.preventDefault());

  await user.click(english);

  expect(trackAnalyticsEventMock).not.toHaveBeenCalled();
});
