// Manages the user's Data Encryption Key (DEK) lifecycle and the `user_keys`
// table that stores the wrapped copies of it. The plaintext DEK is held only in
// this module's memory and is exposed to the repository via getDEK().

import { supabase } from './supabase';
import {
  CRYPTO_DEFAULTS,
  WrappedKey,
  derivePasswordKey,
  deriveRecoveryKey,
  generateDEK,
  generateRecoveryCode,
  generateSalt,
  unwrapDEK,
  wrapDEK
} from './crypto';

type UserKeysRow = {
  user_id: string;
  kdf_salt: string;
  kdf_iterations: number;
  recovery_salt: string;
  wrapped_dek_password: string;
  wrapped_dek_recovery: string;
};

let activeDEK: CryptoKey | null = null;
let pendingDEK: CryptoKey | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function setDEK(dek: CryptoKey) {
  activeDEK = dek;
  emit();
}

export function clearDEK() {
  activeDEK = null;
  pendingDEK = null;
  emit();
}

export function activatePendingDEK(): void {
  if (!pendingDEK) throw new Error('No pending encryption key is available.');
  const dek = pendingDEK;
  pendingDEK = null;
  setDEK(dek);
}

export function hasDEK(): boolean {
  return activeDEK !== null;
}

export function getDEK(): CryptoKey {
  if (!activeDEK) throw new Error('Your encrypted vault is locked. Please sign in again.');
  return activeDEK;
}

// Lets React re-render when the vault locks/unlocks.
export function subscribeVault(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// --- wrapped-key serialization (stored as "iv:ciphertext") ----------------

function serializeWrapped(wrapped: WrappedKey): string {
  return `${wrapped.iv}:${wrapped.ciphertext}`;
}

function parseWrapped(value: string): WrappedKey {
  const [iv, ciphertext] = value.split(':');
  if (!iv || !ciphertext) throw new Error('Corrupted key material.');
  return { iv, ciphertext };
}

async function loadUserKeys(userId: string): Promise<UserKeysRow | null> {
  const { data, error } = await supabase
    .from('user_keys')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<UserKeysRow>();
  if (error) throw new Error(error.message);
  return data;
}

// True when the signed-in user has never set up encryption (fresh account).
export async function needsEncryptionSetup(userId: string): Promise<boolean> {
  return (await loadUserKeys(userId)) === null;
}

// First-time setup: create a DEK, wrap it with the password and a fresh
// recovery code, persist, unlock the session, and return the recovery code to
// show the user exactly once.
export async function setupEncryption(userId: string, password: string): Promise<string> {
  const kdfSalt = generateSalt();
  const recoverySalt = generateSalt();
  const recoveryCode = generateRecoveryCode();
  const iterations = CRYPTO_DEFAULTS.iterations;

  const dek = await generateDEK();
  const [passwordKek, recoveryKek] = await Promise.all([
    derivePasswordKey(password, kdfSalt, iterations),
    deriveRecoveryKey(recoveryCode, recoverySalt, iterations)
  ]);
  const [wrappedPassword, wrappedRecovery] = await Promise.all([
    wrapDEK(dek, passwordKek),
    wrapDEK(dek, recoveryKek)
  ]);

  const { error } = await supabase.from('user_keys').insert({
    user_id: userId,
    kdf_salt: kdfSalt,
    kdf_iterations: iterations,
    recovery_salt: recoverySalt,
    wrapped_dek_password: serializeWrapped(wrappedPassword),
    wrapped_dek_recovery: serializeWrapped(wrappedRecovery)
  });
  if (error) throw new Error(error.message);

  pendingDEK = dek;
  return recoveryCode;
}

// Unlock with the account password. Throws on a wrong password (GCM auth fail).
export async function unlockWithPassword(userId: string, password: string): Promise<void> {
  const keys = await loadUserKeys(userId);
  if (!keys) throw new Error('No encryption keys found for this account.');
  const kek = await derivePasswordKey(password, keys.kdf_salt, keys.kdf_iterations);
  try {
    const dek = await unwrapDEK(parseWrapped(keys.wrapped_dek_password), kek);
    setDEK(dek);
  } catch {
    throw new Error('That password could not unlock your encrypted data.');
  }
}

// Recover with the one-time recovery code and re-wrap the DEK under a new
// password. Used by the forgot-password flow after the auth password is reset.
export async function recoverWithCode(userId: string, recoveryCode: string, newPassword: string): Promise<void> {
  const keys = await loadUserKeys(userId);
  if (!keys) throw new Error('No encryption keys found for this account.');

  const recoveryKek = await deriveRecoveryKey(recoveryCode, keys.recovery_salt, keys.kdf_iterations);
  let dek: CryptoKey;
  try {
    dek = await unwrapDEK(parseWrapped(keys.wrapped_dek_recovery), recoveryKek);
  } catch {
    throw new Error('That recovery code is not valid.');
  }

  const newSalt = generateSalt();
  const newKek = await derivePasswordKey(newPassword, newSalt, keys.kdf_iterations);
  const rewrapped = await wrapDEK(dek, newKek);

  const { error } = await supabase
    .from('user_keys')
    .update({ kdf_salt: newSalt, wrapped_dek_password: serializeWrapped(rewrapped) })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  setDEK(dek);
}

// Change the password while unlocked: re-wrap the in-memory DEK under a new
// password. The recovery code is unaffected.
export async function changeEncryptionPassword(userId: string, newPassword: string): Promise<void> {
  if (!activeDEK) throw new Error('Unlock your vault before changing the password.');
  const keys = await loadUserKeys(userId);
  if (!keys) throw new Error('No encryption keys found for this account.');
  const newSalt = generateSalt();
  const newKek = await derivePasswordKey(newPassword, newSalt, keys.kdf_iterations);
  const rewrapped = await wrapDEK(activeDEK, newKek);
  const { error } = await supabase
    .from('user_keys')
    .update({ kdf_salt: newSalt, wrapped_dek_password: serializeWrapped(rewrapped) })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// Rotate the recovery code (e.g. after recovery). Returns the new code to show.
export async function regenerateRecoveryCode(userId: string): Promise<string> {
  if (!activeDEK) throw new Error('Unlock your vault before rotating the recovery code.');
  const keys = await loadUserKeys(userId);
  if (!keys) throw new Error('No encryption keys found for this account.');
  const recoveryCode = generateRecoveryCode();
  const recoverySalt = generateSalt();
  const recoveryKek = await deriveRecoveryKey(recoveryCode, recoverySalt, keys.kdf_iterations);
  const rewrapped = await wrapDEK(activeDEK, recoveryKek);
  const { error } = await supabase
    .from('user_keys')
    .update({ recovery_salt: recoverySalt, wrapped_dek_recovery: serializeWrapped(rewrapped) })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return recoveryCode;
}
