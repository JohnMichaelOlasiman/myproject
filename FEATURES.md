# Current Project Features

This project is a CCS Sit-In Monitoring System built with Next.js, React, Tailwind CSS, and Supabase. It supports separate student and admin workspaces backed by Supabase Auth, public database tables, RLS policies, and a small set of service-role API routes.

## Authentication & Accounts

- Root route `/` redirects to `/login`.
- `/login` and `/register` share the same authentication experience.
- Students can register with ID number, name, course, year level, email, username, and password.
- Login accepts an ID number, email, or username, then resolves the account email before signing in.
- Login redirects users based on profile role: admins go to `/admin/dashboard`, students go to `/dashboard`.
- Profiles can update personal details, avatar data, email, username, course, level, and password.
- Shared student/admin shells include profile menus, logout, notifications, and notification read states.

## Student Portal

- Dashboard shows sessions left, accumulated points, recent announcements, and a 7-day lab usage chart.
- Announcements page supports search, sorting, attachment links, and student comments.
- Rules pages expose sit-in rules at `/sitin` and laboratory rules at `/laboratory`.
- History page lists the student's sit-in records with search, course/level filters, sorting, entry limits, CSV export, XLS export, and feedback submission.
- Lab Schedule page displays lab availability across configured labs and weekdays.
- Reservations page lets students reserve available lab PCs by lab, date, time, and purpose, then view reservation status history.
- Leaderboard ranks students using points, hours spent, and completed tasks.
- Resources page lets students browse folders/files, search resources, preview metadata, and open/download resources when a `storage_url` exists.

## Admin Console

- Dashboard shows total students, active sit-ins, approved reservations, and completed sit-ins.
- Analytics summarizes sit-in volume by purpose, lab, and recent daily activity.
- Student Records supports creating, editing, deleting, searching, filtering, sorting, session reset, CSV export, and XLS export for student accounts.
- Global admin search routes to `/admin/search-results`, where admins can find students and create sit-in records.
- Reservations page separates pending and processed reservations, supports search/filter/sort, and lets admins approve or decline requests.
- Current Sit-In page lists active sit-ins and lets admins time out a student session.
- Sit-In Records page lists completed sit-ins with search, purpose filter, lab filter, and entry limits.
- Rewards page finalizes completed sit-ins, assigns points, records task completion, updates student totals, and unlocks bonus sessions every three points.
- Announcements page lets admins create, edit, delete, search, sort, and comment on announcements. Creating an announcement notifies students.
- Feedback Report lists student feedback with search, sorting, entry limits, CSV export, and XLS export.
- Generate Reports page exports completed sit-in records with search, date range, purpose, lab, CSV, and XLS controls.
- Leaderboard page shows the same score-based student ranking for admins.
- Resources page manages resource folders and file metadata, including create folder, metadata entry from selected files, rename, delete, preview, and download/open when a URL exists.
- Computer & Lab page manages lab computer availability, bulk PC status updates, and lab schedule slots.
- Admin Profile page supports admin profile and password updates.

## Backend APIs

- `POST /api/admin/users` creates Supabase Auth users with confirmed email and upserts the matching student profile.
- `PUT /api/admin/users/[id]` updates a student's Auth email/password and profile fields.
- `DELETE /api/admin/users/[id]` deletes the Auth user and profile row.
- `POST /api/auth/confirm-email` confirms an existing user's email through the Supabase admin API.
- Service-role API routes require `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Data Model & Configuration

- Supabase schema includes profiles, notifications, announcements, announcement comments, resources, reservations, sit-in records, feedback, lab computers, and lab schedules.
- Database functions support login identifier resolution, public leaderboard data, registration conflict checks, role lookup, and admin checks.
- RLS policies allow students to access their own records while admins can manage system-wide records.
- Code-defined dropdown options currently include courses `BSIT`, `BSCS`, `ACT`; year levels `1` to `4`; labs `524`, `526`, `528`, `530`, `542`, `544`; and programming/lab purposes from `lib/supabase/constants.ts`.

## Legacy Route Aliases

The app keeps several legacy admin paths as aliases to current pages, including `/admin/adminIndex`, `/admin/student`, `/admin/generate`, `/admin/Cannouncement`, `/admin/current_sit`, `/admin/day_sit`, `/admin/feedbackad`, `/admin/labsched`, `/admin/profilead`, `/admin/reservationad`, `/admin/resourcesad`, and `/admin/search_results`.
