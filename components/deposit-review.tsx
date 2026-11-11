'use client';
import {useState} from 'react';
export function DepositReview({id}:{id:string}){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function act(action:'approved'|'rejected'){
  if(action==='rejected'&&!confirm('Reject this deposit receipt?'))return;
  if(action==='approved'&&!confirm('Confirm that you checked the bank account and received this deposit?'))return;
  setBusy(true);setMessage('');
  try{const r=await fetch('/api/admin/deposits',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:action})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not update deposit.');setMessage('Saved');window.location.reload();}
  catch(e){setMessage(e instanceof Error?e.message:'Update failed.');setBusy(false);}
 }
 return <div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button className="btn btn-primary" disabled={busy} onClick={()=>act('approved')}>Approve</button><button className="btn btn-danger" disabled={busy} onClick={()=>act('rejected')}>Reject</button>{message&&<small>{message}</small>}</div>;
}
