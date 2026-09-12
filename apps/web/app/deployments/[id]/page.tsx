'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API = '/api/nexus';
type Inspector = { id: string; project: string; status: string; repo?: string; image?: string; runtime?: any; createdAt: string; events: any[]; gates: any[]; comments: any[]; traffic: any; health: any };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, { ...init, credentials: 'include', headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...(init?.headers ?? {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.detail || body.error || `Request failed (${r.status})`);
  return body as T;
}

export default function DeploymentInspectorPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<Inspector | null>(null);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() { if (!id) return; try { setData(await request<Inspector>(`/v1/deployments/${encodeURIComponent(id)}/inspector`)); } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to load deployment'); } }
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [id]);

  async function addComment() {
    if (!comment.trim()) return;
    setBusy(true);
    try { await request(`/v1/deployments/${encodeURIComponent(id)}/comments`, { method: 'POST', body: JSON.stringify({ body: comment.trim() }) }); setComment(''); setMessage('Comment added.'); await load(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to add comment'); }
    finally { setBusy(false); }
  }

  if (!data) return <main className="platformPage"><header className="platformHeader"><div><a href="/" className="backLink">← Console</a><span className="eyebrow">NEXUS / DEPLOYMENT</span><h1>Deployment inspector</h1><p>{message || 'Loading deployment telemetry…'}</p></div></header></main>;
  return <main className="platformPage"><header className="platformHeader"><div><a href="/" className="backLink">← Console</a><span className="eyebrow">NEXUS / DEPLOYMENT INSPECTOR</span><h1>{data.project}</h1><p>{data.id} · {new Date(data.createdAt).toLocaleString()}</p></div><span className={`pill ${data.status.toLowerCase()}`}>{data.status}</span></header>
    {message && <div className="platformNotice"><span>{message}</span></div>}
    <section className="featureGrid"><article className="featureCard"><b>Source</b><span>{data.repo || data.image || 'Not specified'}</span></article><article className="featureCard"><b>Health</b><span>{data.health?.status || 'unknown'}</span></article><article className="featureCard"><b>Traffic</b><span>{data.traffic?.mode || 'generation-safe'}</span></article><article className="featureCard"><b>Runtime</b><span>{data.runtime?.url || data.runtime?.name || 'Provisioning'}</span></article></section>
    <section className="platformGrid"><article className="platformCard"><div className="cardHead"><div><span className="eyebrow">LIFECYCLE</span><h2>Deployment events</h2></div><span>{data.events.length}</span></div><div className="table">{data.events.map(e => <div className="platformRow" key={e.id}><span><b>{e.phase}</b><small>{e.message}</small></span><small>{new Date(e.createdAt).toLocaleString()}</small></div>)}</div></article>
      <article className="platformCard"><div className="cardHead"><div><span className="eyebrow">QUALITY</span><h2>Release gates</h2></div><span>{data.gates.length}</span></div><div className="table">{data.gates.map((g,i) => <div className="platformRow" key={`${g.name}-${i}`}><span><b>{g.name}</b><small>{g.message}</small></span><span className={`pill ${g.status}`}>{g.status}</span></div>)}{!data.gates.length&&<p className="empty">No gate results recorded yet.</p>}</div></article></section>
    <section className="platformCard full"><div className="cardHead"><div><span className="eyebrow">COLLABORATION</span><h2>Deployment comments</h2></div></div><div className="table">{data.comments.map(c=><div className="platformRow" key={c.id}><span><b>{c.name || c.email || 'Team member'}</b><small>{c.body}</small></span><small>{new Date(c.createdAt).toLocaleString()}</small></div>)}{!data.comments.length&&<p className="empty">No comments yet.</p>}</div><div className="formGrid"><input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add an operational note…"/><button className="mini" disabled={busy||!comment.trim()} onClick={addComment}>{busy?'Adding…':'Add comment'}</button></div></section>
  </main>;
}
