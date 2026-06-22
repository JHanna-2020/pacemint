import { describe, expect, it } from 'vitest';
import {
  decryptJSON,
  derivePasswordKey,
  deriveRecoveryKey,
  encryptJSON,
  generateDEK,
  generateRecoveryCode,
  generateSalt,
  normalizeRecoveryCode,
  unwrapDEK,
  wrapDEK
} from './crypto';

const FAST_ITERS = 1000; // keep tests quick; production uses 600k

describe('crypto', () => {
  it('round-trips an encrypted JSON payload', async () => {
    const dek = await generateDEK();
    const payload = { description: 'Coffee', amount: 4.5, category: 'Dining Out' };
    const ciphertext = await encryptJSON(payload, dek);
    expect(ciphertext).not.toContain('Coffee');
    expect(await decryptJSON(ciphertext, dek)).toEqual(payload);
  });

  it('unwraps the DEK with the correct password', async () => {
    const salt = generateSalt();
    const dek = await generateDEK();
    const kek = await derivePasswordKey('hunter2', salt, FAST_ITERS);
    const wrapped = await wrapDEK(dek, kek);

    const unlocked = await unwrapDEK(wrapped, await derivePasswordKey('hunter2', salt, FAST_ITERS));
    const sample = await encryptJSON({ ok: true }, dek);
    expect(await decryptJSON(sample, unlocked)).toEqual({ ok: true });
  });

  it('fails to unwrap the DEK with a wrong password', async () => {
    const salt = generateSalt();
    const wrapped = await wrapDEK(await generateDEK(), await derivePasswordKey('right', salt, FAST_ITERS));
    await expect(unwrapDEK(wrapped, await derivePasswordKey('wrong', salt, FAST_ITERS))).rejects.toBeTruthy();
  });

  it('recovers the DEK from the recovery code regardless of formatting', async () => {
    const salt = generateSalt();
    const dek = await generateDEK();
    const code = generateRecoveryCode();
    const wrapped = await wrapDEK(dek, await deriveRecoveryKey(code, salt, FAST_ITERS));

    // Lowercase + spaces should still unwrap thanks to normalization.
    const messy = code.toLowerCase().replace(/-/g, ' ');
    const unlocked = await unwrapDEK(wrapped, await deriveRecoveryKey(messy, salt, FAST_ITERS));
    const sample = await encryptJSON({ recovered: 1 }, dek);
    expect(await decryptJSON(sample, unlocked)).toEqual({ recovered: 1 });
  });

  it('normalizes recovery codes', () => {
    expect(normalizeRecoveryCode('abcd-efgh ijkl')).toBe('ABCDEFGHIJKL');
  });
});
