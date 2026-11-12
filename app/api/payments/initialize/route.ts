import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { initializePaystackPayment } from '@/lib/paystack';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Fail closed before creating a pending contribution record. The Paystack key
  // is server-only and payment initialization stays unavailable until configured.
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Online payments are not configured yet. Please contact the administrator.' },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: 'Please sign in with an email address.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const cycleId = typeof body.cycleId === 'string' ? body.cycleId : '';
    if (!/^[0-9a-f-]{36}$/i.test(cycleId)) {
      return NextResponse.json({ error: 'A valid contribution cycle is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: cycle, error: cycleError } = await admin
      .from('contribution_cycles')
      .select('id,status,month_label,group_id,contribution_amount')
      .eq('id', cycleId)
      .in('status', ['open', 'collecting'])
      .single();
    if (cycleError || !cycle) return NextResponse.json({ error: 'This contribution cycle is not open for payment.' }, { status: 404 });

    const { data: profile } = await admin
      .from('profiles').select('is_active,contribution_level,group_id').eq('id', user.id).single();
    if (!profile?.is_active) return NextResponse.json({ error: 'Your membership is not active.' }, { status: 403 });
    if (!profile.group_id || profile.group_id !== cycle.group_id) {
      return NextResponse.json({ error: 'This cycle does not belong to your contribution circle.' }, { status: 403 });
    }

    const amount = Number(cycle.contribution_amount || profile.contribution_level);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
      return NextResponse.json({ error: 'The contribution amount for this circle is invalid.' }, { status: 409 });
    }
    const reference = `CC-${randomUUID()}`;
    // The RPC locks the cycle before creating/updating the contribution. This
    // serializes payment setup with administrator cancellation.
    const { data: prepared, error: prepareError } = await admin.rpc('prepare_contribution_payment', {
      p_cycle_id: cycleId,
      p_member_id: user.id,
      p_payment_reference: reference,
    });
    if (prepareError) {
      return NextResponse.json({ error: prepareError.message }, { status: 409 });
    }
    const preparedAmount = Number(prepared?.amount);
    if (!Number.isFinite(preparedAmount) || preparedAmount <= 0) {
      return NextResponse.json({ error: 'The contribution amount for this circle is invalid.' }, { status: 409 });
    }
    const amountKobo = Math.round(preparedAmount * 100);
    if (!Number.isSafeInteger(amountKobo)) {
      return NextResponse.json({ error: 'Your selected contribution level is invalid.' }, { status: 400 });
    }

    // Do not derive customer-facing callbacks from request.url: on Vercel that
    // host can be a unique deployment URL. Prefer the stable production domain.
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '');
    const payment = await initializePaystackPayment({
      email: user.email,
      amountKobo,
      reference,
      callbackUrl: `${appUrl}/payments/callback`,
      metadata: { contribution_cycle_id: cycleId, member_id: user.id, contribution_level: String(amount) },
    });

    const { data: latestCycle } = await admin.from('contribution_cycles')
      .select('status').eq('id', cycleId).maybeSingle();
    if (!latestCycle || !['open', 'collecting'].includes(latestCycle.status)) {
      return NextResponse.json({ error: 'This contribution cycle closed while payment was being prepared. Do not continue with this payment.' }, { status: 409 });
    }

    return NextResponse.json({ authorizationUrl: payment.authorization_url });
  } catch (error) {
    console.error('Paystack initialization failed:', error);
    return NextResponse.json({ error: 'Unable to start payment. Please try again.' }, { status: 500 });
  }
}
