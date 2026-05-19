-- Fix students without proper IDs in profiles table

-- Step 1: Check for profiles with NULL IDs
-- Run this to see which students are missing IDs:
SELECT id, idno, email, firstname, lastname FROM public.profiles 
WHERE role = 'student' AND id IS NULL 
LIMIT 20;

-- Step 2: Fix profiles with missing IDs by matching them to auth.users by email
-- This updates existing profiles to get their proper UUIDs from auth.users
UPDATE public.profiles p
SET id = u.id,
    updated_at = NOW()
FROM auth.users u
WHERE p.email = u.email
  AND (u.raw_user_meta_data->>'role' = 'student' OR u.raw_app_meta_data->>'role' = 'student')
  AND p.id IS NULL
  AND p.role = 'student';

-- Step 3: If there are auth.users without profiles, create them
INSERT INTO public.profiles (id, idno, firstname, middlename, lastname, email, username, course, level, role, session_remaining, points, tasks_completed, hours_spent, created_at, updated_at)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'idno', u.email) as idno,
  COALESCE(u.raw_user_meta_data->>'firstname', 'Student') as firstname,
  COALESCE(u.raw_user_meta_data->>'middlename', '') as middlename,
  COALESCE(u.raw_user_meta_data->>'lastname', 'User') as lastname,
  u.email,
  COALESCE(u.raw_user_meta_data->>'username', u.email) as username,
  COALESCE(u.raw_user_meta_data->>'course', 'BSIT') as course,
  COALESCE(u.raw_user_meta_data->>'level', '1') as level,
  'student',
  30,
  0,
  0,
  0,
  u.created_at,
  NOW()
FROM auth.users u
WHERE (u.raw_user_meta_data->>'role' = 'student' OR u.raw_app_meta_data->>'role' = 'student')
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Step 4: Verify all students now have proper IDs
SELECT 'Total students' as check_type, COUNT(*) as count
FROM public.profiles WHERE role = 'student'
UNION ALL
SELECT 'Students with valid ID', COUNT(*) 
FROM public.profiles WHERE role = 'student' AND id IS NOT NULL
UNION ALL
SELECT 'Students missing ID', COUNT(*) 
FROM public.profiles WHERE role = 'student' AND id IS NULL;
