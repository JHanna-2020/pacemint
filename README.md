# PaceMint

A private, multi-user personal budgeting dashboard built with Vite, React, TypeScript, and Supabase Auth/Postgres. Each account's budget data is **end-to-end encrypted** in the browser — the database only ever stores ciphertext.

## Supabase setup

The app does not run migrations automatically. For a blank Supabase project, run [`supabase/bootstrap-blank-project.sql`](supabase/bootstrap-blank-project.sql), then [`supabase/encryption-setup.sql`](supabase/encryption-setup.sql), then every file in `supabase/migrations/` in filename order.

Tables store only structural columns (`id`, `user_id`, `recurring_id`, timestamps) plus a single encrypted `enc_payload` column that holds every sensitive field:

- `user_settings(user_id, enc_payload, updated_at)`
- `budget_categories(id, user_id, enc_payload, updated_at)`
- `expenses(id, user_id, recurring_id, enc_payload, created_at)`
- `recurring_expenses(id, user_id, enc_payload, created_at)`
- `one_time_income(id, user_id, enc_payload, created_at)`
- `user_keys(user_id, kdf_salt, kdf_iterations, recovery_salt, wrapped_dek_password, wrapped_dek_recovery, ...)`

All tables use RLS scoped by `user_id = auth.uid()`, so each user only sees their own rows. See [`SETUP.md`](SETUP.md) for the full encryption model and migration notes.

> Applying SQL in the Supabase SQL editor: run statements individually if you hit
> "cannot insert multiple commands in a prepared statement", and run
> `notify pgrst, 'reload schema';` after DDL so the API sees the new columns.

Required env vars:

```bash
cp .env.example .env
```

Then fill in:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_TURNSTILE_SITE_KEY=...
VITE_CHAT_API_URL=http://localhost:3001/api/chat
VITE_FEEDBACK_EMAIL=hannagonjohn@gmail.com

TURNSTILE_SECRET_KEY=...
WEB3FORMS_ACCESS_KEY=...
FEEDBACK_TO_EMAIL=hannagonjohn@gmail.com
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free
OPENROUTER_SITE_URL=http://localhost:5173
OPENROUTER_APP_NAME=PaceMint
AI_DAILY_REQUEST_LIMIT=20
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

Run the OpenRouter chat API in a second terminal:

```bash
npm run server
```

The OpenRouter API key is only read by the Node server. Do not put it in a `VITE_` variable.

The chatbot defaults to a free OpenRouter model. If that free model is rate-limited, the UI will ask the user to come back later for the chat feature.

## Deploy to Vercel

This project is ready for Vercel. The frontend builds to `dist`, and the OpenRouter chatbot runs through the serverless function at `api/chat.js`.

1. Push this project to GitHub.
2. In Vercel, choose **Add New Project** and import the repo.
3. Use the default Vite settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add these Vercel environment variables:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_TURNSTILE_SITE_KEY=...
VITE_FEEDBACK_EMAIL=hannagonjohn@gmail.com
TURNSTILE_SECRET_KEY=...
WEB3FORMS_ACCESS_KEY=...
FEEDBACK_TO_EMAIL=hannagonjohn@gmail.com
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free
OPENROUTER_SITE_URL=https://ledgerline-budget.vercel.app
OPENROUTER_APP_NAME=PaceMint
AI_DAILY_REQUEST_LIMIT=20
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Do not add `OPENROUTER_API_KEY` with a `VITE_` prefix. It must stay server-side.

For automatic feedback emails, create a free Web3Forms access key and add it as `WEB3FORMS_ACCESS_KEY`. The frontend posts to `/api/feedback`; the serverless function sends the message to Web3Forms and shows an in-app confirmation after it succeeds.

You can omit `VITE_CHAT_API_URL` on Vercel. In production, the app automatically calls `/api/chat`.

## Verify

```bash
npm test
npm run build
```

## Notes

- Authentication uses Supabase email/password auth. Data isolation between users is enforced by RLS (`user_id = auth.uid()`) and by per-user encryption keys.
- **Encryption:** a random Data Encryption Key (DEK) encrypts all budget data (AES-256-GCM). The DEK is wrapped by a key derived from the password and by a key derived from a one-time recovery code shown at sign-up, both stored in `user_keys`. The plaintext DEK lives only in browser memory — a refresh shows an Unlock screen.
- **Forgot password:** the email reset link sets a new password; the user then restores their data with the recovery code, which re-encrypts the DEK under the new password. Losing both password and recovery code makes the data unrecoverable (inherent to zero-knowledge).
- Because sensitive fields are encrypted, exact period/card filtering, sorting, and category uniqueness are completed client-side after querying the relevant structural calendar-month buckets.
- The app maps the database's snake_case rows into camelCase domain objects internally; the repository (`src/services/budgetRepository.ts`) is the only encrypt/decrypt boundary.
- Users can switch between calendar-month budgets and encrypted custom statement profiles. Profiles store only a custom name, closing day, statement budget, archive state, and internal ID—never card account details.
- Recurring templates are expanded into each calendar month touched by the selected period and deduped by `recurring_id` plus month.
- One-time income is period-scoped and added to the displayed income total without automatically changing category budgets.
- Import/export uses plaintext JSON shaped around the domain objects. The export is the user's decrypted backup; imports are scoped to the signed-in user and re-encrypted on write.
- AI chat is read-only. It decrypts selected-period summaries and recent expenses and sends them to the chat API (a third party, OpenRouter), which means that data leaves the browser in cleartext.
- Auto allocation uses the previous three matching periods plus recurring templates to recommend category limits. Statement-mode limits are scoped to the selected custom profile.
