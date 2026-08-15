import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getContent } from '../content';
import { readPreferredLocale } from '../lib/locale';
import { Navigation } from './Navigation';

const { trackAnalyticsEventMock } = vi.hoisted(() => ({
  trackAnalyticsEventMock: vi.fn(),
}));

vi.mock('../lib/analytics', () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

describe('Navigation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    trackAnalyticsEventMock.mockReset();
    window.history.replaceState({}, '', '/en/');
  });

  it('lets keyboard users skip directly to the main content', () => {
    render(<Navigation locale="en" labels={getContent('en').nav} />);

    expect(
      screen.getByRole('link', { name: 'Skip to content' }),
    ).toHaveAttribute('href', '#main-content');
  });

  it('uses regular anchors for primary navigation', () => {
    render(<Navigation locale="en" labels={getContent('en').nav} />);

    expect(screen.getByRole('link', { name: 'Work' })).toHaveAttribute(
      'href',
      '#work',
    );
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute(
      'href',
      '#about',
    );
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      '#contact',
    );
  });

  it('exposes real locale links and identifies the active locale', () => {
    render(<Navigation locale="en" labels={getContent('en').nav} />);

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

  it('persists an explicit locale and carries the current section on activation', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/en/#work');
    render(<Navigation locale="en" labels={getContent('en').nav} />);
    const russianLink = screen.getByRole('link', { name: 'Русский' });
    russianLink.addEventListener('click', (event) => event.preventDefault());

    await user.click(russianLink);

    expect(readPreferredLocale()).toBe('ru');
    expect(russianLink).toHaveAttribute('href', '/ru/#work');
    expect(trackAnalyticsEventMock).toHaveBeenCalledWith({
      name: 'language_changed',
      properties: { from: 'en', to: 'ru' },
    });
  });

  it('does not report selecting the already-active language as a change', async () => {
    const user = userEvent.setup();
    render(<Navigation locale="en" labels={getContent('en').nav} />);
    const englishLink = screen.getByRole('link', { name: 'English' });
    englishLink.addEventListener('click', (event) => event.preventDefault());

    await user.click(englishLink);

    expect(trackAnalyticsEventMock).not.toHaveBeenCalled();
  });
});
