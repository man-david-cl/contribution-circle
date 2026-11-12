import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { PayContributionButton } from '@/components/pay-contribution-button';

export default async function ContributePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('is_active,full_name').eq('id', user.id).single();
  if (!profile?.is_active) redirect('/dashboard');

  const { data: cycles } = await supabase.from('contribution_cycles')
    .select('id,cycle_number,month_label,contribution_amount,status,due_date')
    .in('status', ['open', 'collecting']).order('cycle_number', { ascending: false });

  const { data: myContributions } = await supabase.from('contributions')
    .select('cycle_id,status,paid_at')
    .eq('member_id', user.id);

  const paidCycleIds = new Set((myContributions || []).filter(c => c.status === 'verified').map(c => c.cycle_id));

  return <main className="container">
    <header className="nav"><Link href="/" className="brand">contribution<span>circle.</span></Link><Link href="/dashboard" className="btn btn-secondary">Back to dashboard</Link></header>
    <section className="card" style={{ maxWidth: 760, margin: '40px auto', padding: 24 }}>
      <div className="eyebrow">Member payments</div>
      <h1 style={{ fontSize: 30, margin: '8px 0' }}>Pay your contribution</h1>
      <p className="muted">Choose an active cycle and complete payment securely through Paystack.</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        {cycles?.length ? cycles.map(cycle => {
          const paid = paidCycleIds.has(cycle.id);
          return <div key={cycle.id} className="card" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div><strong>{cycle.month_label} · Cycle #{cycle.cycle_number}</strong><div className="muted" style={{ fontSize: 13, marginTop: 5 }}>Due {cycle.due_date ? new Date(cycle.due_date).toLocaleDateString() : 'date not set'}</div><div style={{ marginTop: 8, fontWeight: 700 }}>₦{Number(cycle.contribution_amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div></div>
            {paid ? <span className="pill">Payment confirmed</span> : <PayContributionButton cycleId={cycle.id} />}
          </div>;
        }) : <p className="muted">There are no open contribution cycles. Please contact your administrator.</p>}
      </div>
    </section>
  </main>;
}
