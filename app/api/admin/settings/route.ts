import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

export async function PATCH(req:Request){
 try{
  const s=await createClient();
  const {data:{user},error:authError}=await s.auth.getUser();
  if(authError||!user)return NextResponse.json({error:'Unauthorized'},{status:401});

  const {data:profile,error:profileError}=await s.from('profiles').select('role').eq('id',user.id).single();
  if(profileError)return NextResponse.json({error:'Unable to verify administrator permissions.'},{status:500});
  if(profile?.role!=='admin')return NextResponse.json({error:'Administrator access required'},{status:403});

  let body:{withdrawal_enabled?:unknown};
  try{body=await req.json();}catch{return NextResponse.json({error:'Invalid JSON body'},{status:400});}
  if(typeof body.withdrawal_enabled!=='boolean')return NextResponse.json({error:'withdrawal_enabled must be true or false'},{status:400});

  // The SECURITY DEFINER RPC verifies the authenticated admin identity and role.
  const {data,error}=await s.rpc('admin_set_withdrawal_enabled',{p_enabled:body.withdrawal_enabled,p_admin_id:user.id});
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({data});
 }catch(error){
  console.error('Admin withdrawal settings error:',error);
  return NextResponse.json({error:'The server could not update withdrawal access. Please try again.'},{status:500});
 }
}
