import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { WithdrawalButton } from '@/components/withdrawal-button';
import { DashboardDataTable } from '@/components/dashboard-data-table';

const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0);

export default async function Dashboard() {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await s.from('profiles').select('*').eq('id', user.id).single();
  if (!profile?.bank_account_number) redirect('/onboarding/bank');
  if (!profile?.contribution_level || !profile?.group_id) redirect('/dashboard/levels');

  const [{ data: current }, { data: roster }, { data: myRequests }, { data: cycles }, { data: myContributions },
    withdrawalCountResult, pendingCountResult, settingsResult] = await Promise.all([
    s.rpc('get_current_recipient_public'),
    s.rpc('get_my_contribution_group_members'),
    s.from('withdrawal_requests').select('id,status,created_at,cycle_id').eq('member_id', user.id).order('created_at', { ascending: false }).limit(20),
    s.from('contribution_cycles').select('id,cycle_number,month_label,contribution_amount,status,due_date').eq('group_id', profile.group_id).order('cycle_number', { ascending: false }).limit(6),
    s.from('contributions').select('id,amount,status,paid_at,created_at,payment_reference,cycle:contribution_cycles!contributions_cycle_id_fkey(month_label,cycle_number)').eq('member_id', user.id).order('created_at', { ascending: false }).limit(1000),
    s.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('member_id', user.id),
    s.from('contributions').select('id', { count: 'exact', head: true }).eq('member_id', user.id).in('status', ['pending', 'submitted']),
    s.from('group_settings').select('withdrawal_enabled').eq('id', profile.group_id).maybeSingle(),
  ]);

  const recipient = Array.isArray(current) ? current[0] : current;
  const group = roster?.[0];
  const withdrawalEnabled = settingsResult.data?.withdrawal_enabled === true;
  const isCurrentRecipient = recipient?.member_id === user.id;
  const paid = (myContributions || []).filter(c => c.status === 'verified');
  const totalPaid = paid.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const pending = pendingCountResult.count ?? 0;
  const paymentRows = (myContributions || []).map(c => ({ id: c.id, status: c.status, search: [c.status, c.payment_reference, c.cycle?.[0]?.month_label, c.cycle?.[0]?.cycle_number].join(' '), cells: ['You', c.cycle?.[0]?.month_label ? c.cycle?.[0]?.month_label + ' · #' + c.cycle?.[0]?.cycle_number : 'Cycle', money(Number(c.amount)), c.status, c.paid_at ? new Date(c.paid_at).toLocaleDateString('en-NG') : '—'] }));
  const withdrawalRows = (myRequests || []).map(r => ({ id: r.id, status: r.status, search: [r.status, r.id].join(' '), cells: [new Date(r.created_at).toLocaleDateString('en-NG'), r.status, r.id.slice(0, 8)] }));

  return <main className="container dashboard-shell">
    <header className="nav dashboard-nav"><Link href="/" className="brand">contribution<span>circle.</span></Link><div className="nav-actions"><span className="member-greeting">Hello, {profile.full_name || 'Member'}</span><form action="/auth/signout" method="post"><button className="btn btn-secondary">Log out</button></form></div></header>
    <div className="layout dashboard-layout">
      <aside className="sidebar card dashboard-sidebar"><div className="eyebrow sidebar-eyebrow">Member workspace</div><nav className="menu"><Link className="active" href="/dashboard">Overview</Link><Link href="/dashboard/levels">My contribution level</Link><Link href="/dashboard/contribute">Make a deposit</Link><a href="#circle-roster">My circle</a><a href="#cycles">Contribution cycles</a><a href="#payments">Payment history</a><a href="#withdrawals">My withdrawals</a><Link href="/onboarding/bank">Bank details</Link></nav><div className="member-id"><span>Circle number</span><strong>{String(profile.position_number || 0).padStart(3, '0')}</strong></div></aside>
      <section className="main dashboard-main">
        <div className="dashboard-heading"><div><div className="eyebrow">Member dashboard</div><h1>Good to see you, {profile.full_name?.split(' ')[0] || 'Member'}.</h1><p className="muted">You belong to {group?.group_name || 'your contribution circle'} with a contribution of {money(Number(group?.contribution_amount || profile.contribution_level))} per cycle.</p></div><Link href="/dashboard/contribute" className="btn btn-primary">Make a contribution <span aria-hidden="true">↗</span></Link></div>
        <div className="stats-grid member-stats">
          <article className="card stat-card"><span className="stat-icon">◎</span><span className="stat-label">Your circle number</span><strong>#{String(profile.position_number || 0).padStart(3, '0')}</strong><small>Number within your level</small></article>
          <article className="card stat-card"><span className="stat-icon">₦</span><span className="stat-label">Your contribution level</span><strong>{money(Number(group?.contribution_amount || profile.contribution_level))}</strong><small><Link href="/dashboard/levels">Change level</Link></small></article>
          <article className="card stat-card"><span className="stat-icon">◷</span><span className="stat-label">Pending payments</span><strong>{pending}</strong><small>Awaiting confirmation</small></article>
          <article className="card stat-card"><span className="stat-icon">↗</span><span className="stat-label">Withdrawal requests</span><strong>{withdrawalCountResult.count ?? 0}</strong><small>Requests on your account</small></article>
        </div>
        <section className="recipient recipient-panel"><div className="recipient-topline"><div><div className="eyebrow recipient-eyebrow">{group?.group_name || 'Your circle'} · payout rotation</div><h2>{recipient?.full_name || 'No active recipient yet'}</h2><p>{recipient ? 'This is the member currently scheduled to receive your circle’s contribution pool.' : 'Your administrator needs to configure the rotation for your circle.'}</p></div>{recipient && <span className="recipient-position">Position #{recipient.position_number}</span>}</div>{isCurrentRecipient && <div className="recipient-action">{withdrawalEnabled ? <WithdrawalButton /> : <p className="muted">It is your turn, but the administrator has not enabled withdrawal access for this circle yet.</p>}</div>}</section>
        <section id="circle-roster" className="card dashboard-section"><div className="section-heading"><div><h2>{group?.group_name || 'Your contribution circle'} members</h2><p>Only members in your selected level and circle appear in this rotation.</p></div><span className="section-count">{roster?.length || 0} members</span></div>
          <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Number</th><th>Member name</th><th>Rotation status</th></tr></thead><tbody>{roster?.length ? roster.map((member: { member_id: string; position_number: number; full_name: string | null; is_current_recipient: boolean }) => <tr key={member.member_id}><td>#{String(member.position_number).padStart(3, '0')}</td><td>{member.full_name || 'Member'}{member.member_id === user.id ? ' (You)' : ''}</td><td>{member.is_current_recipient ? 'Current recipient' : 'Waiting'}</td></tr>) : <tr><td colSpan={3} className="table-empty">Your circle roster will appear here.</td></tr>}</tbody></table></div>
        </section>
        <section id="payments" className="card dashboard-section"><div className="section-heading"><div><h2>Payment history</h2><p>Track your contribution payments and verification status.</p></div><Link href="/dashboard/contribute">Pay now ↗</Link></div><DashboardDataTable mode="payments" rows={paymentRows} searchPlaceholder="Search payments or cycles" emptyMessage="No contribution payments found yet."/></section>
        <section id="cycles" className="card dashboard-section"><div className="section-heading"><div><h2>Recent contribution cycles</h2><p>Cycles for your circle only.</p></div></div><div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Cycle</th><th>Month</th><th>Contribution</th><th>Due date</th><th>Status</th></tr></thead><tbody>{cycles?.length ? cycles.map(c => <tr key={c.id}><td>#{c.cycle_number}</td><td>{c.month_label}</td><td>{money(Number(c.contribution_amount || 0))}</td><td>{c.due_date ? new Date(c.due_date + 'T00:00:00').toLocaleDateString('en-NG') : '—'}</td><td><span className="pill">{c.status}</span></td></tr>) : <tr><td colSpan={5} className="table-empty">No contribution cycles have been created for your circle yet.</td></tr>}</tbody></table></div></section>
        <section id="withdrawals" className="card dashboard-section"><div className="section-heading"><div><h2>My withdrawal requests</h2><p>Review the latest status of your requests.</p></div></div><DashboardDataTable mode="member-withdrawals" rows={withdrawalRows} searchPlaceholder="Search withdrawal requests" emptyMessage="You have no withdrawal requests."/></section>
      </section>
    </div>
  </main>;
}
