-- Comprehensive fix: Sync auth.users to profiles table

-- Step 1: For any auth.users with role 'student' that don't have profiles, create them
INSERT INTO public.profiles (id, idno, firstname, middlename, lastname, email, username, course, level, role, session_remaining, points, tasks_completed, hours_spent, created_at, updated_at)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'idno', SPLIT_PART(u.email, '@', 1)) as idno,
  COALESCE(u.raw_user_meta_data->>'firstname', 'Student') as firstname,
  COALESCE(u.raw_user_meta_data->>'middlename', '') as middlename,
  COALESCE(u.raw_user_meta_data->>'lastname', 'User') as lastname,
  u.email,
  COALESCE(u.raw_user_meta_data->>'username', SPLIT_PART(u.email, '@', 1)) as username,
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
WHERE u.raw_user_meta_data->>'role' = 'student'
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Verify the fix
SELECT 
  'Auth users (students)' as source,
  COUNT(*) as count
FROM auth.users 
WHERE raw_user_meta_data->>'role' = 'student'
UNION ALL
SELECT 
  'Profiles (students)',
  COUNT(*) 
FROM public.profiles 
WHERE role = 'student'
UNION ALL
SELECT
  'Profiles with NULL id',
  COUNT(*)
FROM public.profiles
WHERE role = 'student' AND id IS NULL;
