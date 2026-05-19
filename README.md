# TempSysArch Frontend (Next.js + TypeScript + Tailwind + Supabase)

This project is a Next.js migration of TempSysArch frontend pages (login/register, student, and admin views) backed by Supabase.

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and set values from your Supabase project:

```bash
cp .env.example .env.local
```

Required:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Legacy fallback also supported:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3. Create database schema in Supabase

Open your Supabase project SQL Editor and run:

`supabase/schema.sql`

You can re-run this script safely. It also backfills missing `profiles` rows for existing auth users.

This creates:
- auth-linked `profiles`
- notifications
- announcements and comments
- reservations
- sit-in records
- feedback
- resources
- lab computers and lab schedules
- RLS policies and login helper function
- registration duplicate checks for id number/email/username

## 4. Create accounts

Use `/register` to create student accounts. The schema auto-confirms email on signup, so students can log in immediately.

For admin access, create a user in **Auth → Users** with:
- email: `admin@example.com`
- password: `admin123`

The schema auto-promotes `admin@example.com` / `admin` to role `admin` when re-run. You can also promote it manually:

```sql
update public.profiles
set role = 'admin',
    username = 'admin',
    firstname = 'Admin',
    lastname = 'User',
    idno = 'ADMIN'
where email = 'admin@example.com';
```

Sign out and sign back in after running this.

If you previously created `admin@example.com` by inserting directly into `auth.users`, delete that auth user first and recreate it through **Auth → Users**. Updating `public.profiles` alone will not fix a broken auth record.

## 5. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.
