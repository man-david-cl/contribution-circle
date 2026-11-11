'use client';

import {useState} from 'react';

export function WithdrawalButton(){
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');

 async function request(){
  if(!confirm('Submit a withdrawal request for the active contribution cycle?'))return;
  setBusy(true);
  setMessage('');
  try{
   const response=await fetch('/api/withdrawals',{method:'POST',headers:{'Accept':'application/json'}});
   const raw=await response.text();
   let result:{error?:string;data?:unknown}={};
   if(raw){
    try{result=JSON.parse(raw) as {error?:string;data?:unknown};}
    catch{throw new Error('The server returned an invalid response. Please refresh and try again. If this continues, contact the administrator.');}
   }else if(!response.ok){
    throw new Error('The server returned an empty response (HTTP '+response.status+'). Please refresh and try again.');
   }
   if(!response.ok)throw new Error(result.error||'Unable to submit your withdrawal request (HTTP '+response.status+').');
   setMessage('Your withdrawal request has been submitted.');
  }catch(error){
   setMessage(error instanceof Error?error.message:'Unable to submit request. Please try again.');
  }finally{
   setBusy(false);
  }
 }

 return <div style={{marginTop:18}}>
  <button type="button" className="btn btn-primary" disabled={busy} onClick={request}>{busy?'Submitting…':'Request withdrawal'}</button>
  {message&&<p className="muted" role="status" style={{fontSize:12,marginTop:8}}>{message}</p>}
 </div>;
}
