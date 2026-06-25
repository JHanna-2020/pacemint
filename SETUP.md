# Budget Tracker Setup

Use this guide to set up PaceMint locally and start development.

## Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project with the existing budget tables and RLS policies
- Optional: an OpenRouter API key for the AI chat feature

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Environment Variables

Create a local env file:

```bash
cp .env.example .env.local
```

Fill in the Supabase values:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

For AI chat, also add:

```bash
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=openrouter/free
OPENROUTER_SITE_URL=http://localhost:5173
OPENROUTER_APP_NAME=PaceMint
```

Do not prefix `OPENROUTER_API_KEY` with `VITE_`. It must stay server-side.

## 3. Start Local Development

Start the Vite app:

```bash
npm run dev
```

Start the local chat API in a second terminal:

```bash
npm run server
```

Open the Vite URL shown in the terminal, usually:

```txt
http://localhost:5173/
```

If port `5173` is busy, Vite may use `5174` or another port.

## 4. Supabase Requirements

For a brand-new empty Supabase project, first run
`supabase/bootstrap-blank-project.sql`. The app expects these tables to exist:

- `user_settings`
- `budget_categories`
- `expenses`
- `recurring_expenses`
- `one_time_income`
- `user_keys` (added for encryption — see below)

The app does not run migrations. It assumes RLS policies already restrict rows by:

```sql
user_id = auth.uid()
```

### Run the encryption migration

Open the Supabase SQL editor and run [`supabase/encryption-setup.sql`](supabase/encryption-setup.sql).
It creates the `user_keys` and `one_time_income` tables and converts the data
tables to store sensitive fields inside an encrypted `enc_payload` column.

> The migration **drops the old plaintext columns**. If you already have real
> data, export it from the previous app version first, then re-import after
> migrating (Settings → Import and export).

## 4b. Encryption Model (zero-knowledge)

Each account's budget data is end-to-end encrypted in the browser before it
reaches Supabase. The database only ever stores ciphertext.

- A random 256-bit **Data Encryption Key (DEK)** encrypts all data (AES-256-GCM).
- The DEK is wrapped (encrypted) twice and stored in `user_keys`:
  - by a key derived from the account **password** (PBKDF2-SHA256, 600k iterations)
  - by a key derived from a one-time **recovery code** shown at sign-up
- The plaintext DEK lives only in browser memory. A page refresh shows an
  **Unlock** screen that re-derives it from the password.

**Forgot password:** use “Forgot password?” on sign-in to get a Supabase reset
email. After setting a new password you’ll be asked for your **recovery code**
to decrypt and re-encrypt your data under the new password.

**Important:** if a user forgets their password *and* loses their recovery code,
their data is unrecoverable. This is inherent to zero-knowledge encryption.

Relevant code:

- Crypto primitives: `src/lib/crypto.ts`
- Key/DEK lifecycle + `user_keys` access: `src/lib/encryptionSession.ts`
- Encrypt/decrypt on read/write: `src/services/budgetRepository.ts`
- Unlock / recovery UI: `src/components/VaultGate.tsx`, `src/components/ResetPasswordView.tsx`

## 5. Useful Commands

```bash
npm run dev       # Start frontend
npm run server    # Start local OpenRouter chat API
npm test          # Run unit tests
npm run build     # Type-check and build production assets
npm run preview   # Preview production build locally
```

## 6. Vercel Deployment

Vercel uses:

- Build command: `npm run build`
- Output directory: `dist`
- Serverless chat API: `api/chat.js`

Set these environment variables in Vercel:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free
OPENROUTER_SITE_URL=https://ledgerline-budget.vercel.app
OPENROUTER_APP_NAME=PaceMint
```

You can omit `VITE_CHAT_API_URL` on Vercel. The frontend automatically calls `/api/chat`.

## 7. Where To Work

- Main app shell: `src/App.tsx`
- Budget data hook: `src/hooks/useBudgetData.ts`
- Supabase data access: `src/services/budgetRepository.ts`
- Budget math: `src/lib/budgetMath.ts`
- Auto allocation logic: `src/lib/autoAllocate.ts`
- OpenRouter server logic: `server/chatService.js`
- Vercel chat route: `api/chat.js`
- Styling: `src/styles.css`

## 8. Safety Notes

- Never commit `.env.local`.
- Never expose `OPENROUTER_API_KEY` in frontend code.
- Keep database table and column names compatible with the existing Supabase schema.
- Run `npm test` and `npm run build` before deploying.
