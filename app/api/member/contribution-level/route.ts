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

  const { data, error } = await supabase.rpc('member_select_contribution_level', { p_amount: amount });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}
