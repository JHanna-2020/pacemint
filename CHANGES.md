# PaceMint — Change Summary

This document summarizes the work done to add **multi-user support with end-to-end
encrypted data** and a **forgot-password / recovery flow** to PaceMint.

## Goal

- Multiple users, each with fully isolated data.
- All budget data encrypted in the database (zero-knowledge: the DB stores only ciphertext).
- A forgot-password function backed by a one-time recovery code.

Multi-user isolation already existed via Supabase Auth + per-user `user_id` rows
and row-level security. The new work is the encryption layer and recovery flow
layered on top.

## How it works (high level)

- A random 256-bit **Data Encryption Key (DEK)** encrypts all budget data with AES-256-GCM.
- The DEK is wrapped (encrypted) twice and stored in a new `user_keys` table:
  - by a key derived from the account **password** (PBKDF2-SHA256, 600k iterations)
  - by a key derived from a one-time **recovery code** shown once at sign-up
- The plaintext DEK exists only in browser memory. After a refresh, an **Unlock**
  screen re-derives it from the password.
- **Forgot password:** the Supabase email reset sets a new password; the user then
  enters their recovery code to decrypt and re-encrypt their data under the new password.
- Sensitive fields are stored in a single encrypted `enc_payload` column per row.
  Structural columns (ids, foreign keys, timestamps) stay cleartext so relations
  and RLS keep working.

## New files

| File | Purpose |
| --- | --- |
| `src/lib/crypto.ts` | Web Crypto primitives: AES-GCM encrypt/decrypt, PBKDF2 key derivation, DEK generation/wrap/unwrap, recovery-code generation/normalization, base64 helpers. |
| `src/lib/encryptionSession.ts` | In-memory DEK lifecycle and `user_keys` access: setup, unlock, recover, change password, rotate recovery code. Exposes `getDEK()` / `hasDEK()` / `subscribeVault()`. |
| `src/components/VaultGate.tsx` | Unlock screen (after refresh) and recovery-code restore. |
| `src/components/ResetPasswordView.tsx` | Post-email-reset screen: set new password + restore vault via recovery code in one step. |
| `src/lib/crypto.test.ts` | Unit tests for encrypt/decrypt round-trip, password unwrap, wrong-password failure, recovery-code restore. |
| `supabase/encryption-setup.sql` | Canonical schema: `user_keys` table, `enc_payload` columns, RLS policies. |
| `CLAUDE.md` | Architecture/commands guide for future work in this repo. |
| `CHANGES.md` | This file. |

## Changed files

| File | Change |
| --- | --- |
| `src/lib/types.ts` | Row types changed to the encrypted shape (`enc_payload` + structural columns); added cleartext payload types. Domain types unchanged. |
| `src/services/budgetRepository.ts` | Encrypts on write / decrypts on read. Month filtering, sorting, and category uniqueness moved client-side (the DB can't query encrypted fields). Skips rows with no `enc_payload`. Export now read-only. |
| `src/hooks/useBudgetData.ts` | Added a `vaultUnlocked` parameter; will not read/write the DB until the vault is unlocked. |
| `src/components/AuthView.tsx` | Bootstraps the vault inline on sign-in/up (setup or unlock), shows the one-time recovery code, adds a "Forgot password?" email flow. |
| `src/App.tsx` | Two-gate flow: Supabase session, then vault unlock. Handles `PASSWORD_RECOVERY`, clears the DEK on sign-out, re-renders on vault lock/unlock. |
| `src/styles.css` | Added recovery-code box styling; made text buttons stack. |
| `SETUP.md` | Documented the encryption model, migration step, and recovery flow. |
| `README.md` | Updated schema and notes to the encrypted, multi-user model. |
| `.env.example` | Replaced a committed real-looking OpenRouter key with a placeholder. |

## Removed files

| File | Reason |
| --- | --- |
| `src/lib/supabase.js` | Empty stray file that shadowed `supabase.ts` and broke the bundler. |

## Database schema

Run [`supabase/encryption-setup.sql`](supabase/encryption-setup.sql) in the Supabase
SQL editor. It adds `user_keys`, the `enc_payload` columns, and RLS policies
(`user_id = auth.uid()`) on every table.

Notes learned while applying it:
- Avoid `DO $$ ... $$` blocks — they cause "cannot insert multiple commands in a
  prepared statement". Use `create unique index if not exists` instead of `add constraint`.
- Run `notify pgrst, 'reload schema';` after DDL or the API reports
  "Could not find the table/column in the schema cache".
- `create table if not exists` is a no-op on a pre-existing (old-schema) table;
  use `alter table ... add column if not exists enc_payload` to retrofit it.

## Action items / caveats

- **Rotate the OpenRouter API key** that was previously committed in `.env.example`.
- **Zero-knowledge tradeoff:** losing both the password and the recovery code makes
  data unrecoverable.
- **Existing plaintext data is not auto-migrated** — only a user's in-browser key can
  encrypt it. Export before migrating if you have real data.
- **AI chat** decrypts data and sends it to OpenRouter (a third party) in cleartext.

## Verification

- `npm run build` — passes (type-check + bundle).
- `npm test` — 15 tests pass (including the new crypto tests).
