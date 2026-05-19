import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json();
  const { email, password, metadata = {}, profile = {} } = body;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' }, { status: 500 });
  }

  const { id } = await params;
  const uid = id?.trim();
  if (!uid) {
    return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Only update auth user if email or password is provided
    if (email || password) {
      const updatePayload: Record<string, unknown> = {};
      if (email) updatePayload.email = email.trim();
      if (password) updatePayload.password = password;
      
      const { data: updateData, error: updateError } = await (admin.auth as any).admin.updateUserById(uid, updatePayload);
      if (updateError) {
        console.error('Update auth user error:', updateError, 'payload:', updatePayload, 'uid:', uid);
        const errObj = {
          message: updateError.message ?? 'Unknown error from auth.updateUserById',
          details: updateError,
        };
        return NextResponse.json({ error: errObj }, { status: 400 });
      }
    }

    // Update profile table
    const { data: profileData, error: profileError } = await admin.from('profiles').update({ ...profile, updated_at: new Date().toISOString() }).eq('id', uid).select().maybeSingle();
    if (profileError) {
      console.error('Update profile error:', profileError);
      return NextResponse.json({ error: `Failed to update profile: ${profileError.message}` }, { status: 500 });
    }

    return NextResponse.json({ profile: profileData ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('PUT endpoint error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' }, { status: 500 });
  }

  const { id } = await params;
  const uid = id?.trim();
  if (!uid) {
    return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // delete auth user
    const { data: deleteData, error: deleteError } = await (admin.auth as any).admin.deleteUser(uid);
    if (deleteError) {
      console.error('Delete auth user error:', deleteError, 'uid:', uid);
      const errObj = {
        message: deleteError.message ?? 'Unknown error from auth.deleteUser',
        details: deleteError,
      };
      return NextResponse.json({ error: errObj }, { status: 400 });
    }

    // delete profile row as well
    const { error: profileError } = await admin.from('profiles').delete().eq('id', uid);
    if (profileError) {
      console.error('Delete profile error:', profileError);
      return NextResponse.json({ error: `Failed to delete profile: ${profileError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('DELETE endpoint error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
