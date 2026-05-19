import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      console.error('Missing config SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
      return NextResponse.json({ error: 'Missing service configuration' }, { status: 500 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Look up the user ID from profiles first to optimize search
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email.trim())
      .maybeSingle();

    let userId = profile?.id;

    if (!userId) {
      // Fallback: list all users to find matching email
      const { data: { users }, error: listError } = await admin.auth.admin.listUsers();
      if (listError) {
        console.error('List users error:', listError);
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }
      const user = users.find((u: any) => u.email?.toLowerCase() === email.trim().toLowerCase());
      if (user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Confirm the email for the user immediately using admin API
    const { error: updateError } = await (admin.auth as any).admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (updateError) {
      console.error('Update email_confirm error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API confirm-email error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
