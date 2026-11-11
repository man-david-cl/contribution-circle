import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

export async function POST(){
 try{
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
  const secret=process.env.PAYSTACK_SECRET_KEY;
  if(!secret)return NextResponse.json({error:'Online payments are not configured yet. Please use bank transfer for now.'},{status:503});
  const {data:settings}=await supabase.from('group_settings').select('paystack_enabled').limit(1).maybeSingle();
  if(!settings?.paystack_enabled)return NextResponse.json({error:'Online payments are not enabled by the administrator yet.'},{status:400});
  const {data:cycle}=await supabase.from('contribution_cycles').select('id,contribution_amount,status').in('status',['open','collecting']).order('cycle_number',{ascending:false}).limit(1).maybeSingle();
  if(!cycle)return NextResponse.json({error:'There is no open contribution cycle at the moment.'},{status:400});
  const amount=Number(cycle.contribution_amount);
  if(!Number.isFinite(amount)||amount<=0)return NextResponse.json({error:'The contribution amount has not been configured.'},{status:400});
  const admin=createAdminClient();
  const reference='CC-'+crypto.randomUUID().replaceAll('-','');
  const {error:insertError}=await admin.from('member_deposits').insert({
   member_id:user.id,cycle_id:cycle.id,amount,currency:'NGN',payment_method:'paystack',
   status:'pending',payment_reference:reference
  });
  if(insertError)return NextResponse.json({error:insertError.message},{status:400});
  const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||(process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:'http://localhost:3000');
  const callbackUrl=(siteUrl.endsWith('/')?siteUrl.slice(0,-1):siteUrl)+'/deposit/paystack/callback';
  const response=await fetch('https://api.paystack.co/transaction/initialize',{
   method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},
   body:JSON.stringify({email:user.email,amount:Math.round(amount*100),currency:'NGN',reference,callback_url:callbackUrl,metadata:{member_id:user.id,deposit_reference:reference,cycle_id:cycle.id}})
  });
  const result=await response.json();
  if(!response.ok||!result.status||!result.data?.authorization_url)return NextResponse.json({error:result.message||'Could not start Paystack checkout.'},{status:400});
  return NextResponse.json({authorization_url:result.data.authorization_url,reference});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to initialize payment.'},{status:500});}
}
