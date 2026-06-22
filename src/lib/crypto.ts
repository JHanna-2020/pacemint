// Zero-knowledge end-to-end encryption primitives built on the Web Crypto API.
//
// Key hierarchy (envelope encryption):
//   - A random 256-bit Data Encryption Key (DEK) encrypts all budget data.
//   - The DEK is wrapped (encrypted) twice and stored server-side:
//       * by a key derived from the user's password  (login path)
//       * by a key derived from a one-time recovery code (account recovery path)
//   - The plaintext DEK only ever exists in browser memory.
//
// All ciphertext is AES-256-GCM. Key derivation is PBKDF2-SHA256.

const PBKDF2_ITERATIONS = 600_000;
const AES_KEY_LENGTH = 256;
const GCM_IV_BYTES = 12;
const SALT_BYTES = 16;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type WrappedKey = {
  iv: string; // base64
  ciphertext: string; // base64
};

// --- base64 helpers -------------------------------------------------------

export function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// SubtleCrypto wants a plain `ArrayBuffer` (BufferSource); copy bytes into one
// so typed-array backing-store generics don't fight the lib types.
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

// --- randomness -----------------------------------------------------------

export function generateSalt(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
}

// A user-friendly recovery code: 160 bits of entropy rendered as Crockford
// base32 in five groups of seven, e.g. ABCDEFG-HJKMNPQ-...-...-...
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += CROCKFORD[bytes[i] % 32];
    if ((i + 1) % 4 === 0 && i + 1 < bytes.length) out += '-';
  }
  return out;
}

// Normalize user-entered recovery codes (strip spaces/dashes, uppercase) so
// formatting differences don't break unwrapping.
export function normalizeRecoveryCode(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

// --- key derivation -------------------------------------------------------

async function deriveKEK(secret: string, saltB64: string, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', toArrayBuffer(encoder.encode(secret)), 'PBKDF2', false, [
    'deriveKey'
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(base64ToBytes(saltB64)),
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

export function derivePasswordKey(password: string, saltB64: string, iterations = PBKDF2_ITERATIONS) {
  return deriveKEK(password, saltB64, iterations);
}

export function deriveRecoveryKey(code: string, saltB64: string, iterations = PBKDF2_ITERATIONS) {
  return deriveKEK(normalizeRecoveryCode(code), saltB64, iterations);
}

// --- DEK lifecycle --------------------------------------------------------

export function generateDEK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: AES_KEY_LENGTH }, true, ['encrypt', 'decrypt']);
}

export async function wrapDEK(dek: CryptoKey, kek: CryptoKey): Promise<WrappedKey> {
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const wrapped = await crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv: toArrayBuffer(iv) });
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(wrapped) };
}

// Unwraps the DEK. Throws (GCM auth failure) if the KEK is wrong — this is how
// we detect an incorrect password or recovery code.
export async function unwrapDEK(wrapped: WrappedKey, kek: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    toArrayBuffer(base64ToBytes(wrapped.ciphertext)),
    kek,
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(wrapped.iv)) },
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

// --- data encryption ------------------------------------------------------

// Encrypts an arbitrary JSON-serializable payload with the DEK. Returns a
// single opaque string "iv:ciphertext" (both base64) for storage in one column.
export async function encryptJSON(value: unknown, dek: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const data = toArrayBuffer(encoder.encode(JSON.stringify(value)));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, dek, data);
  return `${bytesToBase64(iv)}:${bytesToBase64(ciphertext)}`;
}

export async function decryptJSON<T = unknown>(payload: string, dek: CryptoKey): Promise<T> {
  const [ivB64, ctB64] = payload.split(':');
  if (!ivB64 || !ctB64) throw new Error('Malformed encrypted payload.');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(ivB64)) },
    dek,
    toArrayBuffer(base64ToBytes(ctB64))
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
}

export const CRYPTO_DEFAULTS = { iterations: PBKDF2_ITERATIONS };
