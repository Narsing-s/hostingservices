import type { RecoveryPoint } from './index.js';

export type RecoveryStore = {
  create(point: RecoveryPoint): Promise<RecoveryPoint>;
  get(id: string): Promise<RecoveryPoint | undefined>;
  list(projectId: string, environmentId: string): Promise<RecoveryPoint[]>;
};

export function recoveryPointId(projectId: string, environmentId: string, deploymentId: string): string {
  return `rp_${projectId}_${environmentId}_${deploymentId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}
