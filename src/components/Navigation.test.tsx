import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { getContent } from '../content';
import { readPreferredLocale } from '../lib/locale';
import { Navigation } from './Navigation';

describe('Navigation', () => {
  beforeEach(() => {
    window.localStorage.clear();
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
  });
});
