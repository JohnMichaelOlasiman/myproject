-- Find the orphaned profile (exists in profiles but not in auth.users)
SELECT p.id, p.idno, p.email, p.firstname, p.lastname
FROM public.profiles p
WHERE p.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
LIMIT 20;

-- If you want to delete the orphaned profile(s), run this:
-- DELETE FROM public.profiles p
-- WHERE p.role = 'student'
--   AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

-- After deletion, verify counts match:
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
WHERE role = 'student';
