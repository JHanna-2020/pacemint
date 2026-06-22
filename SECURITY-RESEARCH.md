# Independent-Account Production Research

Research reviewed June 19, 2026. This document records the production decisions behind the implementation rather than relying on dashboard defaults or assumptions.

## Database authorization

Supabase states that RLS must be enabled for tables in exposed schemas and recommends owner checks using `(select auth.uid()) = user_id`, explicit `to authenticated` roles, and both `using` and `with check` for updates. PostgreSQL permissive policies combine with OR, so the migration removes stale policies before creating one owner-only policy per account table.

Source: https://supabase.com/docs/guides/database/postgres/row-level-security

The migration also adds a staging isolation test that creates two real Auth users and proves that the second user cannot select, update, or delete the first user's row.

## Multi-factor authentication

Supabase MFA supports TOTP enrollment and exposes the `aal` claim for authorization. The app now challenges enrolled users before vault access, and RLS calls `mfa_requirement_met()`: accounts without a verified factor may use AAL1; accounts with a verified factor require AAL2 for financial rows.

Source: https://supabase.com/docs/guides/auth/auth-mfa

## Passwords, email, and bot protection

Supabase recommends at least eight characters, stronger character policies, and leaked-password rejection. PaceMint uses a 12-character UI minimum for new passwords while retaining compatibility for existing sign-ins. Password changes re-wrap the client-side data key and roll it back if the Auth update fails.

Source: https://supabase.com/docs/guides/auth/password-security

Supabase supports CAPTCHA tokens on signup, sign-in, and reset. Cloudflare recommends explicit Turnstile rendering for SPAs and requires server-side validation; Supabase performs that validation after Turnstile is enabled in the Auth dashboard. The widget is activated only when `VITE_TURNSTILE_SITE_KEY` is configured.

Sources:

- https://supabase.com/docs/guides/auth/auth-captcha
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/

Supabase's built-in SMTP is explicitly non-production and may only deliver to team addresses. Production requires custom SMTP and reviewed email rate limits.

Source: https://supabase.com/docs/guides/auth/auth-smtp

## AI endpoint authorization and quotas

The browser now sends its Supabase access token to `/api/chat`; the server validates it with `auth.getUser()` rather than trusting decoded client claims. An atomic PostgreSQL function limits daily requests per user. Vercel WAF should additionally rate-limit by source IP to absorb unauthenticated floods before function execution.

Sources:

- https://supabase.com/docs/guides/auth/jwts
- https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting

Budget context remains bounded before it reaches OpenRouter: message length, request bytes, history, categories, and recent transactions are capped. Logs must never include this context.

## Query growth and concurrency

Encrypting exact transaction dates previously forced the browser to download every historical row. A plaintext `YYYY-MM` month bucket reveals only coarse timing while preserving encrypted descriptions, amounts, categories, and exact dates. Compound indexes support account/month queries. Legacy null buckets are backfilled only after successful client decryption.

A unique `(user_id, recurring_id, month_key)` index plus conflict-safe upsert prevents two tabs from generating duplicate recurring occurrences.

## Account deletion

Supabase's Auth admin deletion requires a service-role key and must run only on a server. PaceMint requires a recently issued JWT, password confirmation, MFA when enrolled, explicit `DELETE` confirmation, database cleanup, and then Auth identity deletion. The service-role key is never exposed through a `VITE_` variable.

Source: https://supabase.com/docs/reference/javascript/auth-admin-deleteuser

## Backups and recovery

Supabase documents daily backups for paid plans and recommends external logical backups for free projects. Production readiness includes a restore drill, not merely confirming that backups exist.

Source: https://supabase.com/docs/guides/platform/backups

## Platform limits and headers

Vercel Functions have plan-specific duration and payload limits. The chat function is bounded to 120 seconds in repository configuration, while the application performs stricter payload validation. Security headers deny framing, MIME sniffing, unnecessary browser capabilities, and unlisted script/connect origins.

Source: https://vercel.com/docs/functions/limitations/
