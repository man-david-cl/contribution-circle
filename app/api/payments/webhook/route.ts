import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { isValidPaystackSignature, verifyPaystackPayment } from '@/lib/paystack';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!isValidPaystackSignature(rawBody, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody);
    if (event.event !== 'charge.success') return NextResponse.json({ received: true });

    const reference = event.data?.reference;
    if (typeof reference !== 'string' || !/^CC-[0-9a-f-]{36}$/i.test(reference)) {
      return NextResponse.json({ received: true });
    }

    // Verify directly with Paystack; never trust the webhook payload alone.
    const payment = await verifyPaystackPayment(reference);
    if (payment.status !== 'success' || payment.reference !== reference || payment.currency !== 'NGN') {
      return NextResponse.json({ received: true });
    }

    const admin = createAdminClient();
    const { data: contribution } = await admin.from('contributions')
      .select('amount,payment_reference')
      .eq('payment_reference', reference).maybeSingle();
    if (!contribution || payment.amount !== Math.round(Number(contribution.amount) * 100)) {
      console.error('Paystack webhook did not match a pending contribution:', reference);
      return NextResponse.json({ received: true });
    }

    const { error } = await admin.rpc('confirm_contribution_payment', {
      p_payment_reference: reference,
      p_provider_reference: String(payment.id),
    });
    if (error) throw error;
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Paystack webhook processing failed:', error);
    // 5xx asks Paystack to retry transient failures.
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
