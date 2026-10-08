import { describe, expect, it } from 'vitest';
import { applyCommand, revalidate, suggestFix, validateAll, type Command } from '@/domain';
import { sampleSetup } from '@/domain/testing/fixtures';
import { activityText, resultMessage } from './messages';

const { ctx, state, call } = sampleSetup();
const violations = validateAll(state, ctx);

function run(cmd: Command) {
  const r = applyCommand(state, ctx, cmd, { check: false });
  if (!r.ok) throw new Error(r.reason);
  const after = { state: r.state, violations: revalidate(violations, r.state, ctx, r.touched) };
  return resultMessage(cmd, { state, violations }, after, ctx);
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const topOf = (bay: number) =>
  [...state.placements.entries()].find(
    ([k, p]) => +k.slice(0, 2) === bay && k.endsWith('82') && !p.locked,
  )!;

describe('activity log text (FR-58)', () => {
  it('names the container and the slots', () => {
    expect(activityText({ kind: 'place', containerId: 'NSPU 551208 4', to: '180688' }, state)).toBe(
      'Placed NSPU 551208 4 at 180688',
    );
    const [key, p] = topOf(18);
    expect(activityText({ kind: 'move', from: key, to: '180090' }, state)).toBe(
      `Moved ${p.containerId} from ${key} to 180090`,
    );
    expect(activityText({ kind: 'unplace', from: key }, state)).toBe(
      `Unplaced ${p.containerId} from ${key}`,
    );
    expect(activityText({ kind: 'lock', at: key }, state)).toBe(
      `Locked ${p.containerId} at ${key}`,
    );
    expect(activityText({ kind: 'unlock', at: key }, state)).toBe(
      `Unlocked ${p.containerId} at ${key}`,
    );
    expect(activityText({ kind: 'swap', a: key, b: key }, state)).toBe(
      `Swapped ${p.containerId} at ${key} with ${p.containerId} at ${key}`,
    );
    expect(
      activityText(
        {
          kind: 'batch',
          commands: [
            { kind: 'lock', at: key },
            { kind: 'unlock', at: key },
          ],
        },
        state,
      ),
    ).toBe(`Locked ${p.containerId} at ${key}; Unlocked ${p.containerId} at ${key}`);
  });
});

describe('result message (FR-57)', () => {
  it('says a stack weight violation is resolved, as the components sheet does', () => {
    const fix = suggestFix(violations[0]!, state, ctx);
    if (fix.kind !== 'fix') throw new Error('no fix');
    const m = run(fix.command);
    expect(m.kind).toBe('ok');
    expect(m.title).toBe('Resolved · Stack weight');
    expect(m.message).toMatch(/^Stack 18-04 deck back to 79\.3 t of 90\.0 t/);
  });

  it('says what was done when no violation changes', () => {
    const [key, p] = topOf(86);
    expect(run({ kind: 'lock', at: key })).toEqual({
      kind: 'ok',
      title: `Locked ${key}`,
      message: p.containerId,
    });
    const listed = new Set(call.loadList.map((x) => x.container.id));
    const [own, q] = [...state.placements.entries()].find(
      ([k, x]) =>
        listed.has(x.containerId) &&
        !state.placements.has(`${k.slice(0, 4)}${pad2(+k.slice(4) + 2)}`),
    )!;
    expect(run({ kind: 'unplace', from: own })).toEqual({
      kind: 'ok',
      title: `Unplaced ${q.containerId}`,
      message: 'Returned to load list',
    });
  });

  it('puts a new violation first', () => {
    const m = run({ kind: 'place', containerId: 'NSPU 551208 4', to: '180688' });
    expect(m).toMatchObject({ kind: 'warn', title: 'New violation · Stack weight' });
    expect(m.message).toContain('96.4');
  });
});
