import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ProofRow } from './ProofRow';

const points = [
  { value: '12', label: 'years' },
  { value: '4', label: 'products' },
  { value: '350', label: 'users' },
  { value: '99', label: 'uptime' },
  { value: '7', label: 'languages' },
];

const facts = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-motion-reveal]')].map((fact) =>
    (fact as HTMLElement).style.getPropertyValue('--reveal-index'),
  );

/*
 * The stagger is what makes the facts read as one row arriving rather than one
 * block; past a few steps it reads as a queue instead, and the last fact would
 * wait longer the more facts there are. The cap is why a longer row arrives in
 * the same time as this one.
 */
it('staggers the facts it reveals and stops the wait at the fourth', () => {
  const { container } = render(<ProofRow points={points} reveals />);

  expect(facts(container)).toEqual(['0', '1', '2', '3', '3']);
});

/*
 * Nested in a project scene the row is part of the scene's copy block, which
 * has its own reveal: marking the facts again would animate the same pixels
 * twice and hold them back until a second observer agreed.
 */
it('leaves the facts to their surroundings when it is part of a larger block', () => {
  const { container } = render(<ProofRow points={points} />);

  expect(container.querySelector('[data-motion-scope]')).toBeNull();
  expect(facts(container)).toEqual([]);
});
