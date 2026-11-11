import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase-server';
import {DepositForm} from '@/components/deposit-form';

export default async function DepositPage(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/login');
 const [{data:profile},{data:settings},{data:cycle},{data:deposits}]=await Promise.all([
  s.from('profiles').select('full_name').eq('id',user.id).maybeSingle(),
  s.from('group_settings').select('deposit_bank_name,deposit_account_name,deposit_account_number,paystack_enabled').limit(1).maybeSingle(),
  s.from('contribution_cycles').select('id,cycle_number,month_label,contribution_amount,status,due_date').in('status',['open','collecting']).order('cycle_number',{ascending:false}).limit(1).maybeSingle(),
  s.from('member_deposits').select('id,amount,payment_method,status,created_at,transfer_date,payment_reference').eq('member_id',user.id).order('created_at',{ascending:false}).limit(30)
 ]);
 const {data:approved}=await s.from('member_deposits').select('amount').eq('member_id',user.id).in('status',['approved','paid']);
 const total=(approved||[]).reduce((sum,x)=>sum+Number(x.amount||0),0);
 const pending=(deposits||[]).filter(x=>x.status==='pending').reduce((sum,x)=>sum+Number(x.amount||0),0);
 return <main className="container"><header className="nav"><Link href="/" className="brand">contribution<span>circle.</span></Link><span className="muted" style={{fontSize:13}}>Hello, {profile?.full_name||'Member'}</span></header>
 <div className="layout"><aside className="sidebar card" style={{padding:15}}><div className="eyebrow" style={{padding:'8px 12px'}}>Member workspace</div><nav className="menu"><Link href="/dashboard">Overview</Link><Link href="/dashboard#cycles">Contribution cycles</Link><Link className="active" href="/deposit">My deposits</Link><Link href="/withdrawal">My withdrawals</Link><Link href="/onboarding/bank">Bank details</Link></nav></aside>
 <section className="main"><div className="eyebrow">Member workspace</div><h1 style={{fontSize:30,margin:'8px 0'}}>My deposits</h1><p className="muted" style={{fontSize:14}}>Make your contribution and keep track of every payment.</p>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginTop:18}}><div className="card stat"><span className="muted" style={{fontSize:12}}>Confirmed deposits</span><strong>₦{total.toLocaleString('en-NG')}</strong></div><div className="card stat"><span className="muted" style={{fontSize:12}}>Pending deposits</span><strong>₦{pending.toLocaleString('en-NG')}</strong></div><div className="card stat"><span className="muted" style={{fontSize:12}}>Current cycle</span><strong style={{fontSize:20}}>{cycle?'#'+cycle.cycle_number:'Not open'}</strong></div></div>
 {cycle?<DepositForm amount={Number(cycle.contribution_amount)} bankName={settings?.deposit_bank_name||null} accountName={settings?.deposit_account_name||null} accountNumber={settings?.deposit_account_number||null} paystackEnabled={settings?.paystack_enabled===true}/>:<section className="card" style={{padding:20,marginTop:18}}><h3>No open contribution cycle</h3><p className="muted">The administrator must open a contribution cycle before you can submit a deposit.</p></section>}
 <section className="card" style={{padding:20,marginTop:18}}><h3>Deposit history</h3><div className="table-wrap"><table><thead><tr><th>Date</th><th>Method</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead><tbody>{deposits?.length?deposits.map(d=><tr key={d.id}><td>{new Date(d.created_at).toLocaleDateString()}</td><td>{d.payment_method==='paystack'?'Paystack':'Bank transfer'}</td><td>₦{Number(d.amount).toLocaleString('en-NG')}</td><td><span className="pill">{d.status}</span></td><td>{d.payment_reference||'—'}</td></tr>):<tr><td colSpan={5} className="muted">No deposits submitted yet.</td></tr>}</tbody></table></div></section>
 </section></div></main>;
}
