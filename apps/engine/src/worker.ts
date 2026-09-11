import { createDeploymentWorker } from './redis-queue.js';
import { deployRuntime, rollbackRuntime } from './deploy.js';

const callbackUrl = process.env.ENGINE_CALLBACK_URL ?? 'http://127.0.0.1:4000';
const callbackSecret = process.env.ENGINE_CALLBACK_SECRET ?? '';

async function report(deploymentId: string | undefined, status: 'starting' | 'ready' | 'failed' | 'rolling_back', runtime?: unknown) {
  if (!deploymentId) return;
  try {
    const response = await fetch(`${callbackUrl}/api/v1/deployments/${encodeURIComponent(deploymentId)}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(callbackSecret ? { 'x-engine-secret': callbackSecret } : {}) },
      body: JSON.stringify({ status, runtime }),
    });
    if (!response.ok) console.error(`[deployment] lifecycle callback failed: ${response.status}`);
  } catch (error) {
    console.error(`[deployment] lifecycle callback error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

createDeploymentWorker(async (job) => {
  const { deploymentId } = job.data;
  await report(deploymentId, job.data.operation === 'rollback' ? 'rolling_back' : 'starting');
  try {
    let runtime;
    if (job.data.operation === 'rollback') {
      if (!job.data.previousImage) throw new Error('previousImage is required for rollback');
      runtime = await rollbackRuntime({ name: job.data.name, image: job.data.image, previousImage: job.data.previousImage, containerPort: job.data.containerPort, hostPort: job.data.hostPort, env: job.data.env, healthPath: job.data.healthPath });
    } else {
      runtime = await deployRuntime({ name: job.data.name, image: job.data.image, containerPort: job.data.containerPort, hostPort: job.data.hostPort, env: job.data.env, healthPath: job.data.healthPath });
    }
    await report(deploymentId, 'ready', runtime);
  } catch (error) {
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    if (finalAttempt) await report(deploymentId, 'failed', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
});

console.log('Nexus deployment worker started');
