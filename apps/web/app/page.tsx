'use client';
import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Boxes, Database, GitBranch, Globe2, Rocket, ShieldCheck, Sparkles, Terminal, Zap, X } from 'lucide-react';

const API=process.env.NEXT_PUBLIC_NEXUS_API_URL??'http://localhost:4000';
const services=[['Web Service','Deploy Git repositories with automatic builds.','98.7%','Globe2'],['PostgreSQL','Branchable database with snapshots and restore.','100%','Database'],['Worker','Background jobs without managing servers.','99.9%','Boxes'],['Redis','Fast cache and queue for applications.','99.99%','Zap']];

type Deployment={id:string;status:string;repo?:string;runtime?:{port?:number};createdAt:string};

export default function Home(){
 const [open,setOpen]=useState(false); const [busy,setBusy]=useState(false); const [deployed,setDeployed]=useState(false); const [message,setMessage]=useState('');
 const [projectName,setProjectName]=useState('my-app'); const [repo,setRepo]=useState(''); const [ref,setRef]=useState('main'); const [containerPort,setContainerPort]=useState('3000'); const [hostPort,setHostPort]=useState('8088');
 const [deployments,setDeployments]=useState<Deployment[]>([]);
 async function loadDeployments(){try{const r=await fetch(`${API}/api/v1/deployments`);if(r.ok)setDeployments(await r.json());}catch{}}
 useEffect(()=>{loadDeployments()},[]);
 async function deploy(){
  setBusy(true);setMessage('Creating project…');
  try{
   const p=await fetch(`${API}/api/v1/projects`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:projectName||'my-app',repo:repo||undefined})});
   const project=await p.json(); if(!p.ok)throw new Error(project.detail||project.error||'Project creation failed');
   setMessage(repo?'Building repository…':'Starting runtime…');
   const d=await fetch(`${API}/api/v1/deployments`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:project.id,repo:repo||undefined,ref:ref||'main',image:repo?undefined:'nginx:alpine',hostPort:Number(hostPort)||undefined,containerPort:Number(containerPort)||80})});
   const result=await d.json(); if(!d.ok)throw new Error(result.detail||result.error||'Deployment failed');
   setDeployed(true);setOpen(false);setMessage(`Deployment ready${result.runtime?.port?` on port ${result.runtime.port}`:''}`);await loadDeployments();
  }catch(e){setMessage(e instanceof Error?e.message:'Deployment failed');}finally{setBusy(false)}
 }
 return <main>
  <aside><div className="brand"><div className="logo">N</div><div><b>NEXUS</b><small>HOSTING</small></div></div><nav><a className="active">Overview</a><a>Projects</a><a>Databases</a><a>Deployments</a><a>Domains</a><a>Observability</a></nav><div className="sideCard"><Sparkles size={17}/><b>Autopilot</b><span>Runtime-aware infrastructure recommendations.</span></div></aside>
  <section className="content"><header><div><span className="eyebrow">CONTROL PLANE / PRODUCTION</span><h1>Your infrastructure, without the infrastructure work.</h1><p>Ship code, databases and workers as one connected application. Nexus detects, deploys and watches the whole graph.</p></div><button onClick={()=>setOpen(true)}><Rocket size={17}/>New deployment</button></header>
   {message&&<div className="toast"><ShieldCheck size={18}/><span><b>{deployed?'Deployment ready':'Deployment status'}</b><small>{message}</small></span></div>}
   {open&&<div className="modalBackdrop"><div className="deployModal"><div className="modalHead"><div><span className="eyebrow">NEW DEPLOYMENT</span><h2>Deploy an application</h2></div><button className="close" onClick={()=>setOpen(false)}><X size={17}/></button></div><label>Project name<input value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="my-app"/></label><label>Git repository URL <span>(public Git repository)</span><input value={repo} onChange={e=>setRepo(e.target.value)} placeholder="https://github.com/owner/repository"/></label><div className="formGrid"><label>Branch / ref<input value={ref} onChange={e=>setRef(e.target.value)} placeholder="main"/></label><label>Container port<input type="number" value={containerPort} onChange={e=>setContainerPort(e.target.value)} /></label><label>Host port<input type="number" value={hostPort} onChange={e=>setHostPort(e.target.value)} /></label></div><div className="modalNote">Nexus clones the repository, builds its Dockerfile, then starts the resulting container through the local runtime engine.</div><button className="deployAction" onClick={deploy} disabled={busy}><Rocket size={16}/>{busy?'Deploying…':'Deploy now'}</button></div></div>}
   <div className="heroGrid"><div className="heroCard"><div className="status"><i/>{deployed?'Runtime deployed':'Control plane ready'}</div><div className="metric"><strong>{deployments.length||4}</strong><span>deployments tracked</span></div><div className="graph"><div className="node source"><GitBranch/><b>GitHub</b><small>{repo||'main'}</small></div><div className="line"/><div className="node"><Globe2/><b>Web</b><small>{deployed?'running':'ready'}</small></div><div className="line"/><div className="node"><Database/><b>Postgres</b><small>healthy</small></div></div></div><div className="insight"><div className="icon"><Sparkles/></div><span className="eyebrow">NEXUS AUTOPILOT</span><h2>One graph. One recovery point.</h2><p>Preview, staging and production can be cloned together so your application and data stay in sync.</p><button className="ghost">Explore environments <ArrowUpRight size={15}/></button></div></div>
   <div className="sectionHead"><div><span className="eyebrow">SERVICES</span><h2>Everything your app needs</h2></div><button className="ghost">View catalog <ArrowUpRight size={15}/></button></div>
   <div className="services">{services.map(([name,desc,sla,icon])=>{const I=icon==='Database'?Database:icon==='Globe2'?Globe2:icon==='Boxes'?Boxes:Zap;return <div className="service" key={name}><div className="serviceTop"><div className="icon"><I/></div><span className="live">LIVE</span></div><h3>{name}</h3><p>{desc}</p><div className="serviceFoot"><span><Activity size={13}/> {sla} health</span><ArrowUpRight size={15}/></div></div>})}</div>
   <div className="terminal"><div className="termHead"><span><Terminal size={14}/> live deployment stream</span><span>production / runtime</span></div>{deployments.length?deployments.slice(0,4).map(d=><div key={d.id}><em>{new Date(d.createdAt).toLocaleTimeString()}</em> <b>{d.status.toUpperCase()}</b> {d.repo||'container deployment'}{d.runtime?.port?` → :${d.runtime.port}`:''}</div>):<><div><em>09:41:02</em> <b>PLAN</b> Environment graph resolved</div><div><em>09:41:08</em> <b>PULL</b> Container image resolved</div><div><em>09:41:10</em> <b>RUN</b> Docker runtime connected</div><div><em>09:41:11</em> <b>READY</b> Deployment health check passed <i/></div></>}</div>
  </section>
 </main>;
}
