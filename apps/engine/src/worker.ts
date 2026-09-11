import { createDeploymentWorker } from './redis-queue.js';
import { deployRuntime, rollbackRuntime } from './deploy.js';

createDeploymentWorker(async (job) => {
  if (job.data.operation === 'rollback') {
    if (!job.data.previousImage) throw new Error('previousImage is required for rollback');
    await rollbackRuntime({
      name: job.data.name,
      image: job.data.image,
      previousImage: job.data.previousImage,
      containerPort: job.data.containerPort,
      hostPort: job.data.hostPort,
      env: job.data.env,
    });
    return;
  }

  await deployRuntime({
    name: job.data.name,
    image: job.data.image,
    containerPort: job.data.containerPort,
    hostPort: job.data.hostPort,
    env: job.data.env,
  });
});

console.log('Nexus deployment worker started');
