# PaceMint Multi-User Production Handoff

Last updated: June 19, 2026

## Objective

Prepare PaceMint for multiple independent user accounts. Each account must have isolated financial data, authenticated and quota-controlled AI access, hardened authentication, scalable month queries, recoverable encryption, account lifecycle controls, operational checks, and a safe deployment process.

## Critical deployment warning

Do **not** deploy the current local hardening changes before applying the database migration.

The local application now queries `month_key` columns and calls quota/deletion RPC functions that do not exist in the current production database until this migration is applied:

`supabase/migrations/202606190001_multi_user_hardening.sql`

The latest deployment at `https://ledgerline-budget.vercel.app` predates this multi-user hardening work. It includes the earlier UI fixes and Excel export, but not the unfinished hardening changes described here.

## Completed local implementation

### 1. Enforceable multi-user database migration

Created `supabase/migrations/202606190001_multi_user_hardening.sql`.

It adds:

- `month_key` to `expenses` and `one_time_income`.
- Month-key format constraints.
- User/month indexes.
- Unique `(user_id, recurring_id, month_key)` protection against recurring-expense duplicates.
- Removal of stale policies before creating one owner-only policy per financial table.
- RLS enabled and forced on all account-owned tables.
- Explicit `to authenticated`, `using`, and `with check` ownership rules.
- `mfa_requirement_met()` so accounts with verified MFA require an AAL2 session.
- `ai_daily_usage` and atomic `consume_ai_daily_quota()`.
- `delete_current_user_data()` for authenticated account cleanup.

Also created `supabase/verify-production.sql` to inspect RLS, policies, and indexes after migration.

### 2. Month-scoped data loading and recurring concurrency

Updated:

- `src/lib/types.ts`
- `src/services/budgetRepository.ts`

Changes:

- New transactions write a structural `YYYY-MM` month bucket.
- Budget views query only the calendar-month buckets touched by the selected period plus legacy null-bucket rows.
- Legacy rows are backfilled after successful client decryption.
- Transaction and income date edits update `month_key`.
- Recurring expansion uses month-scoped data.
- Recurring inserts use conflict-safe upsert against the unique month constraint.

### 3. Authenticated and quota-controlled AI API

Created:

- `server/supabaseAuth.js`
- `server/supabaseAuth.test.js`

Updated:

- `api/chat.js`
- `server/chatService.js`
- `server/index.js`
- `src/lib/chatContext.ts`

Behavior:

- The browser sends the current Supabase bearer token.
- The server validates it with Supabase Auth `getUser()`.
- The server consumes an atomic per-user daily quota before OpenRouter.
- Missing/expired sessions return 401.
- Exhausted quota returns 429.
- Chat payload bytes, history, categories, recent expenses, and message length are bounded.
- Local CORS now allows the `Authorization` header.

### 4. Auth hardening and Turnstile integration

Created:

- `src/components/TurnstileWidget.tsx`

Updated:

- `src/components/AuthView.tsx`
- `src/components/ResetPasswordView.tsx`
- `src/components/VaultGate.tsx`
- `src/vite-env.d.ts`
- `src/styles.css`

Behavior:

- Turnstile renders only when `VITE_TURNSTILE_SITE_KEY` is configured.
- CAPTCHA tokens are passed to sign-up, sign-in, reset, and destructive reauthentication.
- New passwords use a 12-character UI minimum.
- Existing sign-ins retain six-character compatibility.
- Reset redirects use the current deployment origin rather than a hardcoded domain.

Dashboard configuration is still required before Turnstile enforcement works. See `PRODUCTION.md`.

### 5. MFA enrollment and login challenge

Created:

- `src/components/MfaSettings.tsx`

Updated:

- `src/components/SettingsPanel.tsx`
- `src/components/VaultGate.tsx`
- the database migration

Behavior:

- Users can enroll and verify a TOTP authenticator.
- Enrolled AAL1 sessions are challenged in `VaultGate` before vault access.
- RLS requires AAL2 for users who have a verified factor.
- Users without MFA continue to use AAL1.

This flow still needs real Supabase staging verification.

### 6. Account lifecycle controls

Created:

- `api/delete-account.js`
- `src/components/AccountDeletion.tsx`
- `src/components/AccountSecurity.tsx`

Updated:

- `src/components/SettingsPanel.tsx`
- `src/App.tsx`
- `src/components/LegalPage.tsx`
- `server/supabaseAuth.js`

Behavior:

- Email-change form with confirmation redirect.
- Password-change form re-wraps the encryption key and rolls back wrapping if Supabase Auth rejects the password update.
- Account deletion requires password, CAPTCHA when configured, MFA when enrolled, literal `DELETE`, and a JWT issued within ten minutes.
- Server cleanup removes account data before deleting the Auth identity.
- Service-role key is server-only.

### 7. Operational and security files

Created:

- `PRODUCTION.md`
- `SECURITY-RESEARCH.md`
- `.github/workflows/ci.yml`
- `scripts/verify-user-isolation.mjs`
- `supabase/verify-production.sql`

Updated:

- `vercel.json` with function durations and security headers/CSP.
- `.env.example` with all required client/server variables.
- `package.json` with `check` and `verify:isolation` scripts.

The isolation script creates two temporary staging users and proves User B cannot read, update, or delete User A's row.

### 8. Dependency hardening

Upgraded:

- Vite to 8.0.16.
- Vitest to 4.1.x.
- `@vitejs/plugin-react` to 6.0.2.
- TypeScript to 5.9.x.

Latest completed validation:

- 8 test files passed.
- 26 tests passed.
- Vite 8 production build passed.
- `npm audit` reported zero vulnerabilities.

## First-login encryption race: fixed locally

The previously documented first-login race has now been fixed:

- `AuthView` performs authentication only and no longer owns vault initialization.
- `VaultGate` checks MFA first, then calls `needsEncryptionSetup()`.
- Brand-new and email-confirmed accounts are routed through vault creation.
- The vault password is verified against Supabase Auth before key generation.
- `setupEncryption()` stores a pending DEK instead of immediately opening the dashboard.
- `activatePendingDEK()` activates it only after the user acknowledges saving the one-time recovery code.
- Recovery remains unavailable for accounts that have not created keys yet.

After this fix, all 26 tests pass and the Vite 8 production build succeeds. Real staging tests are still required for immediate-session signup, email confirmation, MFA login, refresh/unlock, and recovery links.

## Additional code review items before deployment

1. Validate the SQL migration in a staging Supabase project.
2. Run `npm run verify:isolation` against staging.
3. Exercise signup confirmation, first vault creation, recovery-code acknowledgement, refresh/unlock, and reset recovery.
4. Exercise MFA enrollment, AAL1/AAL2 transitions, disable flow, and deletion with MFA.
5. Verify the CSP permits Supabase Auth and Turnstile in real browsers.
6. Test account deletion failure behavior if Auth identity deletion fails after financial rows are removed.
7. Confirm legacy null `month_key` backfill succeeds under RLS.
8. Confirm PostgREST resolves the unique upsert target `user_id,recurring_id,month_key`.
9. Add request IDs and metadata-only error logging if an observability provider is selected. Never log financial context or secrets.
10. Consider protecting `/api/feedback` with Turnstile or a separate WAF rule; AI abuse controls are implemented, but public feedback can still be spammed.

## Required external configuration not yet completed

These require account credentials or provider choices and cannot be safely invented in code:

### Supabase

- Back up production.
- Apply the migration.
- Run `supabase/verify-production.sql`.
- Require email confirmation.
- Set production site and redirect URLs.
- Configure 12-character password policy.
- Enable leaked-password protection if the plan supports it.
- Create and enable Cloudflare Turnstile protection.
- Configure production SMTP and disable link tracking.
- Review Auth rate limits.
- Review Security Advisor.
- Confirm backups and run a restore drill.

### Vercel

Current Vercel variables found:

- `WEB3FORMS_ACCESS_KEY`
- OpenRouter variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Still required:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_DAILY_REQUEST_LIMIT`
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_FEEDBACK_EMAIL`
- `FEEDBACK_TO_EMAIL`

`SUPABASE_SERVICE_ROLE_KEY` must never use a `VITE_` prefix.

Create a Vercel WAF rate-limit rule for `POST /api/chat`, initially in Log mode, then enforce after observing legitimate traffic.

### Email and Turnstile providers

- Select/configure SMTP provider: Resend, Postmark, SES, SendGrid, or equivalent.
- Create a Turnstile widget for production and approved local/staging hostnames.

## Safe continuation plan

1. Run all local validation after any further edits.
2. Back up and migrate a staging Supabase project.
3. Run SQL verification and the two-user isolation script.
4. Configure staging environment variables, SMTP, Turnstile, and Auth settings.
5. Deploy a Vercel preview and complete the smoke-test list in `PRODUCTION.md`.
6. Back up production and apply the migration.
7. Add production Vercel secrets.
8. Deploy production.
9. Verify both `ledgerline-budget.vercel.app` and its project aliases point to the intended deployment.

## Research sources

Detailed decisions and links are in `SECURITY-RESEARCH.md`. Primary sources include Supabase RLS/Auth/MFA/SMTP/backups documentation, Cloudflare Turnstile documentation, and Vercel WAF/function-limit documentation.
