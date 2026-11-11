import {redirect} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase-server';
import {AdminActions} from '@/components/admin-actions';
import {WithdrawalControls} from '@/components/withdrawal-controls';
import {OpenInitialCycle} from '@/components/open-initial-cycle';
import {GroupContributionSettings} from '@/components/group-contribution-settings';

export default async function Admin(){
 const s=await createClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user)redirect('/login');
 const {data:p}=await s.from('profiles').select('role,full_name').eq('id',user.id).maybeSingle();
 if(p?.role!=='admin')redirect('/dashboard');
 const [{data:requests},{count:members},{data:settings},{data:current},{data:memberRows},{data:openCycle}] = await Promise.all([
  s.from('withdrawal_requests').select('id,status,created_at,member:profiles!withdrawal_requests_member_id_fkey(full_name)').order('created_at',{ascending:false}).limit(50),
  s.from('profiles').select('*',{count:'exact',head:true}),
  s.from('group_settings').select('withdrawal_enabled,contribution_amount,cycle_frequency').limit(1).maybeSingle(),
  s.rpc('admin_get_current_recipient'),
  s.from('profiles').select('id,full_name,position_number,phone,bank_name,bank_account_name,bank_account_number,is_active,created_at').order('position_number',{ascending:true,nullsFirst:false}),
  s.from('contribution_cycles').select('id').in('status',['open','collecting']).limit(1).maybeSingle()
 ]);
 const recipient=Array.isArray(current)?current[0]:current;
 const withdrawalEnabled=settings?.withdrawal_enabled===true;
 return <main className="container">
  <header className="nav"><Link href="/" className="brand">contribution<span>circle.</span></Link><span className="pill">Administrator</span></header>
  <div className="layout">
   <aside className="sidebar card" style={{padding:15}}><div className="eyebrow" style={{padding:'8px 12px'}}>Admin workspace</div><nav className="menu"><Link className="active" href="/admin">Overview</Link><a href="#members">Members</a><a href="#recipient">Next recipient</a><a href="#controls">Withdrawal access</a><a href="#requests">Withdrawal requests</a><Link href="/admin/deposits">Deposit management</Link></nav></aside>
   <section className="main">
    <div className="eyebrow">Control center</div><h1 style={{fontSize:30}}>Administrator dashboard</h1>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:13,margin:'20px 0'}}><div className="card stat"><span className="muted">Registered members</span><strong>{members??0}</strong></div><div className="card stat"><span className="muted">Withdrawal requests</span><strong>{requests?.length??0}</strong></div></div>
    <section id="members" className="card" style={{padding:20,marginBottom:18}}>
     <h3>Registered members and positions</h3><p className="muted" style={{fontSize:13}}>Private bank and contact details are shown here for administrators only.</p>
     <div className="table-wrap"><table><thead><tr><th>Member</th><th>Position</th><th>Status</th><th>Bank</th><th>Account name</th><th>Account number</th><th>Phone</th></tr></thead><tbody>
      {memberRows?.length?memberRows.map((m:any)=><tr key={m.id}><td>{m.full_name||'Member'}</td><td>{m.position_number??'Unassigned'}</td><td>{m.is_active?'Active':'Inactive'}</td><td>{m.bank_name||'—'}</td><td>{m.bank_account_name||'—'}</td><td>{m.bank_account_number||'—'}</td><td>{m.phone||'—'}</td></tr>):<tr><td colSpan={7} className="muted">No registered members yet.</td></tr>}
     </tbody></table></div>
    </section>
    <section id="recipient" className="card" style={{padding:20,marginBottom:18}}>
     <div className="eyebrow">Rotation schedule</div><h3 style={{marginTop:6}}>Next person to receive the contribution</h3>
     {recipient?<><div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',margin:'12px 0'}}><h2 style={{fontSize:25,margin:0}}>{recipient.full_name||'Member'}</h2><span className="pill">Next to withdraw</span></div><p className="muted" style={{fontSize:13}}>Member position #{recipient.position_number}</p>
      <div className="recipient-grid"><div><small>Bank</small><strong>{recipient.bank_name||'Not provided'}</strong></div><div><small>Account name</small><strong>{recipient.bank_account_name||'Not provided'}</strong></div><div><small>Account number</small><strong>{recipient.bank_account_number||'Not provided'}</strong></div><div><small>Phone number</small><strong>{recipient.phone||'Not provided'}</strong></div></div>
     </>:<><h2 style={{fontSize:20}}>No next recipient is assigned</h2><p className="muted" style={{fontSize:13}}>Set up the group rotation and assign the next position before enabling withdrawals.</p></>}
    </section>
    <GroupContributionSettings initialAmount={settings?.contribution_amount??null}/>
    <OpenInitialCycle hasOpenCycle={Boolean(openCycle)} amount={settings?.contribution_amount??null} frequency={settings?.cycle_frequency??null} currentRecipient={recipient?.full_name||null}/>
    <section id="controls" className="card" style={{padding:20,marginBottom:18}}>
     <h3>Withdrawal access for this turn</h3><p className="muted" style={{fontSize:13}}>{recipient?'Enable the Withdraw button for '+(recipient.full_name||'the current recipient')+' at position #'+recipient.position_number+'. After payment is confirmed and the turn advances, access automatically switches off. You must enable it again for the next recipient.':'Withdrawal access stays unavailable until a next recipient is assigned.'}</p>
     <WithdrawalControls enabled={withdrawalEnabled} recipientName={recipient?.full_name||null} positionNumber={recipient?.position_number??null} hasRecipient={Boolean(recipient)}/>
     <div style={{borderTop:'1px solid #e5e7eb',marginTop:22,paddingTop:18}}><h3 style={{color:'#a12b2b'}}>Permanently delete Vercel project</h3><p className="muted" style={{fontSize:13}}>This opens Vercel's official project deletion settings. You must sign in to Vercel and confirm deletion there. This does not delete your GitHub repository or Supabase project.</p><a className="btn btn-danger" href="https://vercel.com/d?to=%2Fdavidcelestine121-2751%2Fcontribution-circle%2Fsettings%2Fgeneral%23delete-project&title=Review+in+Vercel" target="_blank" rel="noopener noreferrer">Open Vercel deletion settings</a></div>
    </section>
    <section id="requests" className="card" style={{padding:20}}><h3>Withdrawal requests</h3><p className="muted" style={{fontSize:13}}>Review requests. Mark a request paid only after you have independently verified the transfer.</p><div className="table-wrap"><table><thead><tr><th>Member</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>{requests?.length?requests.map((r:any)=><tr key={r.id}><td>{r.member?.full_name||'Member'}</td><td>{new Date(r.created_at).toLocaleDateString()}</td><td><span className="pill">{r.status}</span></td><td><AdminActions id={r.id} status={r.status}/></td></tr>):<tr><td colSpan={4} className="muted">No requests yet.</td></tr>}</tbody></table></div></section>
   </section>
  </div>
 </main>;
}
