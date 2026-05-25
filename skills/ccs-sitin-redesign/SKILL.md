---
name: ccs-sitin-redesign
description: Redesign CCS Sit-In Monitoring System frontend pages with a strict UI-only workflow. Use when Codex is asked to redesign, restyle, retheme, modernize, audit, or visually improve pages in this Next.js app while preserving all API routes, Supabase behavior, auth flow, data mutations, validation, and backend functionality.
---

# CCS Sit-In Redesign

Use this skill for every UI redesign pass in the CCS Sit-In Monitoring System. The goal is a consistent Campus Ops interface: light-first, operational, structured, data-readable, and distinct from generic AI-generated dashboards.

## Required Context

Before editing UI, read:

- `DESIGN_SYSTEM.md` for visual direction, tokens, layout rules, and anti-slop checks.
- `AGENTS.md` for repository-wide constraints.
- Relevant Next.js 16 docs in `node_modules/next/dist/docs/` before changing app routing, fonts, metadata, layouts, or framework-specific APIs.
- `.agents/skills/hallmark/SKILL.md` when available, then use Hallmark's audit/redesign mindset for anti-AI-slop review.

## Workflow

1. Audit the current page or component.
   - Identify the user role, primary task, secondary actions, data density, loading/error/empty states, and existing behavior hooks.
   - Note Supabase calls, event handlers, router calls, form validation, exported types, and route boundaries that must remain unchanged.

2. Redesign UI only.
   - Change layout, styling, icons, typography, component structure, and presentation.
   - Preserve route paths, API calls, data contracts, auth checks, form submission behavior, and existing business rules.
   - Keep edits inside `app`, `components`, style files, assets, and UI-only package dependencies unless the user explicitly broadens scope.

3. Apply the design system.
   - Use the Campus Ops palette, role-aware density, Fraunces display type, IBM Plex Sans body type, and restrained CCS logo accents.
   - Prefer shared primitives and tokens for buttons, cards, fields, tables, badges, tabs, modals, and shell layout.
   - Use `lucide-react` for new or redesigned action icons once the dependency exists.

4. Run quality checks.
   - Run `npm run lint`.
   - Run `npm run build`.
   - Complete the anti-slop checklist in `DESIGN_SYSTEM.md` before final response.

## Hard Boundaries

Do not edit:

- `app/api/**`
- `lib/supabase/**`
- `supabase/**/*.sql`
- Auth, authorization, database, or API behavior

Do not remove legacy CSS from `public/css` unless a redesigned page no longer references it and lint/build pass afterward.

## Redesign Standards

- Avoid centered hero-card layouts for operational pages.
- Avoid purple-blue gradient dashboards, generic stat tiles, fake decoration, oversized marketing sections, and repetitive cards.
- Keep admin pages denser for scanning and bulk work.
- Keep student pages calmer, guided, and task-focused.
- Make mobile layouts functional, not just stacked desktop panels.
- Use real page data and existing UI states; never add fake stats or placeholder workflows.
