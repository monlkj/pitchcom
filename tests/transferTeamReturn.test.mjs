import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archiveTransferProfile, ownedTeamCodes, restoreTransferTeams } from '../lib/transferTeamReturn.ts';
import { activeProfiles, preserveIdentityChanges } from '../lib/accountIdentity.ts';
import { profileSession } from '../lib/profileSession.ts';

const target = { id: 'old-google-profile', name: '이전이름', email: 'new-email', authUserId: 'google-id', role: 'manager', teamCode: 'OLD', managedTeamCodes: ['OLD'], joinApproved: true, playsAsPlayer: true, coachTypes: ['수비코치'] };
const active = { id: 'source-profile', name: '현재이름', email: 'new-email', authUserId: 'google-id', role: 'player', teamCode: 'NEW', joinApproved: true, joinRequestId: 'new-request', identityVersion: 1, transferReturnId: target.id, reservedManagedTeamCodes: ['OLD'] };
const parked = archiveTransferProfile(target, active.id);

test('parking keeps complete former membership but removes credentials', () => {
  assert.equal(parked.teamCode, 'OLD'); assert.equal(parked.joinApproved, true);
  assert.deepEqual(parked.coachTypes, ['수비코치']); assert.equal(parked.authUserId, undefined); assert.equal(parked.email, '');
  assert.deepEqual(activeProfiles([active, parked]), [active]);
  assert.deepEqual(ownedTeamCodes(active), ['OLD']);
});
test('kick returns to original profile ID, membership and role; sessions contain no credentials', () => {
  const exit = { ...active, teamCode: '', joinApproved: false, removalNotice: { id: 'notice', teamCode: 'NEW' } };
  const { profiles, restored } = restoreTransferTeams([exit, parked], [active, parked]);
  assert.equal(restored, true);
  const returned = activeProfiles(profiles)[0];
  assert.equal(returned.id, target.id); assert.equal(returned.teamCode, 'OLD'); assert.equal(returned.role, 'manager');
  assert.equal(returned.joinApproved, true); assert.equal(returned.joinRequestId, undefined); assert.equal(returned.authUserId, 'google-id');
  assert.equal(returned.teamReturn.fromId, active.id); assert.deepEqual(returned.removalNotice, exit.removalNotice);
  const archive = profiles.find(p => p.id === active.id);
  assert.equal(archive.transferredTo, target.id); assert.equal(archive.transferReturnId, undefined); assert.equal(archive.authUserId, undefined);
  assert.equal(profileSession({ ...returned, password: 'secret', temporaryCredential: { hash: 'secret' } }).password, undefined);
  assert.equal(profileSession(returned).teamReturn.fromId, active.id);
});
test('temporary credentials follow return without restoring stale destination passwords', () => {
  const current = { ...active, authUserId: undefined, temporaryCredential: { hash: 'current-hash' }, accountType: 'temporary' };
  const [_, returned] = restoreTransferTeams([{ ...current, teamCode: '' }, parked], [current, parked]).profiles;
  assert.deepEqual(returned.temporaryCredential, current.temporaryCredential); assert.equal(returned.password, undefined);
});
test('normal edits, moving directly between teams and missing/deleted sources do not restore', () => {
  for (const incoming of [[active, parked], [{ ...active, teamCode: 'OTHER' }, parked], [parked]]) assert.equal(restoreTransferTeams(incoming, [active, parked]).restored, false);
  assert.throws(() => restoreTransferTeams([{ ...active, teamCode: '' }], [active, parked]), /보관한/);
});
test('stale clients cannot erase return metadata, revive departed source or overwrite restored membership', () => {
  const merged = preserveIdentityChanges([{ ...active, transferReturnId: undefined, reservedManagedTeamCodes: undefined }], [active, parked]);
  assert.equal(merged.find(p => p.id === active.id).transferReturnId, parked.id);
  const result = restoreTransferTeams([{ ...active, teamCode: '' }, parked], [active, parked]);
  const stale = { ...target, teamCode: 'STALE' };
  const next = preserveIdentityChanges([active, stale], result.profiles);
  assert.equal(next.find(p => p.id === active.id).transferredTo, parked.id);
  assert.equal(next.find(p => p.id === target.id).teamCode, 'OLD');
});

test('the original director can resume a reserved parked team by entering its code', () => {
  const originalDirector = { ...active, role: 'manager', managedTeamCodes: ['NEW'] };
  const originalPlayer = { ...target, role: 'player', managedTeamCodes: undefined, reservedManagedTeamCodes: undefined };
  const parkedPlayer = archiveTransferProfile(originalPlayer, originalDirector.id);
  const first = restoreTransferTeams([{ ...originalDirector, teamCode: '' }, parkedPlayer], [originalDirector, parkedPlayer]).profiles;
  const livePlayer = first.find(p => !p.transferredTo);
  const request = first.map(p => p.id === livePlayer.id ? { ...p, teamCode: 'NEW', joinApproved: false } : p);
  const resumed = restoreTransferTeams(request, first).profiles;
  const director = resumed.find(p => !p.transferredTo);
  assert.equal(director.id, originalDirector.id); assert.equal(director.role, 'manager');
  assert.equal(director.teamCode, 'NEW'); assert.equal(director.joinApproved, true);
  assert.equal(director.transferReturnId, originalPlayer.id);
  const backAgain = restoreTransferTeams(resumed.map(p => p.id === director.id ? { ...p, teamCode: '' } : p), resumed).profiles.find(p => !p.transferredTo);
  assert.equal(backAgain.id, originalPlayer.id); assert.equal(backAgain.teamCode, 'OLD');
});

test('unaffiliated transferred account can explicitly return without an automatic read-time switch', () => {
  const live = { ...active, teamCode: '' };
  assert.equal(restoreTransferTeams([live, parked], [live, parked]).restored, false);
  const result = restoreTransferTeams([{ ...live, requestTransferReturn: true }, parked], [live, parked]);
  assert.equal(result.restored, true); assert.equal(result.profiles.find(p => !p.transferredTo).teamCode, 'OLD');
});

test('director ownership survives archive chains, but unrelated archives and player memberships cannot grant authority', () => {
  const live = { ...active, transferReturnId: undefined, role: 'player', id: 'latest', teamCode: 'CURRENT' };
  const bridge = { ...parked, id: 'bridge', role: 'player', transferredTo: live.id };
  const director = { ...parked, id: 'director', role: 'manager', transferredTo: bridge.id };
  const edit = { ...live, teamCode: 'OLD' };
  const result = restoreTransferTeams([edit, bridge, director], [live, bridge, director]);
  assert.equal(result.restored, true); assert.equal(result.profiles.find(p => !p.transferredTo).id, director.id);
  const otherDirector = { ...director, transferredTo: 'someone-else' };
  assert.equal(restoreTransferTeams([edit, otherDirector], [live, otherDirector]).restored, false);
  const player = { ...director, role: 'player' };
  assert.equal(restoreTransferTeams([edit, bridge, player], [live, bridge, player]).restored, false);
  const cycle = { ...director, transferredTo: director.id };
  assert.equal(restoreTransferTeams([edit, cycle], [live, cycle]).restored, false);
});
