import {NextResponse} from 'next/server';
import crypto from 'node:crypto';
import {createAdminClient} from '@/lib/supabase-admin';

export async function POST(req:Request){
 const secret=process.env.PAYSTACK_SECRET_KEY;
 if(!secret)return NextResponse.json({error:'Not configured'},{status:503});
 const raw=await req.text();
 const signature=req.headers.get('x-paystack-signature')||'';
 const expected=crypto.createHmac('sha512',secret).update(raw).digest('hex');
 if(!signature||signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return NextResponse.json({error:'Invalid signature'},{status:401});
 try{
  const event=JSON.parse(raw);
  if(event.event==='charge.success'){
   const d=event.data;
   const admin=createAdminClient();
   const {data:deposit}=await admin.from('member_deposits').select('id,amount,status').eq('payment_reference',d.reference).maybeSingle();
   if(deposit&&d.status==='success'&&Number(d.amount)===Math.round(Number(deposit.amount)*100)&&d.currency==='NGN'){
    await admin.from('member_deposits').update({status:'paid',verified_at:new Date().toISOString()}).eq('id',deposit.id);
   }
  }
  return NextResponse.json({received:true});
 }catch{return NextResponse.json({error:'Webhook processing failed'},{status:400});}
}
