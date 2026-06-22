# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PaceMint — a private personal budgeting dashboard. Vite + React + TypeScript frontend, Supabase (Auth + Postgres) backend, and an OpenRouter-backed AI chat that runs through a small Node server locally and a Vercel serverless function in production. Budget data is **end-to-end encrypted** in the browser; the database only ever stores ciphertext.

## Commands

```bash
npm run dev        # Vite frontend (host 0.0.0.0). Picks 5173, hops to 5174/5175 if busy.
npm run server     # Local OpenRouter chat API on :3001 (run in a second terminal)
npm test           # Vitest, run once
npm run build      # tsc -b (type-check, no emit) THEN vite build -> dist/
npm run preview    # Serve the production build
```

Run a single test file or test:

```bash
npx vitest run src/lib/crypto.test.ts
npx vitest run -t "round-trips an encrypted JSON payload"
```

There is no linter configured; `tsc -b` is the type gate (run it after edits — it's fast and catches most issues).

## Environment

`VITE_*` vars are public (bundled into the client). `OPENROUTER_API_KEY` is server-only — never prefix it with `VITE_`. The local Node server reads `.env` then `.env.local` itself (see `server/index.js`); Vite reads `.env.local` for the frontend. `.env.example` must contain placeholders only.

## Architecture

### Encryption is the defining constraint

Everything about data access flows through a zero-knowledge encryption layer. Understand this before touching the data path:

- `src/lib/crypto.ts` — Web Crypto primitives. AES-256-GCM for data; PBKDF2-SHA256 (600k iters) for key derivation. Envelope encryption: a random **DEK** encrypts all data; the DEK is wrapped by a password-derived key and by a recovery-code-derived key.
- `src/lib/encryptionSession.ts` — owns the DEK lifecycle and the `user_keys` table (setup, unlock, recover, password change, recovery-code rotation). The **plaintext DEK lives only in module memory** and is exposed via `getDEK()`. A `subscribeVault`/`emit` mechanism lets React re-render on lock/unlock. There is no React context for this — it's a module singleton.
- `src/services/budgetRepository.ts` — the only place that talks to Supabase data tables. Every sensitive field is encrypted into a single `enc_payload` column per row and decrypted on read via `getDEK()`. Domain objects (camelCase, e.g. `Expense`) are unchanged from before encryption; only the row shapes and this layer changed.

Consequence: **the database cannot filter, sort, or enforce uniqueness on encrypted fields.** So the repository fetches all of a user's rows and does month-filtering, sorting, and category-uniqueness **client-side**. Rows missing `enc_payload` are skipped (`withPayload`) so one legacy/corrupt row can't break a load.

### Auth + vault gating (App.tsx)

The app has two gates in sequence:

1. **Supabase session** — `AuthView` (sign in / sign up / forgot-password email). On a fresh account, sign-in/up calls `setupEncryption` and shows the one-time recovery code; otherwise it calls `unlockWithPassword` inline so the user isn't prompted twice.
2. **Vault unlocked** — even with a valid session, the DEK is memory-only and gone after a refresh. `App` renders `VaultGate` whenever `session && !hasDEK()` (re-prompt for password, or restore via recovery code). A Supabase `PASSWORD_RECOVERY` event routes to `ResetPasswordView`, which sets a new password *and* re-encrypts the vault under it using the recovery code in one step. `SIGNED_OUT` calls `clearDEK()`.

`useBudgetData(session, monthKey, vaultUnlocked)` must receive `vaultUnlocked` (`hasDEK()`) — it will not touch the DB until the vault is unlocked, otherwise every decrypt throws "vault is locked".

### Data flow

`App` → `useBudgetData` (owns load/refresh + all mutations, recomputes derived state) → `budgetRepository` (encrypt/decrypt) → `supabase`. Pure calculation lives in `src/lib/`: `budgetMath.ts` (summary/category/trend — **all math is done in integer cents** via `money.ts` to avoid float drift), `autoAllocate.ts`, `date.ts` (month keys `YYYY-MM`, bounds, recurring day mapping).

### AI chat

`BudgetChat` posts a read-only monthly summary + recent expenses (built by `src/lib/chatContext.ts`) to the chat API. Both `server/index.js` (local) and `api/chat.js` (Vercel) are thin wrappers over `server/chatService.js`, which calls OpenRouter. The frontend hits `VITE_CHAT_API_URL` locally and `/api/chat` in production. Note: this decrypts data and sends it to a third party — keep that in mind for any privacy-sensitive change.

## Database schema

The app does **not** run migrations. Schema lives in `supabase/encryption-setup.sql`. Data tables (`user_settings`, `budget_categories`, `expenses`, `recurring_expenses`) hold only structural columns (`id`, `user_id`, `recurring_id`, timestamps) plus `enc_payload text`. `user_keys` stores per-user wrapped DEKs, salts, and iteration count. All tables use RLS scoped by `user_id = auth.uid()` for multi-tenant isolation.

Gotchas when applying SQL in the Supabase SQL editor:
- Dollar-quoted `DO $$ ... $$` blocks trigger "cannot insert multiple commands into a prepared statement" — avoid them (use `create unique index if not exists` instead of `add constraint`).
- After DDL, run `notify pgrst, 'reload schema';` or the API returns "Could not find the table/column in the schema cache".
- `create table if not exists` is a no-op on a pre-existing (old-schema) table — use `alter table ... add column if not exists enc_payload` to retrofit.

Note: `README.md` documents the pre-encryption plaintext schema and is out of date on the data model; `SETUP.md` and `supabase/encryption-setup.sql` are authoritative for encryption.

## Conventions

- DB rows are snake_case; internal domain objects are camelCase. The repository is the only translation boundary.
- Money: store/compute in cents (`money.ts`), present as decimals.
- Recurring templates are expanded into each calendar month touched by the selected period and deduped by `recurring_id` + month.
