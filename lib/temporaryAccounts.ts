// Credentials for newly issued temporary accounts never store a plaintext password.
export interface TemporaryCredential {
  algorithm: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  hash: string;
}
const ITERATIONS = 210_000;
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const bytes = (value: string) => Uint8Array.from(value.match(/../g) ?? [], pair => parseInt(pair, 16));
export function randomCredential(bytesCount = 12): string {
  return hex(crypto.getRandomValues(new Uint8Array(bytesCount)));
}
async function derive(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations }, key, 256);
  return hex(new Uint8Array(bits));
}
export async function hashTemporaryPassword(password: string): Promise<TemporaryCredential> {
  const salt = randomCredential(16);
  return { algorithm: 'PBKDF2-SHA256', iterations: ITERATIONS, salt, hash: await derive(password, salt, ITERATIONS) };
}
export async function verifyTemporaryPassword(password: string, credential: TemporaryCredential): Promise<boolean> {
  if (credential?.algorithm !== 'PBKDF2-SHA256' || credential.iterations !== ITERATIONS ||
    !/^[a-f0-9]{32}$/.test(credential.salt) || !/^[a-f0-9]{64}$/.test(credential.hash) || password.length > 256) return false;
  const result = await derive(password, credential.salt, credential.iterations);
  let difference = 0;
  for (let i = 0; i < result.length; i++) difference |= result.charCodeAt(i) ^ credential.hash.charCodeAt(i);
  return difference === 0;
}
