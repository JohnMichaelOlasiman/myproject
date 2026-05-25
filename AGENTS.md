# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 16, React 19, TypeScript, Tailwind, and Supabase app. Route files live in `app/`, with feature routes such as `app/login`, `app/register`, `app/dashboard`, `app/admin`, `app/reservation`, and API routes under `app/api`. Shared UI is in `components/`, reusable helpers are in `lib/`, and Supabase client/database utilities are under `lib/supabase`. Static assets belong in `public/`. Database setup and maintenance SQL scripts are in `supabase/`, especially `supabase/schema.sql`.

There is no dedicated test directory yet. Add tests near the feature they cover or under a future `tests/` directory once a test runner is introduced.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start the local Next.js development server at `http://localhost:3000`.
- `npm run build`: create a production build and catch type/build errors.
- `npm start`: run the production build after `npm run build`.
- `npm run lint`: run ESLint across the project.

No `npm test` script is currently configured. Do not document or rely on one until a test framework is added.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Follow the existing two-space indentation style and prefer concise, typed helpers over untyped inline logic. Component files use lowercase kebab-case names such as `admin-shell.tsx`; exported component names should use PascalCase. Route folders should stay lowercase and URL-oriented.

Use Tailwind utility classes where practical and keep route-specific global styling in `app/globals.css`. Run `npm run lint` before submitting changes.

## UI Redesign Requirements

All redesign work is UI-only unless the user explicitly says otherwise. Do not change API routes, Supabase data access, SQL scripts, auth behavior, validation rules, or backend functionality while redesigning pages.

Before changing app visuals, read `DESIGN_SYSTEM.md`, `skills/ccs-sitin-redesign/SKILL.md`, and the relevant Next.js 16 docs in `node_modules/next/dist/docs/`. Hallmark is installed at `.agents/skills/hallmark`; use it for anti-AI-slop audits and redesign checks. The required direction is light-first Campus Ops: shared student/admin design system, role-aware density, ink neutrals, restrained plum/gold CCS accents, Fraunces display type, and IBM Plex Sans body type.

## Testing Guidelines

When adding tests, choose a runner deliberately and add the matching npm script. Prefer names that identify behavior, such as `reservation-form.test.tsx` or `sit-in-metrics.test.ts`. Cover Supabase data transformations, role-sensitive flows, and login/register behavior first because those affect core access paths.

## Commit & Pull Request Guidelines

Recent history uses short imperative summaries, sometimes with a conventional prefix, for example `fix: implement ID resolution...` and `Add leaderboard auto-refresh...`. Keep commits focused and describe the user-visible or technical outcome.

Pull requests should include a brief summary, validation steps such as `npm run lint` and `npm run build`, linked issues when applicable, and screenshots for UI changes.

## Security & Configuration Tips

Keep Supabase keys in `.env` or `.env.local`; never commit real secrets. Required public variables are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Before changing Next.js APIs or routing conventions, read the relevant guide in `node_modules/next/dist/docs/` because this project uses Next.js 16.
