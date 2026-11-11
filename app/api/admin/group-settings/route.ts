import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

export async function PATCH(req:Request){
 try{
  const s=await createClient();
  const {data:{user},error:authError}=await s.auth.getUser();
  if(authError||!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data:profile,error:profileError}=await s.from('profiles').select('role').eq('id',user.id).single();
  if(profileError||profile?.role!=='admin')return NextResponse.json({error:'Administrator access required'},{status:403});

  let body:{contribution_amount?:unknown};
  try{body=await req.json();}catch{return NextResponse.json({error:'Invalid JSON body'},{status:400});}
  const amount=Number(body.contribution_amount);
  if(!Number.isFinite(amount)||amount<=0)return NextResponse.json({error:'Enter a contribution amount greater than zero.'},{status:400});

  const {data,error}=await s.rpc('admin_update_group_contribution_amount',{
   p_admin_id:user.id,
   p_contribution_amount:amount
  });
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({data});
 }catch(error){
  console.error('Admin group settings update error:',error);
  return NextResponse.json({error:'The server could not save the contribution amount. Please try again.'},{status:500});
 }
}
