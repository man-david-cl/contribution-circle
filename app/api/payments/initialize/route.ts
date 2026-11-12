import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { initializePaystackPayment } from '@/lib/paystack';

export const runtime = 'nodejs';

const ALLOWED_LEVELS = [10000, 20000, 30000, 40000, 50000];

export async function POST(request: Request) {
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
      .select('id,status,month_label')
      .eq('id', cycleId)
      .in('status', ['open', 'collecting'])
      .single();
    if (cycleError || !cycle) return NextResponse.json({ error: 'This contribution cycle is not open for payment.' }, { status: 404 });

    const { data: profile } = await admin
      .from('profiles').select('is_active,contribution_level').eq('id', user.id).single();
    if (!profile?.is_active) return NextResponse.json({ error: 'Your membership is not active.' }, { status: 403 });

    const amount = Number(profile.contribution_level);
    if (!ALLOWED_LEVELS.includes(amount)) {
      return NextResponse.json({ error: 'Choose a contribution level before making a deposit.' }, { status: 409 });
    }
    const amountKobo = Math.round(amount * 100);
    if (!Number.isSafeInteger(amountKobo)) {
      return NextResponse.json({ error: 'Your selected contribution level is invalid.' }, { status: 400 });
    }

    const { data: existing } = await admin.from('contributions')
      .select('id,status')
      .eq('cycle_id', cycleId).eq('member_id', user.id).maybeSingle();
    if (existing?.status === 'verified') {
      return NextResponse.json({ error: 'Your contribution for this cycle is already confirmed.' }, { status: 409 });
    }

    const reference = `CC-${randomUUID()}`;
    const contributionPayload = {
      cycle_id: cycleId,
      member_id: user.id,
      amount,
      status: 'pending',
      payment_reference: reference,
    };
    const { error: saveError } = existing
      ? await admin.from('contributions').update(contributionPayload).eq('id', existing.id)
      : await admin.from('contributions').insert(contributionPayload);
    if (saveError) throw saveError;

    const origin = new URL(request.url).origin;
    const payment = await initializePaystackPayment({
      email: user.email,
      amountKobo,
      reference,
      callbackUrl: `${origin}/payments/callback`,
      metadata: { contribution_cycle_id: cycleId, member_id: user.id, contribution_level: amount },
    });

    return NextResponse.json({ authorizationUrl: payment.authorization_url });
  } catch (error) {
    console.error('Paystack initialization failed:', error);
    return NextResponse.json({ error: 'Unable to start payment. Please try again.' }, { status: 500 });
  }
}
