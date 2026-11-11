import {redirect} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase-server';
import {AdminActions} from '@/components/admin-actions';
import {WithdrawalControls} from '@/components/withdrawal-controls';

export default async function Admin(){
 const s=await createClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user)redirect('/login');
 const {data:p}=await s.from('profiles').select('role,full_name').eq('id',user.id).single();
 if(p?.role!=='admin')redirect('/dashboard');
 const [{data:requests},{count:members},{data:settings},{data:current}] = await Promise.all([
  s.from('withdrawal_requests').select('id,status,created_at,member:profiles!withdrawal_requests_member_id_fkey(full_name)').order('created_at',{ascending:false}).limit(50),
  s.from('profiles').select('*',{count:'exact',head:true}),
  s.from('group_settings').select('withdrawal_enabled').limit(1).maybeSingle(),
  s.rpc('get_current_recipient')
 ]);
 const recipient=Array.isArray(current)?current[0]:current;
 const withdrawalEnabled=settings?.withdrawal_enabled===true;
 return <main className="container">
  <header className="nav"><Link href="/" className="brand">contribution<span>circle.</span></Link><span className="pill">Administrator</span></header>
  <div className="layout">
   <aside className="sidebar card" style={{padding:15}}><div className="eyebrow" style={{padding:'8px 12px'}}>Admin workspace</div><nav className="menu"><Link className="active" href="/admin">Overview</Link><a href="#recipient">Next recipient</a><a href="#controls">Withdrawal access</a><a href="#requests">Withdrawal requests</a></nav></aside>
   <section className="main">
    <div className="eyebrow">Control center</div><h1 style={{fontSize:30}}>Administrator dashboard</h1>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:13,margin:'20px 0'}}>
     <div className="card stat"><span className="muted">Registered members</span><strong>{members??0}</strong></div>
     <div className="card stat"><span className="muted">Withdrawal requests</span><strong>{requests?.length??0}</strong></div>
    </div>
    <section id="recipient" className="card" style={{padding:20,marginBottom:18}}>
     <div className="eyebrow">Rotation schedule</div>
     <h3 style={{marginTop:6}}>Next person to receive the contribution</h3>
     {recipient?<><div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',margin:'12px 0'}}><h2 style={{fontSize:25,margin:0}}>{recipient.full_name||'Member'}</h2><span className="pill">Next to withdraw</span></div>
      <p className="muted" style={{fontSize:13}}>Member position #{recipient.position_number}</p>
      <div className="recipient-grid">
       <div><small>Bank</small><strong>{recipient.bank_name||'Not provided'}</strong></div>
       <div><small>Account name</small><strong>{recipient.bank_account_name||'Not provided'}</strong></div>
       <div><small>Account number</small><strong>{recipient.bank_account_number||'Not provided'}</strong></div>
       <div><small>Phone number</small><strong>{recipient.phone||'Not provided'}</strong></div>
      </div>
     </>:<><h2 style={{fontSize:20}}>No next recipient is assigned</h2><p className="muted" style={{fontSize:13}}>Set up the group rotation and assign the next position before enabling withdrawals.</p></>}
    </section>
    <section id="controls" className="card" style={{padding:20,marginBottom:18}}>
     <h3>Withdrawal access for next recipient</h3>
     <p className="muted" style={{fontSize:13}}>{recipient?'This control enables or disables the Withdraw button only for '+(recipient.full_name||'the current recipient')+' at position #'+recipient.position_number+'. Other members cannot request a withdrawal.':'Withdrawal access stays unavailable until a next recipient is assigned.'}</p>
     <WithdrawalControls enabled={withdrawalEnabled} recipientName={recipient?.full_name||null} positionNumber={recipient?.position_number??null} hasRecipient={Boolean(recipient)}/>
     <div style={{borderTop:'1px solid #e5e7eb',marginTop:22,paddingTop:18}}>
      <h3 style={{color:'#a12b2b'}}>Permanently delete Vercel project</h3>
      <p className="muted" style={{fontSize:13}}>This opens Vercel's official project deletion settings. You must sign in to Vercel and confirm deletion there. This does not delete your GitHub repository or Supabase project.</p>
      <a className="btn btn-danger" href="https://vercel.com/d?to=%2Fdavidcelestine121-2751%2Fcontribution-circle%2Fsettings%2Fgeneral%23delete-project&title=Review+in+Vercel" target="_blank" rel="noopener noreferrer">Open Vercel deletion settings</a>
     </div>
    </section>
    <section id="requests" className="card" style={{padding:20}}>
     <h3>Withdrawal requests</h3><p className="muted" style={{fontSize:13}}>Review requests. Mark a request paid only after you have independently verified the transfer.</p>
     <div className="table-wrap"><table><thead><tr><th>Member</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {requests?.length?requests.map((r:any)=><tr key={r.id}><td>{r.member?.full_name||'Member'}</td><td>{new Date(r.created_at).toLocaleDateString()}</td><td><span className="pill">{r.status}</span></td><td><AdminActions id={r.id} status={r.status}/></td></tr>):<tr><td colSpan={4} className="muted">No requests yet.</td></tr>}
     </tbody></table></div>
    </section>
   </section>
  </div>
 </main>;
}
