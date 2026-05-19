-- Diagnostic queries to understand the student data issue

-- Check 1: How many students are in profiles table?
SELECT COUNT(*) as total_profile_students, COUNT(id) as with_id, COUNT(CASE WHEN id IS NULL THEN 1 END) as missing_id
FROM public.profiles WHERE role = 'student';

-- Check 2: Show students with their current IDs (first 10)
SELECT id, idno, email, firstname, lastname, created_at FROM public.profiles 
WHERE role = 'student' 
LIMIT 10;

-- Check 3: How many auth users exist?
SELECT COUNT(*) as total_auth_users FROM auth.users;

-- Check 4: Show auth users (first 10)
SELECT id, email, raw_user_meta_data->>'firstname' as firstname, raw_user_meta_data->>'role' as role, created_at 
FROM auth.users 
LIMIT 10;

-- Check 5: Which auth.users don't have profiles?
SELECT u.id, u.email, u.raw_user_meta_data->>'firstname' as firstname
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
LIMIT 10;

-- Check 6: Are there profiles with NULL IDs?
SELECT id, idno, email, firstname FROM public.profiles 
WHERE role = 'student' AND id IS NULL;
