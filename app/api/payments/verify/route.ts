import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { verifyPaystackPayment } from '@/lib/paystack';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const reference = typeof body.reference === 'string' ? body.reference : '';
    if (!/^CC-[0-9a-f-]{36}$/i.test(reference)) {
      return NextResponse.json({ error: 'Invalid payment reference.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: contribution } = await admin.from('contributions')
      .select('id,member_id,amount,status,payment_reference')
      .eq('payment_reference', reference).eq('member_id', user.id).maybeSingle();
    if (!contribution) return NextResponse.json({ error: 'Payment record not found.' }, { status: 404 });

    const payment = await verifyPaystackPayment(reference);
    const expectedKobo = Math.round(Number(contribution.amount) * 100);
    if (payment.status !== 'success' || payment.reference !== reference ||
        payment.currency !== 'NGN' || payment.amount !== expectedKobo) {
      return NextResponse.json({ error: 'Payment is not yet confirmed. If you were charged, contact the administrator.' }, { status: 409 });
    }

    const { data: credited, error } = await admin.rpc('confirm_contribution_payment', {
      p_payment_reference: reference,
      p_provider_reference: String(payment.id),
    });
    if (error) throw error;
    return NextResponse.json({ success: true, alreadyConfirmed: credited === false });
  } catch (error) {
    console.error('Paystack verification failed:', error);
    return NextResponse.json({ error: 'Could not verify payment. Please refresh or contact the administrator.' }, { status: 500 });
  }
}
