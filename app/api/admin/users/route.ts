import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  const body = await request.json();
  const {
    idno,
    firstname,
    middlename,
    lastname,
    course,
    level,
    email,
    username,
    password,
  } = body;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' }, { status: 500 });
  }

  // Validate required fields
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Create auth user (admin API)
    // Using `any` because admin auth types vary across client versions
    const metadata: Record<string, any> = {
      role: 'student',
    };
    if (idno) metadata.idno = idno;
    if (firstname) metadata.firstname = firstname;
    if (middlename) metadata.middlename = middlename;
    if (lastname) metadata.lastname = lastname;
    if (course) metadata.course = course;
    if (level) metadata.level = level;
    if (username) metadata.username = username;

    const { data: createData, error: createError } = await (admin.auth as any).admin.createUser({
      email: email.trim(),
      password: password,
      user_metadata: metadata,
      email_confirm: true,
    });
    if (createError) {
      console.error('Auth create error:', createError);
      return NextResponse.json({ error: `Failed to create user: ${createError.message}` }, { status: 400 });
    }

    const user = createData?.user;
    if (!user || !user.id) {
      console.error('Auth user created but no ID returned:', createData);
      return NextResponse.json({ error: 'User created but ID not returned from auth service' }, { status: 500 });
    }

    // Ensure profile row exists (upsert)
    const profilePayload = {
      id: user.id,
      idno: idno ?? (user.user_metadata?.idno ?? null),
      firstname: firstname ?? (user.user_metadata?.firstname ?? null),
      middlename: middlename ?? (user.user_metadata?.middlename ?? null),
      lastname: lastname ?? (user.user_metadata?.lastname ?? null),
      email: email ?? user.email,
      username: username ?? (user.user_metadata?.username ?? user.email),
      course: course ?? (user.user_metadata?.course ?? 'BSIT'),
      level: level ?? (user.user_metadata?.level ?? '1'),
      role: 'student',
      session_remaining: 30,
      points: 0,
      tasks_completed: 0,
      hours_spent: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: profileData, error: profileError } = await admin.from('profiles').upsert(profilePayload).select().single();
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ user, profile: profileData }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
