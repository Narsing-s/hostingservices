export type DeploymentState = 'QUEUED' | 'BUILDING' | 'STARTING' | 'HEALTHY' | 'FAILED' | 'STOPPED';

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
};

const records = new Map<string, DeploymentRecord>();

export function createDeployment(input: { id: string; serviceId: string; image?: string }): DeploymentRecord {
  const now = new Date().toISOString();
  const record: DeploymentRecord = { id: input.id, serviceId: input.serviceId, image: input.image, status: 'QUEUED', createdAt: now, updatedAt: now };
  records.set(record.id, record);
  return record;
}

export function updateDeployment(id: string, patch: Partial<Omit<DeploymentRecord, 'id' | 'createdAt'>>) {
  const current = records.get(id);
  if (!current) return undefined;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  records.set(id, next);
  return next;
}

export function getDeployment(id: string) { return records.get(id); }
export function listDeployments() { return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
