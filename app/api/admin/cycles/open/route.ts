import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

export async function POST(){
 try{
  const s=await createClient();
  const {data:{user},error:authError}=await s.auth.getUser();
  if(authError||!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data:profile,error:profileError}=await s.from('profiles').select('role').eq('id',user.id).single();
  if(profileError||profile?.role!=='admin')return NextResponse.json({error:'Administrator access required'},{status:403});
  const {data,error}=await s.rpc('admin_open_initial_cycle',{p_admin_id:user.id});
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({data});
 }catch(error){
  console.error('Open initial contribution cycle error:',error);
  return NextResponse.json({error:'Unable to open the contribution cycle. Please try again.'},{status:500});
 }
}
