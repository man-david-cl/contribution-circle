'use client';
import {useState} from 'react';

export function WithdrawalControls({enabled}:{enabled:boolean}){
 const [active,setActive]=useState(enabled);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function toggle(){
  const next=!active;
  const prompt=next?'Enable withdrawal requests for the currently eligible recipient?':'Disable withdrawal requests for all members?';
  if(!confirm(prompt))return;
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/admin/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({withdrawal_enabled:next})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'Unable to update withdrawal setting');
   setActive(next);setMessage(next?'Withdrawal requests are enabled.':'Withdrawal requests are disabled.');
  }catch(error){setMessage(error instanceof Error?error.message:'An unexpected error occurred.');}
  finally{setBusy(false);}
 }
 return <div>
  <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
   <span className="pill">{active?'Withdrawals enabled':'Withdrawals disabled'}</span>
   <button type="button" className={active?'btn btn-danger':'btn btn-primary'} disabled={busy} aria-pressed={active} aria-busy={busy} onClick={toggle}>{busy?'Updating…':active?'Disable withdrawals':'Enable withdrawals'}</button>
  </div>
  {message&&<p className="muted" role="status" style={{fontSize:13,marginTop:10}}>{message}</p>}
 </div>;
}
