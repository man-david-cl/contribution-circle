'use client';
import {useState} from 'react';

export function WithdrawalControls({enabled,recipientName,positionNumber,hasRecipient}:{enabled:boolean;recipientName:string|null;positionNumber:number|null;hasRecipient:boolean}){
 const [active,setActive]=useState(enabled);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function toggle(){
  if(!hasRecipient)return;
  const next=!active;
  const who=recipientName||'the next recipient';
  const prompt=next?'Enable the Withdraw button for '+who+' (position #'+positionNumber+') only?':'Disable withdrawal access for the current recipient?';
  if(!confirm(prompt))return;
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/admin/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({withdrawal_enabled:next})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'Unable to update withdrawal setting');
   setActive(next);setMessage(next?'Withdraw is now enabled for '+who+' only.':'Withdrawal access has been disabled.');
  }catch(error){setMessage(error instanceof Error?error.message:'An unexpected error occurred.');}
  finally{setBusy(false);}
 }
 return <div>
  <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
   <span className="pill">{!hasRecipient?'No eligible recipient':active?'Withdraw enabled for next recipient':'Withdraw disabled'}</span>
   <button type="button" className={active?'btn btn-danger':'btn btn-primary'} disabled={busy||!hasRecipient} aria-pressed={active} aria-busy={busy} onClick={toggle}>{busy?'Updating…':active?'Disable this recipient':'Enable this recipient'}</button>
  </div>
  {message&&<p className="muted" role="status" style={{fontSize:13,marginTop:10}}>{message}</p>}
 </div>;
}
