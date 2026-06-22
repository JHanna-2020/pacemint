# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React + TypeScript budgeting app. Core UI lives in `src/components/`, app orchestration in `src/App.tsx`, and shared domain logic in `src/lib/`. Data loading and persistence are handled in `src/hooks/useBudgetData.ts` and `src/services/budgetRepository.ts`. Supabase client setup is in `src/lib/supabase.ts`.

Server-side AI chat code is split between `api/chat.js` for Vercel serverless deployment and `server/` for local Node testing. Supabase setup helpers live in `supabase/`. Built output goes to `dist/` and should not be edited manually.

## Build, Test, and Development Commands

- `npm install`: install project dependencies from `package.json`.
- `npm run dev`: start the local Vite app on a network-accessible host.
- `npm run server`: run the local Node chat server from `server/index.js`.
- `npm run build`: type-check with `tsc -b` and create the production Vite build.
- `npm run preview`: preview the production build locally.
- `npm test`: run the Vitest test suite once.

Install packages by name, for example `npm install @supabase/supabase-js`; do not install from `node_modules/...` paths.

## Coding Style & Naming Conventions

Use TypeScript for app code and keep reusable business logic pure where practical. Components use PascalCase filenames such as `BudgetChat.tsx`; hooks use `useX` naming; library utilities use camelCase exports. Database fields remain snake_case at the Supabase boundary and may be mapped to app-friendly structures internally.

Follow the existing formatting style: two-space indentation, single-purpose components, and concise helper functions. There is no separate lint command configured, so `npm run build` is the primary type and syntax gate.

## Testing Guidelines

Tests use Vitest and sit next to the logic they cover, using `*.test.ts` or `*.test.js`. Prioritize tests for budget math, allocation logic, chat context shaping, encryption helpers, and server chat behavior. Run `npm test` before handing off changes, and run `npm run build` for changes touching React, TypeScript types, Vercel config, or imports.

## Commit & Pull Request Guidelines

This workspace may not include Git history, so use clear imperative commit messages such as `Add budget auto-allocation` or `Fix chat rate-limit copy`. Pull requests should include a short summary, testing performed, relevant screenshots for UI changes, and notes for any required Vercel or Supabase environment variable updates.

## Security & Configuration Tips

Never commit real secrets. Use `.env.example` as the template and keep real values in `.env.local` or Vercel environment variables. Required client vars are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; AI chat also needs `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_SITE_URL`, and `OPENROUTER_APP_NAME`.
