import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands/commands';
import { pickArb, pickCommand } from '../testing/commands';
import { sampleSetup } from '../testing/fixtures';
import { revalidate, validateAll } from './validate';

// Property: the incremental result equals full validation after any random sequence of commands.

const { ctx, state: seed } = sampleSetup();
const seedViolations = validateAll(seed, ctx);

describe('property: incremental validation equals full validation', () => {
  it.each([
    ['valid commands (checked)', true],
    ['any structurally possible commands (unchecked, errors allowed)', false],
  ])('after %s', (_name, check) => {
    fc.assert(
      fc.property(fc.array(pickArb, { minLength: 1, maxLength: 15 }), (picks) => {
        let s = seed;
        let v = seedViolations;
        for (const p of picks) {
          const r = applyCommand(s, ctx, pickCommand(s, ctx, p), { check });
          if (!r.ok) continue;
          s = r.state;
          v = revalidate(v, s, ctx, r.touched);
          expect(v).toEqual(validateAll(s, ctx));
        }
      }),
      { numRuns: 60 },
    );
  });
});
