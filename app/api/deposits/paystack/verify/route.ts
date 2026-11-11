import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

export async function POST(req:Request){
 try{
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
  const {reference}=await req.json();
  if(typeof reference!=='string'||!reference)return NextResponse.json({error:'Missing payment reference.'},{status:400});
  const secret=process.env.PAYSTACK_SECRET_KEY;
  if(!secret)return NextResponse.json({error:'Paystack is not configured.'},{status:503});
  const response=await fetch('https://api.paystack.co/transaction/verify/'+encodeURIComponent(reference),{headers:{Authorization:'Bearer '+secret}});
  const result=await response.json();
  if(!response.ok||!result.status)return NextResponse.json({error:result.message||'Payment verification failed.'},{status:400});
  const admin=createAdminClient();
  const {data:deposit,error}=await admin.from('member_deposits').select('id,member_id,amount,status').eq('payment_reference',reference).single();
  if(error||!deposit||deposit.member_id!==user.id)return NextResponse.json({error:'Payment record not found for this account.'},{status:404});
  if(result.data?.status!=='success'||Number(result.data.amount)!==Math.round(Number(deposit.amount)*100)||result.data.currency!=='NGN'){
   return NextResponse.json({error:'Paystack has not confirmed the expected amount and currency.'},{status:400});
  }
  const {error:updateError}=await admin.from('member_deposits').update({status:'paid',verified_at:new Date().toISOString()}).eq('id',deposit.id);
  if(updateError)return NextResponse.json({error:updateError.message},{status:400});
  return NextResponse.json({success:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to verify payment.'},{status:500});}
}
