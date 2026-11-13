import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase.rpc('request_current_withdrawal');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Withdrawal request failed:', error);
    return NextResponse.json({ error: 'Unable to submit your withdrawal request. Please try again.' }, { status: 500 });
  }
}
