'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';

export default function PaystackCallback(){
 const [message,setMessage]=useState('Verifying your payment…');
 const [ok,setOk]=useState(false);
 useEffect(()=>{
  const reference=new URLSearchParams(window.location.search).get('reference');
  if(!reference){setMessage('No Paystack payment reference was supplied.');return;}
  fetch('/api/deposits/paystack/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference})})
   .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Payment verification failed.');setOk(true);setMessage('Your payment has been confirmed and recorded.');})
   .catch(e=>setMessage(e instanceof Error?e.message:'Could not verify payment.'));
 },[]);
 return <main className="container" style={{maxWidth:560,paddingTop:70}}><section className="card" style={{padding:28,textAlign:'center'}}><div className="eyebrow">Paystack checkout</div><h1 style={{fontSize:27}}>Payment status</h1><p role="status" className="muted">{message}</p><span className="pill" style={{margin:'12px auto',background:ok?'#e7f3ed':'#fff5df',color:ok?'#176b52':'#8c620b'}}>{ok?'Paid':'Checking'}</span><div><Link className="btn btn-primary" href="/deposit" style={{marginTop:18}}>Return to deposits</Link></div></section></main>;
}
