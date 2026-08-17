import { startConductor } from './conductor';

/**
 * Composition root for the motion layer. This module and everything it imports
 * must stay out of the eager bundle: `boot.ts` reaches it only through a
 * dynamic import, which is what keeps the entry graph inside its budget.
 */
export function startRuntime(): () => void {
  const disposers = [startConductor()];

  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}
