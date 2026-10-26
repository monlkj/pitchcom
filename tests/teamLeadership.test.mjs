import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
// Next's bundler resolves extensionless TS imports; mirror that for Node's TS runner.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === './playerParticipation' && context.parentURL?.endsWith('/lib/teamLeadership.ts')) return nextResolve('./playerParticipation.ts', context);
  return nextResolve(specifier, context);
} });
const { isEligibleLeader, resolveLeadership } = await import('../lib/teamLeadership.ts');
const member = { id: 'original-id', role: 'manager', playsAsPlayer: true, teamCode: 'A', joinApproved: true };

test('playing managers/coaches can lead without replacing their staff role', () => {
  for (const role of ['manager', 'coach', 'player']) {
    const candidate = { ...member, role };
    assert.equal(isEligibleLeader(candidate, 'A'), true);
    assert.equal(candidate.role, role);
  }
  for (const role of ['manager', 'coach']) assert.equal(isEligibleLeader({ ...member, role, playsAsPlayer: false }, 'A'), false);
});
test('pending, retired and other-team profiles cannot be nominated', () => {
  assert.equal(isEligibleLeader({ ...member, joinApproved: false }, 'A'), false);
  assert.equal(isEligibleLeader({ ...member, transferredTo: 'new-profile' }, 'A'), false);
  assert.equal(isEligibleLeader(member, 'B'), false);
});
test('changing login identity keeps the original appointment, but rejoining invalidates its old approval token', () => {
  const appointment = { captainId: member.id, captainRequestId: null, viceCaptainId: null, viceCaptainRequestId: null };
  const transferred = { ...member, email: 'new-login', identityVersion: 1 };
  assert.equal(resolveLeadership(appointment, [transferred], 'A').captainId, member.id);
  const rejoined = { ...transferred, joinRequestId: 'new-approval' };
  assert.equal(resolveLeadership(appointment, [rejoined], 'A').captainId, null);
  assert.equal(resolveLeadership({ ...appointment, viceCaptainId: member.id }, [member], 'A').viceCaptainId, null);
});
