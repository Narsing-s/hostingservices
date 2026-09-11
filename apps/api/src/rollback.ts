import { updateDeployment } from './db.js';

export async function rollbackDeployment(args: {
  id: string;
  engineUrl: string;
  previousImage: string;
  name: string;
  containerPort?: number;
  hostPort?: number;
  healthMode?: 'auto' | 'http' | 'docker' | 'process';
  public?: boolean;
  healthPath?: string;
  domain?: string;
  env?: Record<string, string>;
}) {
  await updateDeployment(args.id, 'rolling_back');
  try {
    const response = await fetch(`${args.engineUrl}/api/v1/runtime/rollback`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': `rollback:${args.id}`
      },
      body: JSON.stringify({
        deploymentId: args.id,
        name: args.name,
        previousImage: args.previousImage,
        containerPort: args.containerPort,
        hostPort: args.hostPort,
        healthMode: args.healthMode,
        public: args.public,
        healthPath: args.healthPath,
        domain: args.domain,
        env: args.env
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result));
    return result;
  } catch (error) {
    await updateDeployment(args.id, 'failed', { rollbackError: String(error) });
    throw error;
  }
}
