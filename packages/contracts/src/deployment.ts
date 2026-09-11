export type DeploymentStatus = 'queued' | 'building' | 'starting' | 'healthy' | 'failed' | 'stopped';

export interface DeploymentRequest {
  serviceId: string;
  source?: { type: 'image' | 'git'; image?: string; repository?: string; ref?: string };
  env?: Record<string, string>;
  port?: number;
  healthPath?: string;
}

export interface DeploymentRecord extends DeploymentRequest {
  id: string;
  status: DeploymentStatus;
  url?: string;
  containerId?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}
