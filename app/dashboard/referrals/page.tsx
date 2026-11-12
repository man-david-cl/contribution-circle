import Link from 'next/link';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase-server';
import {ReferralLinkActions} from '@/components/referral-link-actions';

export default async function ReferralsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('id,full_name,bank_account_number,contribution_level').eq('id',user.id).single();
  if(!profile?.bank_account_number) redirect('/onboarding/bank');
  if(!profile?.contribution_level) redirect('/dashboard/levels');

  const {data,error}=await supabase.rpc('get_my_referrals');
  if(error) throw new Error('Referral information is not available yet. Apply the member referrals database migration first.');
  const referralRows=(data||[]) as Array<{referral_code:string;referred_member_id:string|null;referred_full_name:string|null;referred_at:string|null;referred_is_active:boolean|null}>;
  const referralCode=referralRows[0]?.referral_code;
  if(!referralCode) throw new Error('Your referral code could not be generated. Please contact an administrator.');
  const requestHeaders=await headers();
  const host=requestHeaders.get('x-forwarded-host')||requestHeaders.get('host');
  const protocol=requestHeaders.get('x-forwarded-proto')||'https';
  const baseUrl=(process.env.NEXT_PUBLIC_APP_URL|| (host?`${protocol}://${host}`:'http://localhost:3000')).replace(/\/$/,'');
  const referralUrl=`${baseUrl}/register?ref=${encodeURIComponent(referralCode)}`;
  const referrals=referralRows.filter(row=>row.referred_member_id);
  const activeCount=referrals.filter(row=>row.referred_is_active).length;

  return <main className="container dashboard-shell">
    <header className="nav dashboard-nav">
      <Link href="/" className="brand">contribution<span>circle.</span></Link>
      <div className="nav-actions"><span className="member-greeting">Hello, {profile.full_name||'Member'}</span><form action="/auth/signout" method="post"><button className="btn btn-secondary">Log out</button></form></div>
    </header>
    <div className="layout dashboard-layout">
      <aside className="sidebar card dashboard-sidebar">
        <div className="eyebrow sidebar-eyebrow">Member workspace</div>
        <nav className="menu">
          <Link href="/dashboard">Overview</Link><Link href="/dashboard/levels">My contribution level</Link><Link href="/dashboard/contribute">Make a deposit</Link><Link href="/dashboard/referrals" className="active">Refer a member</Link><a href="/dashboard#cycles">Contribution cycles</a><a href="/dashboard#payments">Payment history</a><a href="/dashboard#withdrawals">My withdrawals</a><Link href="/onboarding/bank">Bank details</Link>
        </nav>
        <div className="member-id"><span>Member ID</span><strong>{profile.id.slice(0,8).toUpperCase()}</strong></div>
      </aside>
      <section className="main dashboard-main">
        <div className="dashboard-heading"><div><div className="eyebrow">Grow your circle</div><h1>Invite someone to join.</h1><p className="muted">Share your personal referral link and see who has joined through you.</p></div></div>
        <section className="card referral-hero">
          <div className="eyebrow">Your personal referral link</div>
          <h2>Bring good people into your circle.</h2>
          <p>Anyone who registers using this link will be connected to your account as a referral.</p>
          <div className="referral-url" aria-label="Your referral URL">{referralUrl}</div>
          <ReferralLinkActions url={referralUrl}/>
          <small>Your referral code: <strong>{referralCode}</strong></small>
        </section>
        <div className="stats-grid member-stats">
          <article className="card stat-card"><span className="stat-icon">↗</span><span className="stat-label">People referred</span><strong>{referrals.length}</strong><small>Accounts registered with your link</small></article>
          <article className="card stat-card"><span className="stat-icon">✓</span><span className="stat-label">Active referrals</span><strong>{activeCount}</strong><small>Currently active member accounts</small></article>
        </div>
        <section className="card dashboard-section">
          <div className="section-heading"><div><h2>Your referrals</h2><p>Members who signed up using your personal link.</p></div><span className="section-count">{referrals.length} total</span></div>
          <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Member</th><th>Date joined</th><th>Account status</th></tr></thead><tbody>
            {referrals.length?referrals.map(row=><tr key={row.referred_member_id}><td>{row.referred_full_name||'Contribution Circle member'}</td><td>{row.referred_at?new Date(row.referred_at).toLocaleDateString('en-NG'):'—'}</td><td><span className="pill">{row.referred_is_active?'Active':'Inactive'}</span></td></tr>):<tr><td colSpan={3} className="table-empty">No referrals yet. Share your link to invite your first member.</td></tr>}
          </tbody></table></div>
        </section>
        <p className="muted referral-note">Referral tracking only: this feature does not currently offer cash rewards or change contribution and withdrawal amounts.</p>
      </section>
    </div>
  </main>;
}
