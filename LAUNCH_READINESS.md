# PaceMint First-User Launch Checklist

## Code gates

- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- Deploy a preview and smoke-test signup, unlock, monthly mode, statement mode, feedback, AI chat, export, recovery, and account deletion.

## Required production configuration

- Apply `supabase/migrations/202606190001_multi_user_hardening.sql` and run `supabase/verify-production.sql`.
- Run `npm run verify:isolation` against staging with two temporary users.
- Require email confirmation and configure production SMTP in Supabase Auth.
- Configure Cloudflare Turnstile in Supabase Auth and set both `VITE_TURNSTILE_SITE_KEY` and server-only `TURNSTILE_SECRET_KEY` in Vercel.
- Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`; the service-role key is required for self-service account deletion.
- Configure Vercel rate limits for `/api/chat` and `/api/feedback` and enable usage alerts.
- Confirm database backups and test one restore before calling the product generally available.

## Initial operating envelope

Launch as an early-access beta to a small cohort first. The frontend and Supabase RLS model isolate users, calendar-bucket indexes prevent cross-user scans, and AI requests have per-account quotas. Capacity is still bounded by the selected Supabase, Vercel, Web3Forms, and OpenRouter plans. Monitor Auth failures, database connections/storage, function errors and duration, AI 429 responses, and feedback delivery as the cohort grows.

## First-user acquisition sequence

1. Recruit 10–20 people who already budget manually or around a card statement. Personally onboard them and watch where setup fails.
2. Ask each active user for one introduction to someone with the same budgeting habit. Optimize activation before broad promotion.
3. Publish short demonstrations of statement-cycle budgeting and privacy architecture. Use the product’s differentiator, not generic “AI budgeting” language.
4. Share a transparent build story in founder and personal-finance communities only where self-promotion is allowed; ask for workflow feedback rather than votes.
5. Buy a custom domain before submitting to startup directories. BetaList explicitly rejects free hosting subdomains.
6. Use a larger launch directory only after onboarding, recovery, deletion, and support have been exercised by the private cohort.
