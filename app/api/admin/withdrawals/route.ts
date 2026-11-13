import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role,is_active')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' || profile.is_active !== true) {
      return NextResponse.json({ error: 'Active administrator access required' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : '';
    const action = body.action;
    if (!/^[0-9a-f-]{36}$/i.test(id) || !['approve', 'reject', 'paid'].includes(action)) {
      return NextResponse.json({ error: 'A valid withdrawal request and action are required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('admin_update_withdrawal', {
      p_request_id: id,
      p_action: action,
      p_admin_id: user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Admin withdrawal update failed:', error);
    return NextResponse.json({ error: 'Unable to update the withdrawal. Please try again.' }, { status: 500 });
  }
}
