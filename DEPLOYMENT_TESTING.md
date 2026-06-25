# PaceMint Deployment Testing Guide

## Deployment under test

- Stable URL: https://ledgerline-budget.vercel.app

If testing a specific generated Vercel deployment URL, use the URL from the latest deploy output. Verify that the stable alias matches before sharing it publicly.

Use a disposable account and fake financial data. Do not use a real card number, bank login, password used elsewhere, or real financial export.

## 1. Automated release checks

From `/Users/john/Documents/Codex_budget`:

```bash
npm test
npm run build
npm audit --omit=dev
```

Expected results:

- 34 tests pass.
- The Vite production build completes.
- The production dependency audit reports zero known vulnerabilities.

## 2. Landing page

Open the deployment in a private browser window and verify:

- The PaceMint favicon appears.
- The page clearly explains monthly and statement-cycle budgeting.
- `Create a free account` opens the signup form.
- `Sign in` opens the signin form.
- `How it works` scrolls to the correct section.
- Light and dark themes render correctly.
- Privacy, Terms, Support, Feedback, Data deletion, and AI disclosure pages open.
- No text overlaps or horizontal scrolling occurs at desktop, tablet, and mobile widths.

Recommended viewport checks:

- Desktop: `1440 × 900`
- Tablet: `768 × 1024`
- Mobile: `390 × 844`

## 3. Redesigned application menu

After signing in and unlocking the vault, verify the header:

- Dashboard, Budget, and Settings remain visible as primary navigation.
- The period button shows the current mode and period label.
- Clicking the period button opens the budget-period menu.
- Clicking outside the menu closes it.
- Pressing Escape closes it.
- Previous and next controls change the selected period.
- Monthly mode displays a month picker.
- Statement mode displays the selected custom profile and inclusive date range.
- `Manage statement profiles` opens the Budget page.
- The three-dot menu contains Refresh, theme selection, Feedback, and Sign out.
- Every action closes the menu after selection.
- The header becomes a clean two-row layout on tablet and mobile instead of overflowing.

## 4. Signup, encryption, and recovery

Create a disposable account and verify:

1. Turnstile appears if the production keys are configured.
2. Email confirmation arrives if confirmation is enabled in Supabase.
3. PaceMint presents a recovery code after account setup.
4. Refreshing the browser locks the encrypted vault.
5. The password unlocks the vault.
6. An incorrect password or recovery code cannot decrypt the data.
7. Password recovery plus the correct recovery code restores access.

## 5. Monthly budget mode

Create this test plan:

```text
Income: $3,000
Budget: $1,500
Savings target: $500
```

Verify:

- Spendable cash is capped at `$1,500`.
- Adding an expense updates spent, remaining, daily pace, categories, and charts.
- One-time income updates income without raising spending above the configured budget cap.
- Unassigned and profile-assigned expenses both appear in Monthly mode.
- Expense editing, deletion, category limits, recurring expenses, and auto-allocation work.
- Previous and next months load only their applicable activity.

## 6. Statement-cycle mode

Go to **Budget → Statement profiles** and create:

```text
Custom name: Main card
Closing day: 15
Statement budget: $900
```

Verify:

- PaceMint asks only for a custom name, closing day, and budget.
- It never requests an issuer, card number, account number, expiration date, or security code.
- Statement mode shows an inclusive range such as `May 16–Jun 15`.
- Previous and next controls move exactly one statement cycle.

Add these expenses:

1. An expense inside the range assigned to `Main card`.
2. An expense inside the range left unassigned.
3. An expense outside the range assigned to `Main card`.

Expected result:

- Statement mode shows only expense 1.
- Monthly mode shows expenses 1 and 2 in their applicable calendar month.
- Expense 3 appears only in its applicable period.

Create a second profile named `Backup card` and verify each profile has isolated expenses, category limits, charts, and statement budgets.

Archive the backup profile and verify it remains available for history but cannot receive new expense assignments.

## 7. Recurring expenses

Create recurring expenses assigned to different profiles and verify:

- Monthly mode includes every applicable recurring instance.
- Statement mode includes only the selected profile’s instances.
- A cycle spanning two calendar months contains the correct dates.
- Repeated refreshes do not generate duplicate expenses.

## 8. AI chat

Verify:

- AI chat works for an authenticated account.
- Monthly questions use only the selected calendar month.
- Statement questions use only the selected statement period and profile-assigned expenses.
- Custom profile names are not included in the AI payload.
- A free-model rate limit produces a clear retry-later message.
- A signed-out request to `/api/chat` returns HTTP `401`.

## 9. Feedback

Open Feedback from the landing page and the signed-in menu.

Verify:

- Empty submissions are rejected.
- Turnstile appears when configured.
- A valid submission reaches `hannagonjohn@gmail.com`.
- The browser sends feedback to `/api/feedback`, not directly to Web3Forms.
- The Web3Forms access key is not present in the browser payload.
- A successful confirmation appears.

## 10. Export and import

Export the workbook and verify it contains:

- Settings
- Statement Profiles
- Transactions
- Category Budgets
- Recurring Expenses
- One-Time Income

Confirm it contains only custom profile names and settings—never real card details.

Use a second disposable account to test importing a legacy JSON backup. Records without profile assignments should remain unassigned and appear in Monthly mode.

## 11. User isolation

Run this only against a staging Supabase project:

```bash
SUPABASE_URL=... \
SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run verify:isolation
```

Expected output:

```text
PASS: independent-account read, update, and delete isolation verified.
```

## 12. Account deletion

Use a disposable account:

1. Export its data.
2. Open Settings and start account deletion.
3. Complete the recent-signin and confirmation requirements.
4. Confirm the user is signed out.
5. Confirm the deleted account cannot sign in again.
6. Confirm its rows and authentication identity are gone in Supabase.

If PaceMint says deletion is not configured, verify that `SUPABASE_SERVICE_ROLE_KEY` is set in the Vercel Production environment and redeploy.

## 13. Production configuration gate

Confirm these variables exist in Vercel Production:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
VITE_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
WEB3FORMS_ACCESS_KEY
FEEDBACK_TO_EMAIL
OPENROUTER_API_KEY
OPENROUTER_MODEL
OPENROUTER_SITE_URL
OPENROUTER_APP_NAME
AI_DAILY_REQUEST_LIMIT
```

Never prefix service-role, Turnstile-secret, Web3Forms, or OpenRouter keys with `VITE_`.

## 14. Final pass/fail record

Record each test as Pass, Fail, or Blocked:

| Area | Result | Notes |
| --- | --- | --- |
| Landing page |  |  |
| Responsive layout |  |  |
| Header menus |  |  |
| Signup and email confirmation |  |  |
| Vault encryption and recovery |  |  |
| Monthly budgeting |  |  |
| Statement budgeting |  |  |
| Recurring expenses |  |  |
| AI chat |  |  |
| Feedback |  |  |
| Export/import |  |  |
| User isolation |  |  |
| Account deletion |  |  |
| Production monitoring |  |  |

Do not promote the stable URL publicly until every security-sensitive item is Pass or has an explicitly accepted limitation.
