import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

async function getAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return { supabase, user: null, response: NextResponse.json({ error: 'Administrator access required' }, { status: 403 }) };
  return { supabase, user, response: null };
}

export async function POST(req: Request) {
  try {
    const { supabase, user, response } = await getAdmin();
    if (response || !user) return response;
    const body = await req.json().catch(() => ({}));
    const level = Number(body.level);
    const capacity = Number(body.max_members);
    const frequency = String(body.cycle_frequency || 'monthly');
    if (!Number.isInteger(level) || level < 1 || level > 5) return NextResponse.json({ error: 'Choose a level from 1 to 5.' }, { status: 400 });
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 500) return NextResponse.json({ error: 'Circle capacity must be between 2 and 500.' }, { status: 400 });
    const { data, error } = await supabase.rpc('admin_create_contribution_group', {
      p_admin_id: user.id, p_level: level, p_group_name: typeof body.group_name === 'string' ? body.group_name : '',
      p_max_members: capacity, p_frequency: frequency,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Create contribution circle failed:', error);
    return NextResponse.json({ error: 'Could not create the contribution circle.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, response } = await getAdmin();
    if (response || !user) return response;
    const body = await req.json().catch(() => ({}));
    if (typeof body.group_id !== 'string') return NextResponse.json({ error: 'A contribution circle is required.' }, { status: 400 });
    const { data, error } = await supabase.rpc('admin_update_contribution_group', {
      p_admin_id: user.id,
      p_group_id: body.group_id,
      p_contribution_amount: Number(body.contribution_amount),
      p_cycle_frequency: String(body.cycle_frequency),
      p_max_members: Number(body.max_members),
      p_group_status: String(body.group_status),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Update contribution circle failed:', error);
    return NextResponse.json({ error: 'Could not update this contribution circle.' }, { status: 500 });
  }
}
