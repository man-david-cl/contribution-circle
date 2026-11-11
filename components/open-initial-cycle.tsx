'use client';
import {useState} from 'react';

export function OpenInitialCycle({hasOpenCycle,amount,frequency,currentRecipient}:{hasOpenCycle:boolean;amount:number|null;frequency:string|null;currentRecipient:string|null}){
 const [open,setOpen]=useState(hasOpenCycle);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function createCycle(){
  if(busy||open)return;
  if(!confirm('Open the first contribution cycle for '+(currentRecipient||'the current recipient')+'? This will not mark anyone as paid or advance the rotation.'))return;
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/admin/cycles/open',{method:'POST'});
   const raw=await response.text();
   let result:any={};
   try{result=raw?JSON.parse(raw):{error:'The server returned an empty response.'};}
   catch{result={error:'The server returned an invalid response. Please refresh and try again.'};}
   if(!response.ok)throw new Error(result.error||'Could not open the contribution cycle.');
   setOpen(true);
   setMessage(result.data?.message||('Contribution cycle #'+result.data?.cycle_number+' is now open.'));
  }catch(error){setMessage(error instanceof Error?error.message:'Unexpected error. Please try again.');}
  finally{setBusy(false);}
 }
 return <section className="card" style={{padding:20,marginBottom:18}}>
  <div className="eyebrow">Cycle setup</div>
  <h3 style={{marginTop:6}}>Contribution cycle</h3>
  {open?<p className="muted" role="status">An open contribution cycle is already configured.</p>:<>
   <p className="muted" style={{fontSize:13}}>No open cycle exists yet. Open the first cycle to allow the current recipient to submit a withdrawal request when the administrator enables access.</p>
   <p style={{fontSize:13}}>Current recipient: <strong>{currentRecipient||'Not assigned'}</strong><br/>Contribution amount: <strong>{amount&&amount>0?'₦'+amount.toLocaleString('en-NG'):'Not configured'}</strong><br/>Frequency: <strong>{frequency||'Not configured'}</strong></p>
   <button type="button" className="btn btn-primary" disabled={busy||!currentRecipient||!amount||amount<=0} onClick={createCycle}>{busy?'Opening cycle…':'Open first contribution cycle'}</button>
  </>}
  {message&&<p className="muted" role="status" style={{fontSize:13,marginTop:10}}>{message}</p>}
 </section>;
}
