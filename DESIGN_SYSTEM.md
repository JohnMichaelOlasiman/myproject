# CCS Sit-In Design System

## Direction

Use a light-first Campus Ops interface for the CCS Sit-In Monitoring System. The UI should feel like a refined university operations console: structured, calm, trustworthy, and efficient for repeated use. Preserve the existing product behavior while changing layout, styling, hierarchy, and visual language.

## Core Principles

- UI-only redesigns: do not change API routes, Supabase calls, auth behavior, validation rules, schemas, or data contracts.
- Start every page with an audit of primary task, secondary actions, data density, empty/error/loading states, and role context.
- Prefer reusable tokens and primitives over one-off page styling.
- Use the CCS logo as institutional context, not as a reason to flood the UI with purple and gold.
- Design admin pages for scanning, filtering, comparison, and bulk action. Design student pages for clarity, guidance, and task completion.

## Visual Tokens

- Background: warm off-white or cool neutral surfaces, not flat gray blocks.
- Text: deep ink for body, softened slate for secondary metadata.
- Primary accent: restrained muted plum derived from the CCS logo.
- Secondary accent: warm gold used sparingly for emphasis, awards, rank, or institutional marks.
- Status colors: semantic green, amber, red, and blue; keep them functional and consistent.
- Radius: compact, usually 6-8px for cards and controls.
- Shadows: subtle elevation only for overlays, menus, and important raised panels.

Use OKLCH or well-balanced Tailwind-compatible tokens when implementing the palette. Avoid a one-note purple, beige, slate, or blue theme.

## Typography

- Display: Fraunces for page titles, major section headings, and auth/editorial moments.
- Body/UI: IBM Plex Sans for navigation, tables, forms, labels, and dense operational content.
- Do not scale font size with viewport width.
- Keep letter spacing at `0` unless a small uppercase label genuinely needs tracking.

## Layout Patterns

- Shared shell system for student and admin, with role-aware density.
- Admin: denser tables, compact filters, persistent navigation, clear row actions, and strong scan lines.
- Student: calmer spacing, guided forms, clear next actions, and simplified summaries.
- Auth: visually distinct but still part of the same system; avoid generic split-card SaaS patterns.
- Use asymmetric but balanced compositions where useful. Avoid centered-everything layouts.

## Component Rules

- Build or reuse primitives for buttons, fields, select controls, tabs, badges, tables, dialogs, cards, menus, and alerts.
- Prefer lucide icons for redesigned actions once `lucide-react` is installed.
- Keep buttons stable in size and label wrapping.
- Cards are for grouped content or repeated items; do not nest cards inside cards.
- Tables must remain readable on mobile with intentional overflow or responsive restructuring.

## Anti-Slop Checklist

Before finishing any redesigned page, confirm:

- The page no longer looks like a generic AI dashboard or template.
- The layout reflects the actual user task and role.
- Colors are not dominated by one hue family.
- Typography has clear hierarchy and uses the approved pairing.
- Empty, loading, error, and success states still exist where the original page had them.
- All original handlers, links, route behavior, Supabase calls, and form submissions are preserved.
- `npm run lint` and `npm run build` pass.
