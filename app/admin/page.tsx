import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { DashboardDataTable } from '@/components/dashboard-data-table';
import { GroupContributionSettings } from '@/components/group-contribution-settings';
import { AdminCycleManager } from '@/components/admin-cycle-manager';

const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0);

export default async function Admin() {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect('/login');
  const { data: p } = await s.from('profiles').select('role,full_name').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/dashboard');

  const [membersResult, activeResult, requestsResult, contributionsResult, transactionsResult,
    pendingContributionsResult, pendingWithdrawalsResult, groupsResult, membersListResult, cyclesResult] = await Promise.all([
    s.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'member'),
    s.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'member').eq('is_active', true),
    s.from('withdrawal_requests').select('id,status,created_at,member:profiles!withdrawal_requests_member_id_fkey(full_name)').order('created_at', { ascending: false }).limit(100),
    s.from('contributions').select('id,amount,status,paid_at,created_at,payment_reference,member:profiles!contributions_member_id_fkey(full_name),cycle:contribution_cycles!contributions_cycle_id_fkey(month_label,cycle_number)').order('created_at', { ascending: false }).limit(100),
    s.from('transactions').select('amount').eq('transaction_type', 'contribution').limit(1000),
    s.from('contributions').select('id', { count: 'exact', head: true }).in('status', ['pending', 'submitted']),
    s.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    s.from('group_settings').select('id,group_name,contribution_level,circle_number,contribution_amount,cycle_frequency,max_members,group_status,current_position,withdrawal_enabled').not('contribution_level', 'is', null).order('contribution_level').order('circle_number'),
    s.from('profiles').select('id,full_name,position_number,contribution_level,group_id,phone,bank_name,bank_account_name,bank_account_number,is_active,created_at').eq('role', 'member').order('position_number', { ascending: true, nullsFirst: false }).limit(500),
    s.from('contribution_cycles').select('id,cycle_number,month_label,contribution_amount,status,due_date,cancelled_at,cancellation_reason').order('created_at', { ascending: false }).limit(100),
  ]);

  const requests = requestsResult.data || [];
  const contributions = contributionsResult.data || [];
  const members = membersListResult.data || [];
  const groups = groupsResult.data || [];
  const cycles = cyclesResult.data || [];
  const received = (transactionsResult.data || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const pendingPayments = pendingContributionsResult.count ?? 0;
  const pendingWithdrawals = pendingWithdrawalsResult.count ?? 0;

  const withdrawalRows = requests.map(r => ({
    id: r.id, status: r.status,
    search: [r.member?.[0]?.full_name, r.status, r.id].join(' '),
    cells: [r.member?.[0]?.full_name || 'Member', new Date(r.created_at).toLocaleDateString('en-NG'), r.status],
  }));
  const paymentRows = contributions.map(c => ({
    id: c.id, status: c.status,
    search: [c.member?.[0]?.full_name, c.status, c.payment_reference, c.cycle?.[0]?.month_label, c.cycle?.[0]?.cycle_number].join(' '),
    cells: [c.member?.[0]?.full_name || 'Member', c.cycle?.[0]?.month_label ? c.cycle?.[0]?.month_label + ' · #' + c.cycle?.[0]?.cycle_number : 'Cycle', money(Number(c.amount)), c.status, c.paid_at ? new Date(c.paid_at).toLocaleString('en-NG') : '—'],
  }));

  return <main className="container dashboard-shell">
    <header className="nav dashboard-nav"><Link href="/" className="brand">contribution<span>circle.</span></Link><div className="nav-actions"><span className="admin-greeting">{p?.full_name || 'Administrator'}</span><span className="pill admin-role">Administrator</span><form action="/auth/signout" method="post"><button className="btn btn-secondary">Log out</button></form></div></header>
    <div className="layout dashboard-layout">
      <aside className="sidebar card dashboard-sidebar"><div className="eyebrow sidebar-eyebrow">Admin workspace</div><nav className="menu"><Link className="active" href="/admin">Overview</Link><a href="#members">Members</a><a href="#group-setup">Contribution circles</a><a href="#cycle-management">Contribution cycles</a><a href="#requests">Withdrawal requests</a><a href="#contributions">Contribution payments</a></nav><div className="member-id"><span>Signed in as</span><strong>Administrator</strong></div></aside>
      <section className="main dashboard-main">
        <div className="dashboard-heading"><div><div className="eyebrow">Control center</div><h1>Administrator overview</h1><p className="muted">Manage separate contribution circles, member rosters, payout rotations and payments.</p></div></div>
        <div className="stats-grid admin-stats">
          <article className="card stat-card"><span className="stat-icon">♙</span><span className="stat-label">Registered members</span><strong>{membersResult.count ?? 0}</strong><small>All member accounts</small></article>
          <article className="card stat-card"><span className="stat-icon">✓</span><span className="stat-label">Active members</span><strong>{activeResult.count ?? 0}</strong><small>Currently active</small></article>
          <article className="card stat-card"><span className="stat-icon">₦</span><span className="stat-label">Total received</span><strong>{money(received)}</strong><small>Verified contribution transactions</small></article>
          <article className="card stat-card"><span className="stat-icon">◷</span><span className="stat-label">Pending contributions</span><strong>{pendingPayments}</strong><small>Awaiting payment confirmation</small></article>
          <article className="card stat-card"><span className="stat-icon">↗</span><span className="stat-label">Pending withdrawals</span><strong>{pendingWithdrawals}</strong><small>Require administrator review</small></article>
        </div>
        <section id="group-setup"><GroupContributionSettings groups={groups} members={members} /></section>
        <AdminCycleManager cycles={cycles} />
        <section id="members" className="card dashboard-section"><div className="section-heading"><div><h2>All registered members</h2><p>Members are numbered independently inside their selected contribution circle.</p></div><span className="section-count">{members.length} members</span></div>
          <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Member</th><th>Level / circle</th><th>Number</th><th>Contribution</th><th>Status</th><th>Bank</th><th>Account name</th><th>Account number</th><th>Phone</th></tr></thead><tbody>{members.length ? members.map(m => { const group = groups.find(g => g.id === m.group_id); return <tr key={m.id}><td>{m.full_name || 'Member'}</td><td>{group ? group.group_name : 'Not assigned'}</td><td>{m.position_number ? '#' + String(m.position_number).padStart(3, '0') : '—'}</td><td>{group ? money(Number(group.contribution_amount)) : m.contribution_level ? money(Number(m.contribution_level)) : 'Not selected'}</td><td><span className="pill">{m.is_active ? 'Active' : 'Inactive'}</span></td><td>{m.bank_name || '—'}</td><td>{m.bank_account_name || '—'}</td><td>{m.bank_account_number || '—'}</td><td>{m.phone || '—'}</td></tr>; }) : <tr><td colSpan={9} className="table-empty">No registered members yet.</td></tr>}</tbody></table></div>
        </section>
        <section id="requests" className="card dashboard-section"><div className="section-heading"><div><h2>Withdrawal requests</h2><p>Review each request. Confirm payment only after independently verifying the transfer.</p></div><span className="section-count">{pendingWithdrawals} pending</span></div><DashboardDataTable mode="withdrawals" rows={withdrawalRows} searchPlaceholder="Search members or request IDs" emptyMessage="There are no withdrawal requests yet."/></section>
        <section id="contributions" className="card dashboard-section"><div className="section-heading"><div><h2>Member contribution payments</h2><p>Monitor payment activity and Paystack verification status.</p></div><span className="section-count">{contributions.length} recent records</span></div><DashboardDataTable mode="payments" rows={paymentRows} searchPlaceholder="Search member, cycle or reference" emptyMessage="No member contribution payments yet."/></section>
      </section>
    </div>
  </main>;
}
