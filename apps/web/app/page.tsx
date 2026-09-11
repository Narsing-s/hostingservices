'use client';
import { useState } from 'react';
import { Activity, ArrowUpRight, Boxes, Database, GitBranch, Globe2, Rocket, ShieldCheck, Sparkles, Terminal, Zap } from 'lucide-react';

const services = [
  ['Web Service','Deploy any Git repository with automatic builds.','98.7%','Globe2'],
  ['PostgreSQL','Branchable database with snapshots and restore.','100%','Database'],
  ['Worker','Background jobs without managing servers.','99.9%','Boxes'],
  ['Redis','Fast cache and queue for your applications.','99.99%','Zap']
];

export default function Home() {
  const [deployed, setDeployed] = useState(false);
  return <main>
    <aside><div className="brand"><div className="logo">N</div><div><b>NEXUS</b><small>HOSTING</small></div></div><nav><a className="active">Overview</a><a>Projects</a><a>Databases</a><a>Deployments</a><a>Domains</a><a>Observability</a></nav><div className="sideCard"><Sparkles size={17}/><b>Autopilot</b><span>Infrastructure recommendations are ready.</span></div></aside>
    <section className="content"><header><div><span className="eyebrow">CONTROL PLANE / PRODUCTION</span><h1>Your infrastructure, without the infrastructure work.</h1><p>Ship code, databases and workers as one connected application. Nexus detects, deploys and watches the whole graph.</p></div><button onClick={()=>setDeployed(true)}><Rocket size={17}/> New deployment</button></header>
      {deployed && <div className="toast"><ShieldCheck size={18}/><span><b>Deployment queued</b><small>Environment planner detected Web + API + PostgreSQL.</small></span></div>}
      <div className="heroGrid"><div className="heroCard"><div className="status"><i/>All systems operational</div><div className="metric"><strong>4</strong><span>connected services</span></div><div className="graph"><div className="node source"><GitBranch/><b>GitHub</b><small>main</small></div><div className="line"/><div className="node"><Globe2/><b>Web</b><small>running</small></div><div className="line"/><div className="node"><Database/><b>Postgres</b><small>healthy</small></div></div></div><div className="insight"><div className="icon"><Sparkles/></div><span className="eyebrow">NEXUS AUTOPILOT</span><h2>One graph. One recovery point.</h2><p>Preview, staging and production can be cloned together so your application and data stay in sync.</p><button className="ghost">Explore environments <ArrowUpRight size={15}/></button></div></div>
      <div className="sectionHead"><div><span className="eyebrow">SERVICES</span><h2>Everything your app needs</h2></div><button className="ghost">View catalog <ArrowUpRight size={15}/></button></div>
      <div className="services">{services.map(([name,desc,sla,icon])=>{const I=icon==='Database'?Database:icon==='Globe2'?Globe2:icon==='Boxes'?Boxes:Zap;return <div className="service" key={name}><div className="serviceTop"><div className="icon"><I/></div><span className="live">LIVE</span></div><h3>{name}</h3><p>{desc}</p><div className="serviceFoot"><span><Activity size={13}/> {sla} health</span><ArrowUpRight size={15}/></div></div>})}</div>
      <div className="terminal"><div className="termHead"><span><Terminal size={14}/> live deployment stream</span><span>production / api</span></div><div><em>09:41:02</em> <b>BUILD</b> Installing dependencies…</div><div><em>09:41:08</em> <b>BUILD</b> Build completed in 6.2s</div><div><em>09:41:10</em> <b>ROUTE</b> Connected api → postgres</div><div><em>09:41:11</em> <b>READY</b> Deployment healthy <i/></div></div>
    </section>
  </main>
}
