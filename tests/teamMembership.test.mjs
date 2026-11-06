import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (['./managerTeams', './memberIdentity'].includes(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });
const { planTeamChange, resolveTeamChangeResult } = await import('../lib/teamMembership.ts');
const manager = { id: 'director', name: '감독', email: 'director', role: 'manager', teamCode: 'B', managedTeamCodes: ['A', 'B', 'C'], playsAsPlayer: true, identityVersion: 1 };

test('a director can return to A using a stale A session while the current server team is B', () => {
  const stale = { ...manager, teamCode: 'A', managedTeamCodes: ['A'], playsAsPlayer: false };
  const change = planTeamChange([manager], stale, ' a ', false, 'unused');
  assert.equal(change.unchanged, false); assert.equal(change.member.teamCode, 'A');
  assert.equal(change.member.joinApproved, true); assert.equal(change.needsRequest, false);
  assert.deepEqual(change.member.managedTeamCodes, ['A','B','C']); assert.equal(change.member.playsAsPlayer, true);
});
test('directors retain all owned and reserved codes across repeated moves and leaving', () => {
  let users = [{ ...manager, reservedManagedTeamCodes: ['OLD'] }];
  for (const code of ['D','A','C','B','']) {
    const change = planTeamChange(users, users[0], code, !code, 'unused');
    assert.equal(change.needsRequest, false); assert.equal(change.member.joinApproved, true);
    for (const own of ['A','B','C','D','OLD']) assert.ok(change.member.managedTeamCodes.includes(own));
    users = change.members;
  }
});
test('another director remains protected and normal players still need new approval', () => {
  const other = { ...manager, id: 'other', email: 'other', teamCode: 'TAKEN', managedTeamCodes: ['TAKEN'] };
  assert.throws(() => planTeamChange([manager,other],manager,'TAKEN',false,'unused'),/이미 감독/);
  const player = { id:'player',name:'선수',email:'player',role:'player',teamCode:'' };
  const change = planTeamChange([manager,player],player,'A',false,'new-request');
  assert.equal(change.needsRequest,true); assert.equal(change.member.joinApproved,false); assert.equal(change.member.joinRequestId,'new-request');
});
test('only the selected profile moves and mismatched credentials/version cannot select another profile', () => {
  const duplicate = { ...manager, id:'duplicate', teamCode:'C' };
  const change = planTeamChange([manager,duplicate],manager,'NEW',false,'unused');
  assert.deepEqual(change.members[1],duplicate);
  assert.throws(() => planTeamChange([manager],{...manager,identityVersion:0},'NEW',false,'unused'),/다시 로그인/);
});
test('the saved returned profile is selected by the verified transition, not a matching name', () => {
  const returned = { ...manager,id:'restored',teamCode:'OLD',identityVersion:2,teamReturn:{fromId:manager.id,fromIdentityVersion:1} };
  assert.equal(resolveTeamChangeResult([returned],manager)?.id,'restored');
  assert.equal(resolveTeamChangeResult([{...returned,email:'someone-else'}],manager),undefined);
  assert.equal(resolveTeamChangeResult([{...returned,teamReturn:{fromId:manager.id,fromIdentityVersion:0}}],manager),undefined);
});

test('a concurrent password or identity update cannot silently refresh an old session', () => {
  assert.equal(resolveTeamChangeResult([{ ...manager, identityVersion: 2 }], manager), undefined);
});
