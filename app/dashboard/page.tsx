import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase-server';
import {WithdrawalButton} from '@/components/withdrawal-button';
import {LogoutButton} from '@/components/logout-button';

export default async function Dashboard(){
 const s=await createClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user)redirect('/login');
 const {data:profile}=await s.from('profiles').select('id,full_name,position_number,bank_account_number').eq('id',user.id).maybeSingle();
 if(!profile?.bank_account_number)redirect('/onboarding/bank');
 const [{data:current},{data:cycles},{data:settings}]=await Promise.all([
  s.rpc('get_current_recipient_public'),
  s.from('contribution_cycles').select('id,cycle_number,month_label,contribution_amount,status,due_date').order('cycle_number',{ascending:false}).limit(6),
  s.from('group_settings').select('withdrawal_enabled').limit(1).maybeSingle()
 ]);
 const recipient=Array.isArray(current)?current[0]:current;
 const withdrawalEnabled=settings?.withdrawal_enabled===true;
 const isCurrentRecipient=recipient?.member_id===user.id;
 return <main className="container">
  <header className="nav"><Link href="/" className="brand">contribution<span>circle.</span></Link><div style={{display:'flex',alignItems:'center',gap:12}}><span className="muted" style={{fontSize:13}}>Hello, {profile?.full_name||'Member'}</span><LogoutButton/></div></header>
  <div className="layout">
   <aside className="sidebar card" style={{padding:15}}><div className="eyebrow" style={{padding:'8px 12px'}}>Member workspace</div><nav className="menu"><Link className="active" href="/dashboard">Overview</Link><a href="#cycles">Contribution cycles</a><Link href="/withdrawal">My withdrawals</Link><a href="/onboarding/bank">Bank details</a></nav><div style={{marginTop:30,padding:12,background:'#f6f8f6',borderRadius:12}}><small className="muted">Your member ID</small><strong style={{display:'block',fontSize:12,marginTop:5}}>{profile?.id?.slice(0,8).toUpperCase()}</strong></div></aside>
   <section className="main">
    <div style={{marginBottom:20}}><div className="eyebrow">Member dashboard</div><h1 style={{fontSize:30,margin:'8px 0'}}>Your contribution overview</h1><p className="muted" style={{fontSize:14}}>Your group activity and current recipient, in one place.</p></div>
    <section className="recipient">
     <div className="eyebrow" style={{color:'#b7e1cb'}}>Current contribution recipient</div>
     {recipient?<><h2 style={{fontSize:28,margin:'10px 0 4px'}}>{recipient.full_name}</h2><div className="muted">Member position #{recipient.position_number}</div>
      {isCurrentRecipient&&(withdrawalEnabled?<div style={{marginTop:18}}><WithdrawalButton/></div>:<p className="muted" style={{fontSize:13,marginTop:18}}>Your turn is next, but the administrator has not activated your withdrawal button yet.</p>)}
     </>:<><h2 style={{fontSize:24}}>No active recipient yet</h2><p className="muted">Your administrator needs to set up the group and first rotation.</p></>}
    </section>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:13,marginTop:17}}><div className="card stat"><span className="muted" style={{fontSize:12}}>Your position</span><strong>{profile?.position_number??'—'}</strong></div><div className="card stat"><span className="muted" style={{fontSize:12}}>Group status</span><strong style={{fontSize:19}}>Active group</strong></div></div>
    <section id="cycles" className="card" style={{marginTop:18,padding:20}}><h3>Recent contribution cycles</h3><div className="table-wrap"><table><thead><tr><th>Cycle</th><th>Month</th><th>Contribution</th><th>Status</th></tr></thead><tbody>{cycles?.length?cycles.map(c=><tr key={c.id}><td>#{c.cycle_number}</td><td>{c.month_label}</td><td>{c.contribution_amount??'—'}</td><td><span className="pill">{c.status}</span></td></tr>):<tr><td colSpan={4} className="muted">No contribution cycles have been created yet.</td></tr>}</tbody></table></div></section>
   </section>
  </div>
 </main>;
}
