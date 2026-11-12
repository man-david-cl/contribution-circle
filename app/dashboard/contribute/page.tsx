import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { PayContributionButton } from '@/components/pay-contribution-button';

const money = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);

export default async function ContributePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('is_active,full_name,contribution_level,group_id').eq('id', user.id).single();
  if (!profile?.is_active) redirect('/dashboard');
  if (!profile?.contribution_level || !profile.group_id) redirect('/dashboard/levels');

  const { data: cycles } = await supabase.from('contribution_cycles')
    .select('id,cycle_number,month_label,status,due_date,contribution_amount')
    .eq('group_id', profile.group_id).in('status', ['open', 'collecting']).order('cycle_number', { ascending: false });
  const { data: myContributions } = await supabase.from('contributions').select('cycle_id,status,paid_at').eq('member_id', user.id);
  const paidCycleIds = new Set((myContributions || []).filter(c => c.status === 'verified').map(c => c.cycle_id));
  const paystackConfigured = Boolean(process.env.PAYSTACK_SECRET_KEY);

  return <main className="container dashboard-shell">
    <header className="nav dashboard-nav"><Link href="/" className="brand">contribution<span>circle.</span></Link><div className="nav-actions"><Link href="/dashboard/levels" className="btn btn-secondary">Change level</Link><Link href="/dashboard" className="btn btn-secondary">Back to dashboard</Link></div></header>
    <section className="card" style={{ maxWidth: 820, margin: '36px auto', padding: 26 }}>
      <div className="eyebrow">Member deposits</div>
      <h1 style={{ fontSize: 30, margin: '8px 0' }}>Make your contribution</h1>
      <p className="muted">Your contribution goes only into your Level {profile.contribution_level / 10000} circle. Other contribution levels have separate pools and payout rotations.</p>
      {!paystackConfigured && <div className="card" role="status" style={{ padding: 16, marginTop: 20 }}><strong>Online payments are not available yet.</strong><p className="muted" style={{ marginBottom: 0 }}>Payment-provider setup is still pending. No payment will be initiated until Paystack is configured.</p></div>}
      <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        {cycles?.length ? cycles.map(cycle => {
          const paid = paidCycleIds.has(cycle.id);
          return <div key={cycle.id} className="card" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div><strong>{cycle.month_label} · Cycle #{cycle.cycle_number}</strong><div className="muted" style={{ fontSize: 13, marginTop: 5 }}>Due {cycle.due_date ? new Date(cycle.due_date + 'T00:00:00').toLocaleDateString('en-NG') : 'date not set'}</div><div style={{ marginTop: 8, fontWeight: 700 }}>{money(Number(cycle.contribution_amount || profile.contribution_level))}</div></div>
            {paid ? <span className="pill">Payment confirmed</span> : paystackConfigured ? <PayContributionButton cycleId={cycle.id} /> : <span className="pill">Payments pending setup</span>}
          </div>;
        }) : <p className="muted">There are no open contribution cycles for your circle yet. Please contact your administrator.</p>}
      </div>
    </section>
  </main>;
}
