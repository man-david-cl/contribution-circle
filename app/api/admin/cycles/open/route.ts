import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const s = await createClient();
    const { data: { user }, error: authError } = await s.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await s.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    if (typeof body.group_id !== 'string') return NextResponse.json({ error: 'Select a contribution circle.' }, { status: 400 });
    const { data, error } = await s.rpc('admin_open_group_cycle', { p_admin_id: user.id, p_group_id: body.group_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Open circle contribution cycle error:', error);
    return NextResponse.json({ error: 'Unable to open this circle’s contribution cycle.' }, { status: 500 });
  }
}
