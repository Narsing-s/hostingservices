'use client';

import { useEffect, useState } from 'react';

const API = '/api/nexus';

type Version = { id: string; status: string; image: string; repo?: string; createdAt: string; service?: string | null; current?: boolean };

export default function RollbackButton({ deploymentId, disabled = false, onComplete }: { deploymentId: string; disabled?: boolean; onComplete?: (value: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [versions, setVersions] = useState<Version[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  async function loadVersions() {
    try {
      const response = await fetch(`${API}/v1/deployments/${encodeURIComponent(deploymentId)}/versions`, { credentials: 'include' });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Could not load deployment history');
      setVersions(value.versions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load deployment history');
    }
  }

  useEffect(() => { if (!disabled) void loadVersions(); }, [deploymentId, disabled]);

  async function rollbackTo(target: Version) {
    if (!window.confirm(`Rollback to ${target.id.slice(0, 8)} from ${new Date(target.createdAt).toLocaleString()}?`)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/v1/deployments/${encodeURIComponent(deploymentId)}/rollback-to`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetDeploymentId: target.id })
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.detail || value.error || 'Rollback failed');
      onComplete?.(value);
      await loadVersions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollback failed');
    } finally { setBusy(false); }
  }

  async function rollbackPrevious() {
    const previous = versions.find(version => !version.current);
    if (!previous) { setError('No previous healthy version is available for rollback.'); return; }
    await rollbackTo(previous);
  }

  return <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 8, width: 'min(100%, 460px)' }}>
    <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button className="mini" disabled={disabled || busy || !versions.some(v => !v.current)} onClick={rollbackPrevious}>{busy ? 'Rolling back…' : 'Rollback previous'}</button>
      <button className="mini" disabled={disabled || busy} onClick={() => { setShowHistory(v => !v); if (!showHistory) void loadVersions(); }}>{showHistory ? 'Hide versions' : 'Choose version'}</button>
    </span>
    {showHistory && <span style={{ display: 'grid', gap: 6, marginTop: 4 }}>
      {versions.length === 0 ? <small>No healthy deployment versions are available yet.</small> : versions.map(version => <span key={version.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8 }}>
        <span style={{ minWidth: 0 }}><b>{version.current ? 'Current' : `v ${version.id.slice(0, 8)}`}</b><small style={{ display: 'block' }}>{new Date(version.createdAt).toLocaleString()} · {version.service ?? 'service'}</small></span>
        {!version.current && <button className="mini" disabled={busy} onClick={() => void rollbackTo(version)}>Restore</button>}
      </span>)}
    </span>}
    {error && <small>{error}</small>}
  </span>;
}
