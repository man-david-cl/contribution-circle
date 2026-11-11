import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

export async function POST(req:Request){
 try{
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
  const form=await req.formData();
  const amount=Number(form.get('amount'));
  const transferDate=String(form.get('transfer_date')||'');
  const reference=String(form.get('transfer_reference')||'').trim();
  const note=String(form.get('note')||'').trim();
  const file=form.get('receipt');
  if(!Number.isFinite(amount)||amount<=0)return NextResponse.json({error:'Enter a valid deposit amount.'},{status:400});
  if(!(file instanceof File))return NextResponse.json({error:'Upload your transfer receipt.'},{status:400});
  if(file.size>5*1024*1024)return NextResponse.json({error:'Receipt must be 5 MB or smaller.'},{status:400});
  if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))return NextResponse.json({error:'Receipt must be JPG, PNG, WEBP or PDF.'},{status:400});
  const {data:cycle}=await supabase.from('contribution_cycles').select('id,contribution_amount,status').in('status',['open','collecting']).order('cycle_number',{ascending:false}).limit(1).maybeSingle();
  if(!cycle)return NextResponse.json({error:'There is no open contribution cycle at the moment.'},{status:400});
  if(Number(cycle.contribution_amount)>0&&amount!==Number(cycle.contribution_amount))return NextResponse.json({error:'The deposit amount must match the current cycle contribution.'},{status:400});
  const ext=file.name.split('.').pop()?.toLowerCase()||'bin';
  const path=user.id+'/'+crypto.randomUUID()+'.'+ext;
  const {error:uploadError}=await supabase.storage.from('deposit-receipts').upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError)return NextResponse.json({error:'Receipt upload failed: '+uploadError.message},{status:400});
  const {data,error}=await supabase.from('member_deposits').insert({
   member_id:user.id,cycle_id:cycle.id,amount,currency:'NGN',payment_method:'bank_transfer',
   status:'pending',receipt_path:path,transfer_date:transferDate||null,member_note:[reference,note].filter(Boolean).join(' — ')||null
  }).select('id,status,amount,created_at').single();
  if(error){await supabase.storage.from('deposit-receipts').remove([path]);return NextResponse.json({error:error.message},{status:400});}
  return NextResponse.json({data});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to submit deposit.'},{status:500});}
}
