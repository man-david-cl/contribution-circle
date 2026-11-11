'use client';
import {useState} from 'react';

type Props={amount:number;bankName:string|null;accountName:string|null;accountNumber:string|null;paystackEnabled:boolean};
export function DepositForm({amount,bankName,accountName,accountNumber,paystackEnabled}:Props){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [method,setMethod]=useState<'bank'|'online'>('bank');
 async function submitBank(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMessage('');
  try{const form=new FormData(e.currentTarget);const r=await fetch('/api/deposits/bank-transfer',{method:'POST',body:form});const d=await r.json();if(!r.ok)throw new Error(d.error||'Deposit submission failed.');setMessage('Receipt submitted. Your deposit is pending administrator verification.');e.currentTarget.reset();}
  catch(err){setMessage(err instanceof Error?err.message:'Could not submit deposit.');}finally{setBusy(false);}
 }
 async function payOnline(){
  setBusy(true);setMessage('');
  try{const r=await fetch('/api/deposits/paystack/initialize',{method:'POST'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to start checkout.');window.location.href=d.authorization_url;}
  catch(err){setMessage(err instanceof Error?err.message:'Unable to start payment.');setBusy(false);}
 }
 return <section className="card" style={{padding:20,marginTop:18}}>
  <h3>Make a deposit</h3><p className="muted" style={{fontSize:13}}>Current cycle contribution: <strong>₦{amount.toLocaleString('en-NG',{minimumFractionDigits:2})}</strong></p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'16px 0'}}><button type="button" className={'btn '+(method==='bank'?'btn-primary':'btn-secondary')} onClick={()=>setMethod('bank')}>Bank transfer + receipt</button><button type="button" className={'btn '+(method==='online'?'btn-primary':'btn-secondary')} onClick={()=>setMethod('online')} disabled={!paystackEnabled}>Pay online</button></div>
  {method==='bank'?<><div style={{background:'#f5f8f6',borderRadius:12,padding:15,marginBottom:14}}><div className="eyebrow">Transfer to this account</div><p style={{margin:'9px 0 4px'}}><strong>{bankName||'Bank account not configured'}</strong></p><p style={{margin:'4px 0'}}>Account name: <strong>{accountName||'—'}</strong></p><p style={{margin:'4px 0'}}>Account number: <strong style={{fontSize:18,letterSpacing:1}}>{accountNumber||'—'}</strong></p>{accountNumber&&<button type="button" className="btn btn-secondary" style={{marginTop:8}} onClick={()=>navigator.clipboard.writeText(accountNumber)}>Copy account number</button>}</div>
  <form onSubmit={submitBank} encType="multipart/form-data"><div className="field"><label>Amount transferred (₦)</label><input name="amount" type="number" min="1" step="0.01" defaultValue={amount||''} required/></div><div className="field"><label>Transfer date</label><input name="transfer_date" type="date" required/></div><div className="field"><label>Transfer reference (optional)</label><input name="transfer_reference" placeholder="Bank transaction reference"/></div><div className="field"><label>Receipt / payment screenshot (max 5 MB)</label><input name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required/></div><div className="field"><label>Note (optional)</label><input name="note" placeholder="Any extra details"/></div><button className="btn btn-primary" disabled={busy||!accountNumber}>{busy?'Submitting…':'Submit transfer receipt'}</button></form></>:<div style={{padding:'10px 0'}}><p className="muted" style={{fontSize:13}}>Pay securely using Paystack. Your deposit is recorded only after Paystack confirms the transaction.</p><button type="button" className="btn btn-primary" disabled={busy||!paystackEnabled} onClick={payOnline}>{busy?'Opening checkout…':'Continue to Paystack — ₦'+amount.toLocaleString('en-NG')}</button></div>}
  {message&&<p role="status" className="auth-message" style={{background:'#eaf6ef',color:'#145b40'}}>{message}</p>}
  {!paystackEnabled&&<p className="muted" style={{fontSize:12,marginTop:12}}>Online payments are not enabled yet. You can still use bank transfer.</p>}
 </section>;
}
