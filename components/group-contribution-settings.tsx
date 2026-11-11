'use client';
import {useState} from 'react';

export function GroupContributionSettings({initialAmount}:{initialAmount:number|null}){
 const [amount,setAmount]=useState(initialAmount?String(initialAmount):'');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [saved,setSaved]=useState(Boolean(initialAmount&&initialAmount>0));

 async function save(){
  const value=Number(amount);
  if(!Number.isFinite(value)||value<=0){setMessage('Enter a contribution amount greater than zero.');return;}
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/admin/group-settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({contribution_amount:value})});
   const raw=await response.text();
   let result:any={};
   try{result=raw?JSON.parse(raw):{error:'The server returned an empty response.'};}
   catch{result={error:'The server returned an invalid response. Please refresh and try again.'};}
   if(!response.ok)throw new Error(result.error||'Could not save the contribution amount.');
   setSaved(true);
   setMessage('Contribution amount saved. You can now open the first contribution cycle.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unexpected error. Please try again.');}
  finally{setBusy(false);}
 }

 return <section className="card" style={{padding:20,marginBottom:18}}>
  <div className="eyebrow">Group configuration</div>
  <h3 style={{marginTop:6}}>Contribution amount</h3>
  <p className="muted" style={{fontSize:13}}>Set the amount each member contributes during a cycle. This amount is used when a contribution cycle is opened.</p>
  <div style={{display:'flex',gap:10,alignItems:'end',flexWrap:'wrap'}}>
   <label style={{display:'grid',gap:6,fontSize:13,fontWeight:600}}>Amount (NGN)
    <input aria-label="Contribution amount in naira" type="number" min="1" step="0.01" inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setSaved(false);}} placeholder="e.g. 10000" style={{padding:'11px 12px',border:'1px solid #cbd5e1',borderRadius:8,minWidth:220}}/>
   </label>
   <button type="button" className="btn btn-primary" onClick={save} disabled={busy||!amount||Number(amount)<=0}>{busy?'Saving…':saved?'Update contribution amount':'Save contribution amount'}</button>
  </div>
  {message&&<p className="muted" role="status" style={{fontSize:13,marginTop:10}}>{message}</p>}
 </section>;
}
