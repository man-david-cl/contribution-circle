import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase-server';
import {DepositSettings} from '@/components/deposit-settings';
import {DepositReview} from '@/components/deposit-review';

export default async function AdminDeposits(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await s.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='admin')redirect('/dashboard');
 const [{data:settings},{data:rows}]=await Promise.all([
  s.from('group_settings').select('deposit_bank_name,deposit_account_name,deposit_account_number,paystack_enabled').limit(1).maybeSingle(),
  s.from('member_deposits').select('id,member_id,amount,payment_method,status,created_at,receipt_path,payment_reference,member:profiles!member_deposits_member_id_fkey(full_name)').order('created_at',{ascending:false}).limit(100)
 ]);
 const withLinks=await Promise.all((rows||[]).map(async row=>{if(!row.receipt_path)return {...row,receiptUrl:null};const {data}=await s.storage.from('deposit-receipts').createSignedUrl(row.receipt_path,300);return {...row,receiptUrl:data?.signedUrl||null};}));
 return <main className="container"><header className="nav"><Link href="/" className="brand">contribution<span>circle.</span></Link><Link className="btn btn-secondary" href="/admin">Back to admin</Link></header><div className="layout"><aside className="sidebar card" style={{padding:15}}><div className="eyebrow">Admin workspace</div><nav className="menu"><Link href="/admin">Overview</Link><Link className="active" href="/admin/deposits">Deposits</Link></nav></aside><section className="main"><div className="eyebrow">Administrator</div><h1 style={{fontSize:30}}>Deposit management</h1><DepositSettings bankName={settings?.deposit_bank_name||''} accountName={settings?.deposit_account_name||''} accountNumber={settings?.deposit_account_number||''} paystackEnabled={settings?.paystack_enabled===true}/><section className="card" style={{padding:20}}><h3>Member deposit submissions</h3><div className="table-wrap"><table><thead><tr><th>Member</th><th>Method</th><th>Amount</th><th>Date</th><th>Status</th><th>Proof</th><th>Review</th></tr></thead><tbody>{withLinks.length?withLinks.map((d:any)=><tr key={d.id}><td>{d.member?.full_name||d.member_id.slice(0,8)}</td><td>{d.payment_method==='paystack'?'Paystack':'Bank transfer'}</td><td>₦{Number(d.amount).toLocaleString('en-NG')}</td><td>{new Date(d.created_at).toLocaleDateString()}</td><td><span className="pill">{d.status}</span></td><td>{d.receiptUrl?<a href={d.receiptUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">View receipt</a>:d.payment_reference||'—'}</td><td>{d.payment_method==='bank_transfer'&&d.status==='pending'?<DepositReview id={d.id}/>: '—'}</td></tr>):<tr><td colSpan={7} className="muted">No deposits yet.</td></tr>}</tbody></table></div></section></section></div></main>;
}
