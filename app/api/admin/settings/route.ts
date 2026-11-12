import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function PATCH(req: Request) {
  try {
    const s = await createClient();
    const { data: { user }, error: authError } = await s.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await s.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    if (typeof body.group_id !== 'string' || typeof body.withdrawal_enabled !== 'boolean') {
      return NextResponse.json({ error: 'A circle and a valid withdrawal setting are required.' }, { status: 400 });
    }
    const { data, error } = await s.rpc('admin_set_group_withdrawal_enabled', {
      p_enabled: body.withdrawal_enabled, p_group_id: body.group_id, p_admin_id: user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Admin circle withdrawal setting error:', error);
    return NextResponse.json({ error: 'The server could not update withdrawal access.' }, { status: 500 });
  }
}
