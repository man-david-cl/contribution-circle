import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

export async function PATCH(req:Request){
 const s=await createClient();
 const {data:{user}}=await s.auth.getUser();
 if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {data:profile}=await s.from('profiles').select('role').eq('id',user.id).single();
 if(profile?.role!=='admin')return NextResponse.json({error:'Administrator access required'},{status:403});
 let body:{withdrawal_enabled?:unknown};
 try{body=await req.json();}catch{return NextResponse.json({error:'Invalid JSON body'},{status:400});}
 if(typeof body.withdrawal_enabled!=='boolean')return NextResponse.json({error:'withdrawal_enabled must be true or false'},{status:400});
 const admin=createAdminClient();
 const {data,error}=await admin.rpc('admin_set_withdrawal_enabled',{p_enabled:body.withdrawal_enabled,p_admin_id:user.id});
 if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({data});
}
