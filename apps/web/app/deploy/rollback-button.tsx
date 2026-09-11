'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_NEXUS_API_URL ?? 'http://localhost:4000';

export default function RollbackButton({ deploymentId, disabled = false, onComplete }: { deploymentId: string; disabled?: boolean; onComplete?: (value: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function rollback() {
    if (!window.confirm('Rollback this deployment to the previous healthy version?')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/api/v1/deployments/${encodeURIComponent(deploymentId)}/rollback`, { method: 'POST', credentials: 'include' });
      const value = await response.json();
      if (!response.ok) throw new Error(value.detail || value.error || 'Rollback failed');
      onComplete?.(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollback failed');
    } finally { setBusy(false); }
  }

  return <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
    <button className="mini" disabled={disabled || busy} onClick={rollback}>{busy ? 'Rolling back…' : 'Rollback'}</button>
    {error && <small>{error}</small>}
  </span>;
}
