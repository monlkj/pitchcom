import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashTemporaryPassword, verifyTemporaryPassword, randomCredential } from '../lib/temporaryAccounts.ts';

test('issued credentials verify the right password without retaining plaintext', async () => {
  const password = randomCredential();
  const credential = await hashTemporaryPassword(password);
  assert.equal(await verifyTemporaryPassword(password, credential), true);
  assert.equal(await verifyTemporaryPassword(`${password}wrong`, credential), false);
  assert.equal(JSON.stringify(credential).includes(password), false);
});

test('equal passwords have different salted hashes', async () => {
  const first = await hashTemporaryPassword('test-only-password');
  const second = await hashTemporaryPassword('test-only-password');
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await verifyTemporaryPassword('test-only-password', second), true);
});

test('malformed credentials and unsupported work factors fail closed', async () => {
  const credential = await hashTemporaryPassword('test-only-password');
  assert.equal(await verifyTemporaryPassword('test-only-password', { ...credential, iterations: 1 }), false);
  assert.equal(await verifyTemporaryPassword('test-only-password', { ...credential, salt: 'not-hex' }), false);
  assert.equal(await verifyTemporaryPassword('test-only-password', { ...credential, hash: '' }), false);
  assert.equal(await verifyTemporaryPassword('test-only-password', null), false);
  assert.equal(await verifyTemporaryPassword('x'.repeat(257), credential), false);
});
