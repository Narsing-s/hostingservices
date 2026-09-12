export type DeploymentState =
  | 'QUEUED' | 'CLONING' | 'DETECTING' | 'BUILDING' | 'TESTING' | 'SECURITY_SCAN'
  | 'PROVISIONING' | 'DEPLOYING' | 'HEALTH_CHECK' | 'TRAFFIC_SHIFT' | 'LIVE'
  | 'DIAGNOSING' | 'AUTO_RECOVERY' | 'ROLLING_BACK' | 'FAILED' | 'STOPPED';

export const terminalDeploymentStates = new Set<DeploymentState>(['LIVE', 'FAILED', 'STOPPED']);

const allowedTransitions: Record<DeploymentState, DeploymentState[]> = {
  QUEUED: ['CLONING', 'FAILED', 'STOPPED'],
  CLONING: ['DETECTING', 'FAILED', 'STOPPED'],
  DETECTING: ['BUILDING', 'FAILED', 'STOPPED'],
  BUILDING: ['TESTING', 'FAILED', 'STOPPED'],
  TESTING: ['SECURITY_SCAN', 'PROVISIONING', 'FAILED', 'STOPPED'],
  SECURITY_SCAN: ['PROVISIONING', 'FAILED', 'STOPPED'],
  PROVISIONING: ['DEPLOYING', 'FAILED', 'STOPPED'],
  DEPLOYING: ['HEALTH_CHECK', 'FAILED', 'STOPPED'],
  HEALTH_CHECK: ['TRAFFIC_SHIFT', 'LIVE', 'DIAGNOSING', 'FAILED', 'STOPPED'],
  TRAFFIC_SHIFT: ['LIVE', 'ROLLING_BACK', 'DIAGNOSING', 'FAILED'],
  LIVE: ['DIAGNOSING', 'ROLLING_BACK', 'STOPPED'],
  DIAGNOSING: ['AUTO_RECOVERY', 'ROLLING_BACK', 'FAILED'],
  AUTO_RECOVERY: ['HEALTH_CHECK', 'LIVE', 'ROLLING_BACK', 'FAILED'],
  ROLLING_BACK: ['HEALTH_CHECK', 'LIVE', 'FAILED'],
  FAILED: ['AUTO_RECOVERY', 'ROLLING_BACK', 'STOPPED'],
  STOPPED: [],
};

export type DeploymentRecord = {
  id: string;
  serviceId: string;
  status: DeploymentState;
  image?: string;
  containerId?: string;
  url?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  version?: string;
  recoveryPointId?: string;
};

const records = new Map<string, DeploymentRecord>();

export function createDeployment(input: { id: string; serviceId: string; image?: string; version?: string; recoveryPointId?: string }): DeploymentRecord {
  const now = new Date().toISOString();
  const record: DeploymentRecord = { id: input.id, serviceId: input.serviceId, image: input.image, version: input.version, recoveryPointId: input.recoveryPointId, status: 'QUEUED', createdAt: now, updatedAt: now };
  records.set(record.id, record);
  return record;
}

export function canTransition(from: DeploymentState, to: DeploymentState): boolean {
  return from === to || allowedTransitions[from].includes(to);
}

export function updateDeployment(id: string, patch: Partial<Omit<DeploymentRecord, 'id' | 'createdAt'>>) {
  const current = records.get(id);
  if (!current) return undefined;
  if (patch.status && !canTransition(current.status, patch.status)) {
    throw new Error(`Invalid deployment transition: ${current.status} -> ${patch.status}`);
  }
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  records.set(id, next);
  return next;
}

export function getDeployment(id: string) { return records.get(id); }
export function listDeployments() { return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
