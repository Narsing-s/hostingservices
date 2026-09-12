'use client';

import { FormEvent, useEffect, useState } from 'react';

const API = '/api/nexus';
type ProviderState={github:boolean;google:boolean};
const oauthMessages: Record<string,string> = {
  github_oauth_unavailable: 'GitHub sign-in is temporarily unavailable. The Nexus platform administrator needs to finish the GitHub connection.',
  google_oauth_unavailable: 'Google sign-in is temporarily unavailable. The Nexus platform administrator needs to finish the Google connection.',
  invalid_oauth_state: 'The sign-in session expired. Please try again.',
  github_cancelled: 'GitHub sign-in was cancelled.', google_cancelled: 'Google sign-in was cancelled.',
  github_token_exchange_failed: 'GitHub could not complete sign-in. Please try again.', google_token_exchange_failed: 'Google could not complete sign-in. Please try again.',
  github_user_lookup_failed: 'We could not read your GitHub account. Please try again.', google_user_lookup_failed: 'We could not read your Google account. Please try again.',
  github_email_unavailable: 'Your GitHub account does not have a verified email available for sign-in.'
};

export default function LoginPage(){
  const [mode,setMode]=useState<'login'|'register'>('login'); const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [providers,setProviders]=useState<ProviderState>({github:false,google:false}); const [providerBusy,setProviderBusy]=useState<'github'|'google'|null>(null);
  useEffect(()=>{ const code=new URLSearchParams(window.location.search).get('error'); if(code) setError(oauthMessages[code]??'Sign-in could not be completed. Please try again.'); },[]);

  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setError('');
    try{
      const r=await fetch(`${API}/auth/${mode==='login'?'login':'register'}`,{method:'POST',headers:{'content-type':'application/json'},credentials:'include',body:JSON.stringify({name,email,password})});
      const v=await r.json().catch(()=>({error:`Authentication request failed (${r.status})`}));
      if(!r.ok) throw new Error(v.error||'Authentication failed');
      window.location.href='/';
    }catch(err){setError(err instanceof Error?err.message:'Authentication failed');}
    finally{setBusy(false);}
  }

  async function startOAuth(provider:'github'|'google'){
    setProviderBusy(provider); setError('');
    try{
      const r=await fetch(`${API}/auth/providers`,{credentials:'include',cache:'no-store'});
      const v=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(v.error||'Authentication service is unavailable.');
      if(!v?.[provider]) throw new Error(`${provider==='github'?'GitHub':'Google'} sign-in is not configured on this Nexus deployment.`);
      window.location.assign(`${API}/auth/${provider}/start`);
    }catch(err){setError(err instanceof Error?err.message:'OAuth sign-in is unavailable.');setProviderBusy(null);}
  }

  return <main className="authPage"><section className="authCard"><div className="authBrand"><div className="logo">N</div><div><b>NEXUS</b><small>HOSTING</small></div></div><span className="eyebrow">ACCOUNT / CONTROL PLANE</span><h1>{mode==='login'?'Welcome back':'Create your Nexus account'}</h1><p>Deploy applications, manage environments and connect your GitHub repositories from one control plane.</p>{error&&<div className="authError" role="alert">{error}</div>}<div className="oauthGrid"><button type="button" disabled={providerBusy!==null} onClick={()=>startOAuth('github')}>{providerBusy==='github'?'Checking GitHub…':'Continue with GitHub'}</button><button type="button" disabled={providerBusy!==null} onClick={()=>startOAuth('google')}>{providerBusy==='google'?'Checking Google…':'Continue with Google'}</button></div><div className="authDivider"><span>or continue with email</span></div><form onSubmit={submit}>{mode==='register'&&<label>Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name"/></label>}<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={8}/></label><button className="authSubmit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}</button></form><button className="authSwitch" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?"Don't have an account? Create one":"Already have an account? Sign in"}</button></section></main>;
}
