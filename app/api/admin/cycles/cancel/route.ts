import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role,is_active').eq('id', user.id).single();
    if (profile?.role !== 'admin' || profile.is_active !== true) {
      return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const cycleId = typeof body.cycle_id === 'string' ? body.cycle_id : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(cycleId)) {
      return NextResponse.json({ error: 'A valid contribution cycle is required.' }, { status: 400 });
    }
    if (reason.length < 10 || reason.length > 500) {
      return NextResponse.json({ error: 'Enter a cancellation reason between 10 and 500 characters.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('admin_cancel_contribution_cycle', {
      p_cycle_id: cycleId,
      p_admin_id: user.id,
      p_reason: reason,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Cancel contribution cycle error:', error);
    return NextResponse.json({ error: 'Unable to cancel this contribution cycle.' }, { status: 500 });
  }
}
