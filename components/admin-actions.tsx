'use client';
import {useState} from 'react';

async function readResponse(response: Response): Promise<any> {
 const text = await response.text();
 if (!text) return {error: `The server returned an empty response (HTTP ${response.status}). Please refresh and try again.`};
 try { return JSON.parse(text); }
 catch { return {error: `The server returned an invalid response (HTTP ${response.status}). Please refresh and try again.`}; }
}

export function AdminActions({id,status}:{id:string,status:string}){
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState('');
 async function act(action:string){
  if(action==='paid'&&!confirm('Confirm that the recipient has actually received the payment? This advances the rotation.'))return;
  setBusy(true);setMsg('');
  try{
   const response=await fetch('/api/admin/withdrawals',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action})});
   const result=await readResponse(response);
   if(!response.ok)throw new Error(result.error||'The withdrawal action could not be completed.');
   window.location.reload();
  }catch(error){
   setMsg(error instanceof Error?error.message:'An unexpected error occurred. Please try again.');
   setBusy(false);
  }
 }
 return <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
  {status==='pending'&&<><button disabled={busy} className="btn btn-secondary" onClick={()=>act('approve')}>{busy?'Please wait…':'Approve'}</button><button disabled={busy} className="btn btn-danger" onClick={()=>act('reject')}>Reject</button></>}
  {status==='approved'&&<button disabled={busy} className="btn btn-primary" onClick={()=>act('paid')}>{busy?'Please wait…':'Confirm paid'}</button>}
  {msg&&<small role="alert" style={{color:'#b43c30'}}>{msg}</small>}
 </div>;
}
