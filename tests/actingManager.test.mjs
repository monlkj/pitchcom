import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === './coachTypes') return nextResolve('./coachTypes.ts', context);
  return nextResolve(specifier, context);
} });

const { appointActingManager, isActingManager, releaseActingManager } = await import('../lib/actingManager.ts');

const headCoach = { id: 'head', role: 'coach', teamCode: 'A', joinApproved: true, coachTypes: ['수석코치'] };
const battingCoach = { id: 'bat', role: 'coach', teamCode: 'A', joinApproved: true, coachTypes: ['타격코치'] };

test('an approved head coach becomes acting manager only for the departed team', () => {
  const members = appointActingManager([headCoach, battingCoach], 'A');
  assert.equal(isActingManager(members[0], 'A'), true);
  assert.equal(isActingManager(members[0], 'B'), false);
  assert.equal(isActingManager(members[1], 'A'), false);
  assert.equal(members[0].role, 'coach');
});

test('returning director releases the acting manager and a non-head coach is never promoted', () => {
  const active = appointActingManager([headCoach, battingCoach], 'A');
  const released = releaseActingManager(active, 'A');
  assert.equal(isActingManager(released[0], 'A'), false);
  assert.deepEqual(appointActingManager([{ ...battingCoach, coachTypes: ['수석코치'], joinApproved: false }], 'A'), [{ ...battingCoach, coachTypes: ['수석코치'], joinApproved: false }]);
});
