'use client';

import { FormEvent, useState } from 'react';

const API=process.env.NEXT_PUBLIC_NEXUS_API_URL??'http://localhost:4000';

export default function LoginPage(){
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await fetch(`${API}/api/auth/${mode==='login'?'login':'register'}`,{method:'POST',headers:{'content-type':'application/json'},credentials:'include',body:JSON.stringify({name,email,password})});const v=await r.json();if(!r.ok)throw new Error(v.error||'Authentication failed');window.location.href='/';}catch(err){setError(err instanceof Error?err.message:'Authentication failed');}finally{setBusy(false);}}
  return <main className="authPage"><section className="authCard"><div className="authBrand"><div className="logo">N</div><div><b>NEXUS</b><small>HOSTING</small></div></div><span className="eyebrow">ACCOUNT / CONTROL PLANE</span><h1>{mode==='login'?'Welcome back':'Create your Nexus account'}</h1><p>Deploy applications, manage environments and connect your GitHub repositories from one control plane.</p>{error&&<div className="authError">{error}</div>}<div className="oauthGrid"><a href={`${API}/api/auth/github/start`}>Continue with GitHub</a><a href={`${API}/api/auth/google/start`}>Continue with Google</a></div><div className="authDivider"><span>or continue with email</span></div><form onSubmit={submit}>{mode==='register'&&<label>Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name"/></label>}<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={8}/></label><button className="authSubmit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}</button></form><button className="authSwitch" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?"Don't have an account? Create one":"Already have an account? Sign in"}</button></section></main>;
}
