'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_NEXUS_API_URL ?? 'http://localhost:4000';

type Detection = { runtime?: string; service?: string; selectedService?: string | null; availableServices?: string[]; dockerfileGenerated?: boolean };
type Deployment = { id: string; status: string; service?: string; serviceType?: string; repo?: string };
type DeploymentLogs = { build?: string; runtime?: string; logs?: string };

const lifecycle: Record<string, { label: string; detail: string }> = {
  queued: { label: 'Queued', detail: 'Waiting for a build worker' },
  building: { label: 'Building', detail: 'Building source into a deployable image' },
  starting: { label: 'Starting', detail: 'Starting the runtime and checking health' },
  ready: { label: 'Running', detail: 'Runtime is healthy and serving traffic' },
  failed: { label: 'Failed', detail: 'Deployment or health check failed' },
  rolling_back: { label: 'Rolling back', detail: 'Restoring the previous healthy version' }
};

function stateFor(status?: string) { return lifecycle[status ?? ''] ?? { label: status ? status.replace(/_/g, ' ') : 'Unknown', detail: 'Deployment state reported by Nexus' }; }

export default function DeployPage() {
  const [projectId, setProjectId] = useState(''); const [repo, setRepo] = useState(''); const [ref, setRef] = useState('main');
  const [service, setService] = useState(''); const [serviceType, setServiceType] = useState('web'); const [containerPort, setContainerPort] = useState('3000'); const [healthPath, setHealthPath] = useState('/');
  const [projects, setProjects] = useState<{ id: string; name: string; repo?: string }[]>([]); const [detection, setDetection] = useState<Detection | null>(null);
  const [detecting, setDetecting] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [logs, setLogs] = useState<DeploymentLogs | null>(null); const [showLogs, setShowLogs] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/projects`, { credentials: 'include' }).then(r => r.ok ? r.json() : []).then(v => { setProjects(v); if (v[0]) { setProjectId(v[0].id); setRepo(v[0].repo ?? ''); } }).catch(() => setMessage('API is not reachable. Start the Nexus API on port 4000.'));
  }, []);

  useEffect(() => {
    if (!deployment || ['ready', 'failed'].includes(deployment.status)) return;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/v1/deployments`, { credentials: 'include' }); if (!r.ok) return;
        const deployments: Deployment[] = await r.json(); const current = deployments.find(item => item.id === deployment.id); if (!current) return;
        setDeployment(current); const state = stateFor(current.status); setMessage(`${state.label}: ${state.detail}.`);
      } catch { /* keep last known state */ }
    }, 2000); return () => clearInterval(timer);
  }, [deployment?.id, deployment?.status]);

  useEffect(() => {
    if (!deployment) { setLogs(null); return; }
    let stopped = false;
    async function loadLogs() {
      try { const r = await fetch(`${API}/api/v1/deployments/${encodeURIComponent(deployment!.id)}/logs`, { credentials: 'include' }); if (!r.ok || stopped) return; const v = await r.json(); setLogs({ build: v.build ?? v.buildLogs ?? '', runtime: v.runtime ?? v.runtimeLogs ?? '', logs: v.logs ?? '' }); } catch { /* log stream is best effort */ }
    }
    loadLogs();
    if (['ready', 'failed'].includes(deployment.status)) return () => { stopped = true; };
    const timer = setInterval(loadLogs, 2000); return () => { stopped = true; clearInterval(timer); };
  }, [deployment?.id, deployment?.status]);

  async function detect() {
    if (!repo) return setMessage('Enter a Git repository URL first.'); setDetecting(true); setMessage('Inspecting repository services…'); setDetection(null); setService('');
    try { const r = await fetch(`${API}/api/v1/repositories/detect`, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ repo, ref: ref || 'main' }) }); const v = await r.json(); if (!r.ok) throw new Error(v.detail || v.error || 'Repository detection failed'); setDetection(v); const services = v.availableServices ?? []; if (services.length) setService(v.selectedService && services.includes(v.selectedService) ? v.selectedService : services[0]); setMessage(services.length > 1 ? `Detected ${services.length} deployable services. Select the service to deploy.` : services.length === 1 ? `Detected service: ${services[0]}.` : `Detected ${v.runtime ?? 'application'}.`); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Repository detection failed'); } finally { setDetecting(false); }
  }

  async function deploy() {
    if (!projectId) return setMessage('Select or create a project first.'); if (!repo) return setMessage('Enter a Git repository URL first.'); if (detection?.availableServices?.length && !service) return setMessage('Select a repository service before deploying.');
    setBusy(true); setMessage('Queueing deployment…'); setLogs(null);
    try { const r = await fetch(`${API}/api/v1/deployments`, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ projectId, repo, ref: ref || 'main', service: service || undefined, serviceType, public: serviceType === 'web', healthMode: serviceType === 'web' ? 'auto' : 'process', containerPort: Number(containerPort) || 80, healthPath: serviceType === 'web' ? healthPath || '/' : undefined }) }); const v = await r.json(); if (!r.ok) throw new Error(v.detail || v.error || 'Deployment failed'); setDeployment(v); setMessage(`Queued: ${v.id.slice(0, 8)}. Nexus will update this screen as the deployment progresses.`); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Deployment failed'); } finally { setBusy(false); }
  }

  const state = stateFor(deployment?.status); const combinedLogs = [logs?.build ? `=== BUILD ===\n${logs.build}` : '', logs?.runtime ? `=== RUNTIME ===\n${logs.runtime}` : '', logs?.logs ? `=== LOGS ===\n${logs.logs}` : ''].filter(Boolean).join('\n\n');

  return <main className="authPage" style={{ display: 'block', padding: 40 }}><section className="deployModal" style={{ margin: '0 auto', width: 'min(760px,100%)' }}>
    <div className="modalHead"><div><span className="eyebrow">NEXUS / MONOREPO DEPLOYMENT</span><h2>Deploy a repository service</h2></div><a href="/" className="mini" style={{ textDecoration: 'none' }}>Dashboard</a></div>
    <label>Project<select value={projectId} onChange={e => { const p = projects.find(x => x.id === e.target.value); setProjectId(e.target.value); if (p?.repo) setRepo(p.repo); }}><option value="">Select a project…</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Git repository <input value={repo} onChange={e => setRepo(e.target.value)} placeholder="https://github.com/owner/repository" /></label>
    <div className="formGrid"><label>Branch / ref <input value={ref} onChange={e => setRef(e.target.value)} placeholder="main" /></label><label>Service type<select value={serviceType} onChange={e => setServiceType(e.target.value)}><option value="web">Web / API</option><option value="worker">Worker</option><option value="private">Private service</option><option value="cron">Cron / job</option></select></label></div>
    <button className="mini" onClick={detect} disabled={detecting || !repo}>{detecting ? 'Detecting services…' : 'Detect repository services'}</button>
    {detection && <div className="modalNote"><b>Detected: {detection.runtime ?? 'application'}</b><span>{detection.dockerfileGenerated ? 'Nexus can generate the Dockerfile for this runtime.' : 'Nexus found an existing deployable Dockerfile/runtime.'}</span></div>}
    {Boolean(detection?.availableServices?.length) && <label>Repository service<select value={service} onChange={e => setService(e.target.value)}><option value="">Choose a service…</option>{detection!.availableServices!.map(name => <option key={name} value={name}>{name}</option>)}</select><span>Nexus will build only the selected service directory.</span></label>}
    <div className="formGrid"><label>Container port <input type="number" value={containerPort} onChange={e => setContainerPort(e.target.value)} /></label><label>Health path <input value={healthPath} onChange={e => setHealthPath(e.target.value)} disabled={serviceType !== 'web'} /></label></div>
    <button className="deployAction" disabled={busy || !projectId || !repo} onClick={deploy}>{busy ? 'Deploying…' : 'Deploy selected service'}</button>
    {message && <div className="modalNote" style={{ marginTop: 14 }}>{message}</div>}
    {deployment && <div className="capabilities" style={{ marginTop: 14 }}><b>{state.label}</b><span>{state.detail}</span><span>Deployment: {deployment.id}</span><span>Lifecycle: Queued → Building → Starting → Running / Failed</span></div>}
    {deployment && <div className="modalNote" style={{ marginTop: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><b>Deployment logs</b><button className="mini" onClick={() => setShowLogs(v => !v)}>{showLogs ? 'Hide logs' : 'Show logs'}</button></div>{showLogs && <pre style={{ marginTop: 10, maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 12 }}>{combinedLogs || 'Waiting for deployment logs…'}</pre>}</div>}
  </section></main>;
}
