import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
export async function PATCH(req:Request){
 try{
  const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data:profile}=await s.from('profiles').select('role').eq('id',user.id).single();if(profile?.role!=='admin')return NextResponse.json({error:'Administrator access required'},{status:403});
  const body=await req.json();if(typeof body.id!=='string'||!['approved','rejected'].includes(body.status))return NextResponse.json({error:'Invalid deposit action.'},{status:400});
  const {data:deposit,error:readError}=await s.from('member_deposits').select('id,status,payment_method').eq('id',body.id).single();
  if(readError||!deposit)return NextResponse.json({error:'Deposit not found.'},{status:404});
  if(deposit.payment_method!=='bank_transfer'||deposit.status!=='pending')return NextResponse.json({error:'Only pending bank transfer deposits can be reviewed here.'},{status:400});
  const {error}=await s.from('member_deposits').update({status:body.status,verified_by:user.id,verified_at:new Date().toISOString()}).eq('id',body.id);
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({success:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to update deposit.'},{status:500});}
}
