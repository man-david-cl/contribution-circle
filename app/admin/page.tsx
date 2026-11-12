import {redirect} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase-server';
import {DashboardDataTable} from '@/components/dashboard-data-table';
import {WithdrawalControls} from '@/components/withdrawal-controls';
import {GroupContributionSettings} from '@/components/group-contribution-settings';
import {OpenInitialCycle} from '@/components/open-initial-cycle';

const money=(value:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(value||0);

export default async function Admin(){
 const s=await createClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user)redirect('/login');
 const {data:p}=await s.from('profiles').select('role,full_name').eq('id',user.id).single();
 if(p?.role!=='admin')redirect('/dashboard');

 const [membersResult,activeResult,requestsResult,contributionsResult,transactionsResult,pendingContributionsResult,pendingWithdrawalsResult,settingsResult,recipientResult,membersListResult,openCycleResult]=await Promise.all([
  s.from('profiles').select('id',{count:'exact',head:true}).eq('role','member'),
  s.from('profiles').select('id',{count:'exact',head:true}).eq('role','member').eq('is_active',true),
  s.from('withdrawal_requests').select('id,status,created_at,member:profiles!withdrawal_requests_member_id_fkey(full_name)').order('created_at',{ascending:false}).limit(100),
  s.from('contributions').select('id,amount,status,paid_at,created_at,payment_reference,member:profiles!contributions_member_id_fkey(full_name),cycle:contribution_cycles!contributions_cycle_id_fkey(month_label,cycle_number)').order('created_at',{ascending:false}).limit(100),
  s.from('transactions').select('amount').eq('transaction_type','contribution').limit(1000),
  s.from('contributions').select('id',{count:'exact',head:true}).in('status',['pending','submitted']),
  s.from('withdrawal_requests').select('id',{count:'exact',head:true}).eq('status','pending'),
  s.from('group_settings').select('withdrawal_enabled,contribution_amount,cycle_frequency').order('created_at',{ascending:true}).limit(1).maybeSingle(),
  s.rpc('admin_get_current_recipient'),
  s.from('profiles').select('id,full_name,position_number,contribution_level,phone,bank_name,bank_account_name,bank_account_number,is_active,created_at').eq('role','member').order('position_number',{ascending:true,nullsFirst:false}).limit(500),
  s.from('contribution_cycles').select('id').in('status',['open','collecting']).order('cycle_number',{ascending:false}).limit(1).maybeSingle()
 ]);
 const requests=requestsResult.data||[];
 const contributions=contributionsResult.data||[];
 const membersList=membersListResult.data||[];
 const recipient=Array.isArray(recipientResult.data)?recipientResult.data[0]:recipientResult.data;
 const settings=settingsResult.data;
 const received=(transactionsResult.data||[]).reduce((sum,t)=>sum+Number(t.amount||0),0);
 const pendingPayments=pendingContributionsResult.count??0;
 const pendingWithdrawals=pendingWithdrawalsResult.count??0;
 const withdrawalEnabled=settings?.withdrawal_enabled===true;
 const withdrawalRows=requests.map(r=>({id:r.id,status:r.status,search:[r.member?.[0]?.full_name,r.status,r.id].join(' '),cells:[r.member?.[0]?.full_name||'Member',new Date(r.created_at).toLocaleDateString('en-NG'),r.status]}));
 const paymentRows=contributions.map(c=>({id:c.id,status:c.status,search:[c.member?.[0]?.full_name,c.status,c.payment_reference,c.cycle?.[0]?.month_label,c.cycle?.[0]?.cycle_number].join(' '),cells:[c.member?.[0]?.full_name||'Member',c.cycle?.[0]?.month_label?c.cycle?.[0]?.month_label+' · #'+c.cycle?.[0]?.cycle_number:'Cycle',money(Number(c.amount)),c.status,c.paid_at?new Date(c.paid_at).toLocaleString('en-NG'):'—']}));
 return <main className="container dashboard-shell">
  <header className="nav dashboard-nav"><Link href="/" className="brand">contribution<span>circle.</span></Link><div className="nav-actions"><span className="admin-greeting">{p?.full_name||'Administrator'}</span><span className="pill admin-role">Administrator</span><form action="/auth/signout" method="post"><button className="btn btn-secondary">Log out</button></form></div></header>
  <div className="layout dashboard-layout">
   <aside className="sidebar card dashboard-sidebar"><div className="eyebrow sidebar-eyebrow">Admin workspace</div><nav className="menu"><Link className="active" href="/admin">Overview</Link><a href="#members">Members</a><a href="#recipient">Next recipient</a><a href="#group-setup">Group setup</a><a href="#withdrawal-access">Withdrawal access</a><a href="#requests">Withdrawal requests</a><a href="#contributions">Contribution payments</a></nav><div className="member-id"><span>Signed in as</span><strong>Administrator</strong></div></aside>
   <section className="main dashboard-main">
    <div className="dashboard-heading"><div><div className="eyebrow">Control center</div><h1>Administrator overview</h1><p className="muted">Manage your members, contribution rotation, withdrawal access and payments.</p></div></div>
    <div className="stats-grid admin-stats">
     <article className="card stat-card"><span className="stat-icon">♙</span><span className="stat-label">Registered members</span><strong>{membersResult.count??0}</strong><small>All member accounts</small></article>
     <article className="card stat-card"><span className="stat-icon">✓</span><span className="stat-label">Active members</span><strong>{activeResult.count??0}</strong><small>Currently active in the group</small></article>
     <article className="card stat-card"><span className="stat-icon">₦</span><span className="stat-label">Total received</span><strong>{money(received)}</strong><small>Verified contribution transactions</small></article>
     <article className="card stat-card"><span className="stat-icon">◷</span><span className="stat-label">Pending contributions</span><strong>{pendingPayments}</strong><small>Awaiting payment confirmation</small></article>
     <article className="card stat-card"><span className="stat-icon">↗</span><span className="stat-label">Pending withdrawals</span><strong>{pendingWithdrawals}</strong><small>Require administrator review</small></article>
    </div>
    <section id="recipient" className="recipient recipient-panel dashboard-section"><div className="recipient-topline"><div><div className="eyebrow recipient-eyebrow">Rotation schedule</div><h2>Next person to receive the contribution</h2><p>{recipient?'This is the member currently assigned to receive the group contribution.':'Assign an active member to the current rotation position before enabling withdrawals.'}</p></div>{recipient&&<span className="recipient-position">Position #{recipient.position_number}</span>}</div>{recipient?<div className="recipient-grid"><div><small>Recipient name</small><strong>{recipient.full_name||'Member'}</strong></div><div><small>Bank</small><strong>{recipient.bank_name||'Not provided'}</strong></div><div><small>Account name</small><strong>{recipient.bank_account_name||'Not provided'}</strong></div><div><small>Account number</small><strong>{recipient.bank_account_number||'Not provided'}</strong></div><div><small>Phone number</small><strong>{recipient.phone||'Not provided'}</strong></div></div>:<p className="muted">No eligible recipient with bank details is currently assigned to the active position.</p>}</section>
    <section id="withdrawal-access" className="card dashboard-section"><div className="section-heading"><div><h2>Withdrawal access for this turn</h2><p>{recipient?'Enable the Withdraw button for '+(recipient.full_name||'the current recipient')+' at position #'+recipient.position_number+'. When the rotation advances after payment is confirmed, access switches off automatically.':'Withdrawal access stays unavailable until an eligible recipient is assigned.'}</p></div><span className="section-count">{withdrawalEnabled?'Enabled':'Disabled'}</span></div><WithdrawalControls enabled={withdrawalEnabled} recipientName={recipient?.full_name||null} positionNumber={recipient?.position_number??null} hasRecipient={Boolean(recipient)}/></section>
    <section id="members" className="card dashboard-section"><div className="section-heading"><div><h2>Registered members and positions</h2><p>Bank and contact details are visible here to administrators for recipient verification.</p></div><span className="section-count">{membersList.length} members</span></div><div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Member</th><th>Position</th><th>Contribution level</th><th>Status</th><th>Bank</th><th>Account name</th><th>Account number</th><th>Phone</th></tr></thead><tbody>{membersList.length?membersList.map(m=><tr key={m.id}><td>{m.full_name||'Member'}</td><td>{m.position_number??'Unassigned'}</td><td>{m.contribution_level?'₦'+Number(m.contribution_level).toLocaleString('en-NG'):'Not selected'}</td><td><span className="pill">{m.is_active?'Active':'Inactive'}</span></td><td>{m.bank_name||'—'}</td><td>{m.bank_account_name||'—'}</td><td>{m.bank_account_number||'—'}</td><td>{m.phone||'—'}</td></tr>):<tr><td colSpan={8} className="table-empty">No registered members yet.</td></tr>}</tbody></table></div></section>
    <div id="group-setup"><GroupContributionSettings initialAmount={settings?.contribution_amount??null}/><OpenInitialCycle hasOpenCycle={Boolean(openCycleResult.data)} amount={settings?.contribution_amount??null} frequency={settings?.cycle_frequency??null} currentRecipient={recipient?.full_name||null}/></div>
    <section id="requests" className="card dashboard-section"><div className="section-heading"><div><h2>Withdrawal requests</h2><p>Review each request. Confirm payment only after independently verifying the transfer.</p></div><span className="section-count">{pendingWithdrawals} pending</span></div><DashboardDataTable mode="withdrawals" rows={withdrawalRows} searchPlaceholder="Search members or request IDs" emptyMessage="There are no withdrawal requests yet."/></section>
    <section id="contributions" className="card dashboard-section"><div className="section-heading"><div><h2>Member contribution payments</h2><p>Monitor payment activity and Paystack verification status.</p></div><span className="section-count">{contributions.length} recent records</span></div><DashboardDataTable mode="payments" rows={paymentRows} searchPlaceholder="Search member, cycle or reference" emptyMessage="No member contribution payments yet."/></section>
   </section>
  </div>
 </main>;
}
