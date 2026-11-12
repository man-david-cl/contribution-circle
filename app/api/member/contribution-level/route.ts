import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const ALLOWED_LEVELS = [10000, 20000, 30000, 40000, 50000];

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!ALLOWED_LEVELS.includes(amount)) {
    return NextResponse.json({ error: 'Choose one of the available contribution levels.' }, { status: 400 });
  }

  const { data: profile } = await supabase.from('profiles')
    .select('is_active,contribution_level').eq('id', user.id).single();
  if (!profile?.is_active) {
    return NextResponse.json({ error: 'Your membership is not active.' }, { status: 403 });
  }

  const { error } = await supabase.from('profiles')
    .update({ contribution_level: amount }).eq('id', user.id);
  if (error) {
    console.error('Contribution level update failed:', error);
    return NextResponse.json({ error: 'Could not save your contribution level. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, amount, previousAmount: profile.contribution_level ?? null });
}
