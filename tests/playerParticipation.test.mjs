import assert from 'node:assert/strict';
import { participatesAsPlayer } from '../lib/playerParticipation.ts';
assert.equal(participatesAsPlayer({ role: 'player' }), true);
for (const role of ['manager', 'coach']) {
  const member = { role, playsAsPlayer: false, managedTeamCodes: ['A'] };
  assert.equal(participatesAsPlayer(member), false);
  member.playsAsPlayer = true;
  assert.equal(participatesAsPlayer(member), true);
  assert.equal(member.role, role);
  assert.deepEqual(member.managedTeamCodes, ['A']);
}
assert.equal(participatesAsPlayer({ role: 'unknown', playsAsPlayer: true }), false);
assert.equal(participatesAsPlayer(null), false);
console.log('PASS player participation supports staff without changing authority or ownership.');
