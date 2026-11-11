import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to submit a deposit.' }, { status: 401 });

  const form = await req.formData();
  const cycleId = String(form.get('cycleId') || '');
  const transferDate = String(form.get('transferDate') || '');
  const reference = String(form.get('reference') || '').trim();
  const note = String(form.get('note') || '').trim();
  const receipt = form.get('receipt');

  if (!cycleId || !/^\\d{4}-\\d{2}-\\d{2}$/.test(transferDate) || !(receipt instanceof File)) {
    return NextResponse.json({ error: 'Complete the transfer date and attach a receipt.' }, { status: 400 });
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(receipt.type) || receipt.size > 5 * 1024 * 1024 || receipt.size === 0) {
    return NextResponse.json({ error: 'Receipt must be JPG, PNG, WEBP or PDF and no larger than 5 MB.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: cycle, error: cycleError } = await admin.from('contribution_cycles')
    .select('id,contribution_amount,status').eq('id', cycleId).maybeSingle();
  if (cycleError || !cycle || !['open', 'collecting'].includes(cycle.status)) {
    return NextResponse.json({ error: 'This contribution cycle is not open for deposits.' }, { status: 400 });
  }
  const { data: existing } = await admin.from('contributions').select('id')
    .eq('cycle_id', cycleId).eq('member_id', user.id).maybeSingle();
  if (existing) return NextResponse.json({ error: 'You have already submitted a deposit for this cycle.' }, { status: 409 });

  const extension = receipt.type === 'application/pdf' ? 'pdf' : receipt.type.split('/')[1];
  const path = `${user.id}/${cycleId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage.from('deposit-receipts').upload(path, receipt, {
    contentType: receipt.type, upsert: false
  });
  if (uploadError) return NextResponse.json({ error: 'Receipt upload failed: ' + uploadError.message }, { status: 400 });

  const { data, error } = await admin.from('contributions').insert({
    cycle_id: cycleId, member_id: user.id, amount: cycle.contribution_amount,
    status: 'submitted', transfer_date: transferDate, payment_reference: reference || null,
    member_note: note || null, receipt_path: path
  }).select('id').single();

  if (error) {
    await admin.storage.from('deposit-receipts').remove([path]);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await admin.from('notifications').insert({
    member_id: user.id, title: 'Deposit submitted',
    message: 'Your deposit receipt has been submitted and is awaiting administrator verification.'
  });
  return NextResponse.json({ data });
}
