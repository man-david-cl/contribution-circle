import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
export async function PATCH(req:Request){
 try{
  const s=await createClient();const {data:{user}}=await s.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await req.json();
  if(typeof body.bank_name!=='string'||typeof body.account_name!=='string'||typeof body.account_number!=='string'||typeof body.paystack_enabled!=='boolean')return NextResponse.json({error:'Invalid settings.'},{status:400});
  if(body.account_number&&!/^\d{10}$/.test(body.account_number))return NextResponse.json({error:'Enter a valid 10-digit Nigerian account number.'},{status:400});
  const {data,error}=await s.rpc('admin_update_deposit_settings',{p_admin_id:user.id,p_bank_name:body.bank_name,p_account_name:body.account_name,p_account_number:body.account_number,p_paystack_enabled:body.paystack_enabled});
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({data});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to save settings.'},{status:500});}
}
