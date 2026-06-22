# PaceMint Production Runbook

## Required deployment order

1. Back up the Supabase project.
2. Apply `supabase/migrations/202606190001_multi_user_hardening.sql`.
3. Run `supabase/verify-production.sql` and confirm RLS is enabled and forced.
4. Run `npm run verify:isolation` against a staging Supabase project.
5. Configure the environment variables below.
6. Run `npm run check`, deploy a Vercel preview, smoke-test, then promote production.

## Supabase dashboard configuration

- Authentication > Providers > Email: require email confirmation.
- Authentication > URL Configuration: set the production site URL and allow only required preview/localhost redirects.
- Authentication > Password Security: require at least 12 characters and enable leaked-password protection when the plan supports it.
- Authentication > Bot and Abuse Protection: enable Cloudflare Turnstile using the same site key configured in Vercel.
- Authentication > SMTP: configure a production provider such as Resend, Postmark, SES, or SendGrid. Disable link tracking.
- Authentication > Rate Limits: review signup, login, and email limits against expected traffic.
- Database > Security Advisor: resolve all exposed-table and RLS findings.
- Database > Backups: confirm daily backups; document and test a restore. Use PITR if the recovery objective requires it.

## Vercel environment variables

- Client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`.
- Server: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`.
- AI: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`, `AI_DAILY_REQUEST_LIMIT`.
- Feedback: `WEB3FORMS_ACCESS_KEY`, `FEEDBACK_TO_EMAIL`, `VITE_FEEDBACK_EMAIL`.

Never prefix the service-role or OpenRouter keys with `VITE_`. Apply secrets to Preview and Production deliberately, then redeploy.

## Vercel firewall

Create a rate-limit rule for path `/api/chat`, method `POST`, keyed by IP. Start in Log mode, inspect legitimate traffic, then enforce a conservative fixed-window limit. The database separately enforces a per-account daily allowance.

## Monitoring without financial data

- Alert on Vercel 5xx rates and function duration for `/api/chat` and `/api/delete-account`.
- Alert on Supabase database size, connection usage, and Auth failures.
- Log request IDs, status codes, durations, and stable error codes only. Never log chat messages, budget context, encrypted payloads, passwords, recovery codes, access tokens, or exports.
- Run a monthly restore drill and the staging isolation test before schema releases.

## Release smoke test

- Create two confirmed staging users and run `npm run verify:isolation`.
- Verify signup confirmation, password reset, recovery-code restoration, MFA enrollment/login, and account deletion.
- Confirm `/api/chat` returns 401 without a token, works with a valid session, and returns 429 after quota exhaustion.
- Confirm period changes only load the selected inclusive range and concurrent refreshes do not duplicate recurring expenses.
