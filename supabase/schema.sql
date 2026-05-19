-- Enable UUID generation
create extension if not exists pgcrypto;

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  idno text unique not null,
  firstname text not null,
  middlename text not null default '',
  lastname text not null,
  email text unique not null,
  username text unique not null,
  course text not null check (course in ('BSIT', 'BSCS', 'HM', 'CRIM', 'CBA')),
  level text not null check (level in ('1', '2', '3', '4')),
  role text not null default 'student' check (role in ('student', 'admin')),
  session_remaining integer not null default 30,
  points integer not null default 0,
  tasks_completed integer not null default 0,
  hours_spent integer not null default 0,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  role_scope text check (role_scope in ('student', 'admin')),
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  title text not null,
  description text not null,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null default 'Admin',
  attachment_name text,
  attachment_type text check (attachment_type in ('image', 'file')),
  attachment_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.announcement_comments (
  id bigint generated always as identity primary key,
  announcement_id bigint not null references public.announcements(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  comment text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.resources(id) on delete cascade,
  title text not null,
  type text not null check (type in ('folder', 'pdf', 'doc', 'video', 'file')),
  size text not null default '0 KB',
  description text not null default '',
  owner_name text not null default 'Admin',
  storage_url text,
  uploaded_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reservations (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  idno text not null,
  full_name text not null,
  course text not null check (course in ('BSIT', 'BSCS', 'HM', 'CRIM', 'CBA')),
  level text not null check (level in ('1', '2', '3', '4')),
  lab_number text not null check (lab_number in ('524', '526', '528', '530', '542', '544')),
  pc_number integer not null,
  reservation_date date not null,
  time_in text not null,
  purpose text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'sit-inned', 'completed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sit_in_records (
  id bigint generated always as identity primary key,
  idno text not null,
  full_name text not null,
  purpose text not null,
  lab_number text not null check (lab_number in ('524', '526', '528', '530', '542', '544')),
  time_in text not null,
  time_out text,
  date date not null,
  session_remaining integer not null default 0,
  status text not null default 'Sit-in' check (status in ('Sit-in', 'Completed')),
  rewarded boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  idno text not null,
  full_name text not null,
  course text not null check (course in ('BSIT', 'BSCS', 'HM', 'CRIM', 'CBA')),
  level text not null check (level in ('1', '2', '3', '4')),
  lab text not null check (lab in ('524', '526', '528', '530', '542', '544')),
  date date not null,
  time_in text not null,
  time_out text not null,
  message text not null,
  rating integer not null check (rating between 1 and 5),
  flagged boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lab_computers (
  id bigint generated always as identity primary key,
  lab_number text not null check (lab_number in ('524', '526', '528', '530', '542', '544')),
  pc_number integer not null,
  status text not null check (status in ('available', 'unavailable', 'reserved', 'occupied')),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (lab_number, pc_number)
);

create table if not exists public.lab_schedules (
  id bigint generated always as identity primary key,
  lab_number text not null check (lab_number in ('524', '526', '528', '530', '542', '544')),
  day text not null check (day in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
  start_time text not null,
  end_time text not null,
  status text not null check (status in ('available', 'unavailable')),
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Auth trigger to create profile rows from auth metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_idno text;
  new_email text;
  new_username text;
  new_role text;
begin
  -- Auto-confirm email so users can sign in immediately after registration.
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now()))
  where id = new.id;

  new_idno := coalesce(new.raw_user_meta_data->>'idno', concat('ID-', left(new.id::text, 8)));
  new_email := coalesce(new.email, '');
  new_username := coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email, ''), '@', 1));
  new_role := coalesce(new.raw_user_meta_data->>'role', 'student');

  if lower(new_email) = 'admin@example.com' or lower(new_username) = 'admin' then
    new_role := 'admin';
  end if;

  delete from public.profiles
  where lower(email) = lower(new_email);

  if exists (select 1 from public.profiles p where p.idno = new_idno) then
    new_idno := concat(new_idno, '-', left(replace(new.id::text, '-', ''), 6));
  end if;

  if exists (select 1 from public.profiles p where lower(p.username) = lower(new_username)) then
    new_username := concat(new_username, '-', left(replace(new.id::text, '-', ''), 6));
  end if;

  insert into public.profiles (
    id,
    idno,
    firstname,
    middlename,
    lastname,
    email,
    username,
    course,
    level,
    role
  )
  values (
    new.id,
    new_idno,
    coalesce(new.raw_user_meta_data->>'firstname', ''),
    coalesce(new.raw_user_meta_data->>'middlename', ''),
    coalesce(new.raw_user_meta_data->>'lastname', ''),
    new_email,
    new_username,
    coalesce(new.raw_user_meta_data->>'course', 'BSIT'),
    coalesce(new.raw_user_meta_data->>'level', '1'),
    new_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill existing unconfirmed users so login works without email confirmation.
update auth.users
set email_confirmed_at = timezone('utc', now())
where email_confirmed_at is null;

-- Backfill profiles for existing auth users that do not yet have a profile row.
insert into public.profiles (
  id,
  idno,
  firstname,
  middlename,
  lastname,
  email,
  username,
  course,
  level,
  role
)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'idno', concat('ID-', left(u.id::text, 8))),
  coalesce(u.raw_user_meta_data->>'firstname', ''),
  coalesce(u.raw_user_meta_data->>'middlename', ''),
  coalesce(u.raw_user_meta_data->>'lastname', ''),
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data->>'username', split_part(coalesce(u.email, ''), '@', 1)),
  coalesce(u.raw_user_meta_data->>'course', 'BSIT'),
  coalesce(u.raw_user_meta_data->>'level', '1'),
  case
    when lower(coalesce(u.email, '')) = 'admin@example.com'
      or lower(coalesce(u.raw_user_meta_data->>'username', split_part(coalesce(u.email, ''), '@', 1))) = 'admin'
      then 'admin'
    else coalesce(u.raw_user_meta_data->>'role', 'student')
  end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and coalesce(u.email, '') <> ''
  and not exists (
    select 1 from public.profiles e where e.email = coalesce(u.email, '')
  )
  and not exists (
    select 1
    from public.profiles un
    where un.username = coalesce(u.raw_user_meta_data->>'username', split_part(coalesce(u.email, ''), '@', 1))
  )
  and not exists (
    select 1
    from public.profiles i
    where i.idno = coalesce(u.raw_user_meta_data->>'idno', concat('ID-', left(u.id::text, 8)))
  )
on conflict (id) do nothing;

-- Reconcile older profile rows that were created before idno was reliably stored.
update public.profiles p
set
  idno = u.raw_user_meta_data->>'idno',
  updated_at = timezone('utc', now())
from auth.users u
where p.id = u.id
  and nullif(trim(coalesce(u.raw_user_meta_data->>'idno', '')), '') is not null
  and p.idno is not null
  and p.idno <> u.raw_user_meta_data->>'idno'
  and (
    p.idno ilike 'ID-%'
    or regexp_replace(lower(coalesce(p.idno, '')), '[^a-z0-9]', '', 'g') = regexp_replace(lower(coalesce(p.username, '')), '[^a-z0-9]', '', 'g')
    or regexp_replace(lower(coalesce(p.idno, '')), '[^a-z0-9]', '', 'g') = regexp_replace(lower(coalesce(u.email, '')), '[^a-z0-9]', '', 'g')
  );

-- Keep default admin account role aligned even if created from Auth dashboard.
update public.profiles
set role = 'admin',
    updated_at = timezone('utc', now())
where lower(email) = 'admin@example.com'
   or lower(username) = 'admin'
   or idno = 'ADMIN';

-- Login helper for username/email auth form.
create or replace function public.get_login_email(input_value text)
returns text
language sql
security definer
set search_path = public
as $$
  select candidate.email
  from (
    select
      p.email,
      case
        when lower(trim(p.idno)) = lower(trim(input_value)) then 0
        when regexp_replace(lower(coalesce(p.idno, '')), '[^a-z0-9]', '', 'g') = regexp_replace(lower(coalesce(input_value, '')), '[^a-z0-9]', '', 'g') then 1
        when lower(trim(p.email)) = lower(trim(input_value)) then 2
        when lower(trim(p.username)) = lower(trim(input_value)) then 3
        else 99
      end as match_rank
    from public.profiles p
    where lower(trim(p.idno)) = lower(trim(input_value))
       or regexp_replace(lower(coalesce(p.idno, '')), '[^a-z0-9]', '', 'g') = regexp_replace(lower(coalesce(input_value, '')), '[^a-z0-9]', '', 'g')
       or lower(trim(p.email)) = lower(trim(input_value))
       or lower(trim(p.username)) = lower(trim(input_value))

    union all

    select
      u.email,
      case
        when lower(trim(coalesce(u.raw_user_meta_data->>'idno', ''))) = lower(trim(input_value)) then 0
        when regexp_replace(lower(coalesce(u.raw_user_meta_data->>'idno', '')), '[^a-z0-9]', '', 'g') = regexp_replace(lower(coalesce(input_value, '')), '[^a-z0-9]', '', 'g') then 1
        when lower(trim(u.email)) = lower(trim(input_value)) then 2
        when lower(trim(coalesce(u.raw_user_meta_data->>'username', ''))) = lower(trim(input_value)) then 3
        else 99
      end as match_rank
    from auth.users u
    where lower(trim(coalesce(u.raw_user_meta_data->>'idno', ''))) = lower(trim(input_value))
       or regexp_replace(lower(coalesce(u.raw_user_meta_data->>'idno', '')), '[^a-z0-9]', '', 'g') = regexp_replace(lower(coalesce(input_value, '')), '[^a-z0-9]', '', 'g')
       or lower(trim(u.email)) = lower(trim(input_value))
       or lower(trim(coalesce(u.raw_user_meta_data->>'username', ''))) = lower(trim(input_value))
  ) candidate
  order by candidate.match_rank asc
  limit 1;
$$;

grant execute on function public.get_login_email(text) to anon, authenticated;

create or replace function public.get_public_leaderboard(input_limit integer default 10)
returns table (
  id uuid,
  firstname text,
  lastname text,
  course text,
  level text,
  points integer,
  hours_spent integer,
  tasks_completed integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.firstname,
    p.lastname,
    p.course,
    p.level,
    p.points,
    p.hours_spent,
    p.tasks_completed
  from public.profiles p
  where p.role = 'student'
    and lower(p.email) <> 'admin@example.com'
    and lower(p.username) <> 'admin'
    and p.idno <> 'ADMIN'
  order by
    (p.points * 0.6 + (p.hours_spent / 60.0) * 0.2 + p.tasks_completed * 0.2) desc,
    p.lastname asc,
    p.firstname asc
  limit greatest(coalesce(input_limit, 10), 1);
$$;

grant execute on function public.get_public_leaderboard(integer) to anon, authenticated;

-- Registration pre-check helper (matches legacy TempSysArch duplicate validation behavior).
create or replace function public.check_registration_conflicts(
  input_idno text,
  input_email text,
  input_username text
)
returns table (
  conflict_field text,
  conflict_message text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles p where p.idno = input_idno) then
    return query select 'idno'::text, 'ID number already exists.'::text;
    return;
  end if;

  if exists (select 1 from public.profiles p where lower(p.email) = lower(input_email))
     or exists (select 1 from auth.users u where lower(u.email) = lower(input_email)) then
    return query select 'email'::text, 'Email already exists.'::text;
    return;
  end if;

  if exists (select 1 from public.profiles p where lower(p.username) = lower(input_username)) then
    return query select 'username'::text, 'Username already exists.'::text;
    return;
  end if;
end;
$$;

grant execute on function public.check_registration_conflicts(text, text, text) to anon, authenticated;

-- Helper functions for RLS checks.
-- Read role/idno from public.profiles so admin visibility always reflects live profile data.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    ),
    'student'
  );
$$;

create or replace function public.current_user_idno()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.idno
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_idno() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- RLS policies
alter table public.profiles enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_comments enable row level security;
alter table public.resources enable row level security;
alter table public.reservations enable row level security;
alter table public.sit_in_records enable row level security;
alter table public.feedback enable row level security;
alter table public.lab_computers enable row level security;
alter table public.lab_schedules enable row level security;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
on public.profiles for select
to authenticated
using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
on public.profiles for update
to authenticated
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists "profiles admin insert" on public.profiles;
create policy "profiles admin insert"
on public.profiles for insert
to authenticated
with check (public.is_admin());

drop policy if exists "profiles admin delete" on public.profiles;
create policy "profiles admin delete"
on public.profiles for delete
to authenticated
using (public.is_admin());

drop policy if exists "notifications read" on public.notifications;
create policy "notifications read"
on public.notifications for select
to authenticated
using (
  user_id = auth.uid()
  or (
    user_id is null
    and (public.current_user_role() = role_scope or role_scope is null)
  )
  or public.is_admin()
);

drop policy if exists "notifications update" on public.notifications;
create policy "notifications update"
on public.notifications for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "notifications admin insert" on public.notifications;
create policy "notifications admin insert"
on public.notifications for insert
to authenticated
with check (public.is_admin());

drop policy if exists "announcements read" on public.announcements;
create policy "announcements read"
on public.announcements for select
to authenticated
using (true);

drop policy if exists "announcements admin write" on public.announcements;
create policy "announcements admin write"
on public.announcements for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "announcement comments read" on public.announcement_comments;
create policy "announcement comments read"
on public.announcement_comments for select
to authenticated
using (true);

drop policy if exists "announcement comments write" on public.announcement_comments;
create policy "announcement comments write"
on public.announcement_comments for insert
to authenticated
with check (user_id = auth.uid() or user_id is null);

drop policy if exists "resources read" on public.resources;
create policy "resources read"
on public.resources for select
to authenticated
using (true);

drop policy if exists "resources admin write" on public.resources;
create policy "resources admin write"
on public.resources for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "reservations read" on public.reservations;
create policy "reservations read"
on public.reservations for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "reservations create own" on public.reservations;
create policy "reservations create own"
on public.reservations for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "reservations admin update" on public.reservations;
create policy "reservations admin update"
on public.reservations for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "sitins read" on public.sit_in_records;
create policy "sitins read"
on public.sit_in_records for select
to authenticated
using (public.is_admin() or idno = public.current_user_idno());

drop policy if exists "sitins admin write" on public.sit_in_records;
create policy "sitins admin write"
on public.sit_in_records for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "feedback read" on public.feedback;
create policy "feedback read"
on public.feedback for select
to authenticated
using (public.is_admin() or idno = public.current_user_idno());

drop policy if exists "feedback write" on public.feedback;
create policy "feedback write"
on public.feedback for insert
to authenticated
with check (public.is_admin() or idno = public.current_user_idno());

drop policy if exists "lab computers read" on public.lab_computers;
create policy "lab computers read"
on public.lab_computers for select
to authenticated
using (true);

drop policy if exists "lab computers admin write" on public.lab_computers;
create policy "lab computers admin write"
on public.lab_computers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "lab schedules read" on public.lab_schedules;
create policy "lab schedules read"
on public.lab_schedules for select
to authenticated
using (true);

drop policy if exists "lab schedules admin write" on public.lab_schedules;
create policy "lab schedules admin write"
on public.lab_schedules for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
