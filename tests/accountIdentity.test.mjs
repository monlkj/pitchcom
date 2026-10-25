import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeProfiles, preserveIdentityChanges } from '../lib/accountIdentity.ts';

test('stale profile writes cannot restore the previous login identity', () => {
  const live = { id: 'original', name: 'old name', email: 'new-id', role: 'manager', teamCode: 'A', identityVersion: 1, temporaryCredential: { hash: 'new-hash' } };
  const stale = { id: 'original', name: 'updated name', email: 'old-id', role: 'manager', teamCode: 'B', password: 'old-password' };
  const [merged] = preserveIdentityChanges([stale], [live]);
  assert.equal(merged.id, live.id);
  assert.equal(merged.email, live.email);
  assert.equal(merged.password, undefined);
  assert.deepEqual(merged.temporaryCredential, live.temporaryCredential);
  assert.equal(merged.name, 'updated name');
  assert.equal(merged.teamCode, 'B');
});
test('an archived unused target cannot be revived by stale caches', () => {
  const archive = { id: 'target', name: 'unused', email: '', role: 'player', teamCode: '', transferredTo: 'original' };
  const stale = { id: 'target', name: 'unused', email: 'new-id', role: 'player', teamCode: '', password: 'password' };
  const stored = preserveIdentityChanges([stale], [archive]);
  assert.deepEqual(stored, [archive]);
  assert.deepEqual(activeProfiles(stored), []);
  assert.deepEqual(preserveIdentityChanges([], [archive]), [archive]);
});
test('current-version profile edits remain intact', () => {
  const live = { id: 'original', name: 'name', email: 'new-id', role: 'player', teamCode: 'A', identityVersion: 2 };
  const edit = { ...live, teamCode: 'B' };
  assert.deepEqual(preserveIdentityChanges([edit], [live]), [edit]);
});
