'use client';

import { useEffect, useState } from 'react';

const API = '/api/nexus';
type Project = { id: string; name: string };
type Settings = { deployment?: { strategy?: string; zeroDowntime?: boolean; rollbackOnFailure?: boolean }; build?: { cache?: boolean }; security?: { requireReleaseGates?: boolean } };
type Preview = { mode: 'public' | 'team' | 'protected'; requireAuth: boolean; expiresHours: number };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, { ...init, credentials: 'include', headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...(init?.headers ?? {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.detail || body.error || `Request failed (${r.status})`);
  return body as T;
}

export default function SettingsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [settings, setSettings] = useState<Settings>({ deployment: { strategy: 'rolling', zeroDowntime: true, rollbackOnFailure: true }, build: { cache: true }, security: { requireReleaseGates: false } });
  const [preview, setPreview] = useState<Preview>({ mode: 'team', requireAuth: false, expiresHours: 72 });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadProjects() {
    const value = await request<Project[]>('/v1/projects');
    setProjects(value);
    if (!projectId && value[0]) setProjectId(value[0].id);
  }
  async function loadProject(id: string) {
    if (!id) return;
    const [s, p] = await Promise.all([
      request<{ settings: Settings }>(`/v1/projects/${id}/settings`),
      request<{ policy: Preview }>(`/v1/projects/${id}/preview-policy`),
    ]);
    setSettings(s.settings);
    setPreview(p.policy);
  }
  useEffect(() => { loadProjects().catch(e => setMessage(e.message)); }, []);
  useEffect(() => { loadProject(projectId).catch(e => setMessage(e.message)); }, [projectId]);

  async function save() {
    if (!projectId) return;
    setBusy(true); setMessage('Saving project configuration…');
    try {
      await Promise.all([
        request(`/v1/projects/${projectId}/settings`, { method: 'PUT', body: JSON.stringify(settings) }),
        request(`/v1/projects/${projectId}/preview-policy`, { method: 'PUT', body: JSON.stringify(preview) }),
      ]);
      setMessage('Project settings saved. New deployments will use the updated release policy.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save settings'); }
    finally { setBusy(false); }
  }

  function patchSettings(patch: Partial<Settings>) { setSettings(s => ({ ...s, ...patch })); }
  return <main className="platformPage">
    <header className="platformHeader"><div><a href="/" className="backLink">← Console</a><span className="eyebrow">NEXUS / PROJECT SETTINGS</span><h1>Project settings</h1><p>Deployment behavior, build optimization, release safety and preview access.</p></div><button className="mini" onClick={save} disabled={busy || !projectId}>{busy ? 'Saving…' : 'Save changes'}</button></header>
    {message && <div className="platformNotice"><span>{message}</span></div>}
    <section className="platformCard full">
      <div className="cardHead"><div><span className="eyebrow">PROJECT</span><h2>Configuration scope</h2></div></div>
      <select className="wideSelect" value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">Select project…</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    </section>
    <section className="platformGrid">
      <article className="platformCard"><div className="cardHead"><div><span className="eyebrow">RELEASES</span><h2>Deployment safety</h2></div></div>
        <label>Release strategy<select value={settings.deployment?.strategy ?? 'rolling'} onChange={e => patchSettings({ deployment: { ...settings.deployment, strategy: e.target.value } })}><option value="rolling">Rolling</option><option value="blue_green">Blue / green</option><option value="canary">Canary</option></select></label>
        <label className="toggle"><input type="checkbox" checked={settings.deployment?.zeroDowntime !== false} onChange={e => patchSettings({ deployment: { ...settings.deployment, zeroDowntime: e.target.checked } })}/> Zero-downtime releases</label>
        <label className="toggle"><input type="checkbox" checked={settings.deployment?.rollbackOnFailure !== false} onChange={e => patchSettings({ deployment: { ...settings.deployment, rollbackOnFailure: e.target.checked } })}/> Roll back on failed release</label>
      </article>
      <article className="platformCard"><div className="cardHead"><div><span className="eyebrow">BUILD</span><h2>Build optimization</h2></div></div>
        <label className="toggle"><input type="checkbox" checked={settings.build?.cache !== false} onChange={e => patchSettings({ build: { ...settings.build, cache: e.target.checked } })}/> Content-addressed build cache</label>
        <p className="muted">Cache policy is stored in the Nexus control plane and is consumed by the deployment engine.</p>
      </article>
      <article className="platformCard"><div className="cardHead"><div><span className="eyebrow">PREVIEWS</span><h2>Preview protection</h2></div></div>
        <label>Access<select value={preview.mode} onChange={e => setPreview(p => ({ ...p, mode: e.target.value as Preview['mode'] }))}><option value="public">Public</option><option value="team">Team only</option><option value="protected">Protected</option></select></label>
        <label className="toggle"><input type="checkbox" checked={preview.requireAuth} onChange={e => setPreview(p => ({ ...p, requireAuth: e.target.checked }))}/> Require authentication</label>
        <label>Preview expiry (hours)<input type="number" min="1" max="720" value={preview.expiresHours} onChange={e => setPreview(p => ({ ...p, expiresHours: Number(e.target.value) || 72 }))}/></label>
      </article>
      <article className="platformCard"><div className="cardHead"><div><span className="eyebrow">RELEASE GATES</span><h2>Quality enforcement</h2></div></div>
        <label className="toggle"><input type="checkbox" checked={settings.security?.requireReleaseGates === true} onChange={e => patchSettings({ security: { ...settings.security, requireReleaseGates: e.target.checked } })}/> Require release gates</label>
        <p className="muted">Configure individual build, security, GitHub-check, health and smoke gates in the Release Safety Center.</p>
        <a className="mini" href="/platform/releases">Open Release Safety Center →</a>
      </article>
    </section>
  </main>;
}
