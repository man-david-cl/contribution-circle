import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.redirect(new URL('/login?logout_error=1', request.url), { status: 303 });
  }

  return NextResponse.redirect(new URL('/logout', request.url), { status: 303 });
}
