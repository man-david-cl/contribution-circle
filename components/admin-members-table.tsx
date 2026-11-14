'use client';

import { useMemo, useState } from 'react';

type Member = { id:string; full_name:string|null; position_number:number|null; contribution_level:number|null; group_id:string|null; phone:string|null; bank_name:string|null; bank_account_name:string|null; bank_account_number:string|null; is_active:boolean };
type Group = { id:string; group_name:string; contribution_amount:number; contribution_level:number; circle_number:number };
const money=(n:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(n||0);

export function AdminMembersTable({members,groups}:{members:Member[];groups:Group[]}) {
 const [query,setQuery]=useState('');
 const [level,setLevel]=useState('all');
 const [status,setStatus]=useState('all');
 const [showAccounts,setShowAccounts]=useState(false);
 const filtered=useMemo(()=>members.filter(m=>{
  const group=groups.find(g=>g.id===m.group_id);
  const haystack=[m.full_name,m.phone,group?.group_name,m.bank_name,m.bank_account_name,m.position_number].join(' ').toLowerCase();
  return (!query||haystack.includes(query.toLowerCase()))&&(level==='all'||String(group?.contribution_level??m.contribution_level??'')===level)&&(status==='all'||(status==='active'?m.is_active:!m.is_active));
 }),[members,groups,query,level,status]);
 return <div className="admin-members-table">
  <div className="admin-member-tools">
   <label className="table-search"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, phone, circle or bank"/></label>
   <label className="table-filter"><span className="sr-only">Filter contribution level</span><select value={level} onChange={e=>setLevel(e.target.value)}><option value="all">All levels</option>{[1,2,3,4,5].map(n=><option key={n} value={String(n)}>Level {n} · ₦{(n*10000).toLocaleString('en-NG')}</option>)}</select></label>
   <label className="table-filter"><span className="sr-only">Filter member status</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
   <button className="btn btn-secondary admin-account-toggle" type="button" onClick={()=>setShowAccounts(v=>!v)} aria-pressed={showAccounts}>{showAccounts?'Hide account numbers':'Reveal account numbers'}</button>
   <span className="table-count">{filtered.length} of {members.length} members</span>
  </div>
  <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Member</th><th>Level / circle</th><th>Number</th><th>Contribution</th><th>Status</th><th>Bank</th><th>Account name</th><th>Account number</th><th>Phone</th></tr></thead><tbody>
   {filtered.length?filtered.map(m=>{const group=groups.find(g=>g.id===m.group_id);const account=m.bank_account_number||'';return <tr key={m.id}><td>{m.full_name||'Member'}</td><td>{group?group.group_name:'Not assigned'}</td><td>{m.position_number?'#'+String(m.position_number).padStart(3,'0'):'—'}</td><td>{group?money(Number(group.contribution_amount)):m.contribution_level?money(Number(m.contribution_level)):'Not selected'}</td><td><span className="pill">{m.is_active?'Active':'Inactive'}</span></td><td>{m.bank_name||'—'}</td><td>{m.bank_account_name||'—'}</td><td>{account?(showAccounts?account:'••••••'+account.slice(-4)):'—'}</td><td>{m.phone||'—'}</td></tr>}) : <tr><td colSpan={9} className="table-empty">No members match these filters.</td></tr>}
  </tbody></table></div>
 </div>;
}
