import { render, screen, within } from '@testing-library/react';
import { en } from '../content/en';
import { EngineeringDetails } from './EngineeringDetails';

it('renders every engineering detail as a titled, always-visible entry', () => {
  render(<EngineeringDetails content={en.engineering} />);

  const section = screen.getByRole('region', {
    name: en.engineering.heading,
  });
  const items = within(section).getAllByRole('listitem');

  expect(items).toHaveLength(en.engineering.items.length);
  expect(items.length).toBeGreaterThan(0);

  for (const [index, item] of en.engineering.items.entries()) {
    const entry = items[index];
    expect(entry).toBeDefined();
    if (!entry) throw new Error(`Missing engineering detail ${index + 1}`);

    expect(
      within(entry).getByRole('heading', { level: 3, name: item.title }),
    ).toBeInTheDocument();
    expect(within(entry).getByText(item.body)).toBeVisible();
  }

  // No collapsed/expandable affordance: every detail is visible up front.
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
