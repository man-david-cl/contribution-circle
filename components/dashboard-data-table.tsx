'use client';

import {useMemo,useState} from 'react';
import {AdminActions} from '@/components/admin-actions';

type Row={id:string;search:string;status:string;cells:string[]};
type Props={mode:'payments'|'withdrawals'|'member-withdrawals';rows:Row[];emptyMessage:string;searchPlaceholder:string};

const statusClass=(status:string)=>['pending','submitted'].includes(status.toLowerCase())?'pill pill-warn':status.toLowerCase()==='rejected'?'pill pill-red':'pill';

export function DashboardDataTable({mode,rows,emptyMessage,searchPlaceholder}:Props){
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('all');
  const statuses=useMemo(()=>Array.from(new Set(rows.map(row=>row.status).filter(Boolean))),[rows]);
  const filtered=useMemo(()=>rows.filter(row=>(status==='all'||row.status===status)&&(!query||row.search.toLowerCase().includes(query.toLowerCase()))),[rows,status,query]);
  const headings=mode==='payments'?['Member','Cycle','Amount','Status','Paid date']:mode==='member-withdrawals'?['Submitted','Status','Request ID']:['Member','Submitted','Status','Action'];
  return <div className="data-table">
    <div className="table-toolbar">
      <label className="table-search"><span className="sr-only">Search records</span><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={searchPlaceholder}/></label>
      <label className="table-filter"><span className="sr-only">Filter by status</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{statuses.map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></label>
      <span className="table-count">{filtered.length} of {rows.length}</span>
    </div>
    <div className="table-wrap"><table className="dashboard-table"><thead><tr>{headings.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
      {filtered.length?filtered.map(row=><tr key={row.id}>{row.cells.map((cell,index)=><td key={index}>{mode==='payments'&&index===3?<span className={statusClass(row.status)}>{cell}</span>:mode==='withdrawals'&&index===2?<span className={statusClass(row.status)}>{cell}</span>:cell}</td>)}{mode==='withdrawals'&&<td><AdminActions id={row.id} status={row.status}/></td>}</tr>):<tr><td colSpan={headings.length} className="table-empty">{emptyMessage}</td></tr>}
    </tbody></table></div>
  </div>;
}
