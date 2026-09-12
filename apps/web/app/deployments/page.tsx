'use client';

import { useEffect, useState } from 'react';

const API='/api/nexus';
type Deployment={id:string;project:string;projectId?:string;status:string;repo?:string;image?:string;createdAt:string};

export default function DeploymentsPage(){
 const [items,setItems]=useState<Deployment[]>([]),[status,setStatus]=useState('all'),[message,setMessage]=useState('');
 async function load(){try{const r=await fetch(`${API}/v1/deployments`,{credentials:'include'});const v=await r.json();if(!r.ok)throw new Error(v.error||v.detail||'Unable to load deployments');setItems(v)}catch(e){setMessage(e instanceof Error?e.message:'Unable to load deployments')}}
 useEffect(()=>{load();const t=setInterval(load,4000);return()=>clearInterval(t)},[]);
 const filtered=status==='all'?items:items.filter(d=>d.status===status);
 return <main className="platformPage"><header className="platformHeader"><div><a href="/" className="backLink">← Console</a><span className="eyebrow">NEXUS / DEPLOYMENTS</span><h1>Deployments</h1><p>Every preview and production release, with lifecycle state and an operational inspector.</p></div><a className="mini" href="/deploy">+ New deployment</a></header>
 {message&&<div className="platformNotice"><span>{message}</span></div>}
 <section className="platformCard full"><div className="cardHead"><div><span className="eyebrow">RELEASE HISTORY</span><h2>All deployments</h2></div><select className="wideSelect" style={{maxWidth:220}} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="ready">Running</option><option value="queued">Queued</option><option value="building">Building</option><option value="starting">Starting</option><option value="failed">Failed</option><option value="rolling_back">Rolling back</option></select></div>
 <div className="table">{filtered.map(d=><a href={`/deployments/${encodeURIComponent(d.id)}`} className="platformRow" key={d.id} style={{textDecoration:'none'}}><span><b>{d.project}</b><small>{d.repo||d.image||'deployment'} · {d.id}</small></span><span className={`pill ${d.status}`}>{d.status}</span><small>{new Date(d.createdAt).toLocaleString()}</small><span>→</span></a>)}{!filtered.length&&<p className="empty">No deployments match this filter.</p>}</div></section>
 </main>
}
