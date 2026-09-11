import { Queue, QueueEvents, Worker, type Job } from 'bullmq';

export type DeploymentJob = {
  operation: 'deploy' | 'rollback';
  name: string;
  image: string;
  previousImage?: string;
  containerPort?: number;
  hostPort?: number;
  env?: Record<string, string>;
};

function connection() {
  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
  };
}

export const deploymentQueue = new Queue<DeploymentJob>('nexus-deployments', {
  connection: connection(),
  defaultJobOptions: {
    attempts: Number(process.env.DEPLOYMENT_RETRIES ?? 3),
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
    removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
  },
});

export const deploymentEvents = new QueueEvents('nexus-deployments', {
  connection: connection(),
});

export async function enqueueDeployment(job: DeploymentJob, idempotencyKey?: string) {
  const jobId = idempotencyKey?.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 200);
  const existing = jobId ? await deploymentQueue.getJob(jobId) : undefined;
  if (existing) return existing;
  return deploymentQueue.add(job.operation, job, jobId ? { jobId } : undefined);
}

export async function queueStats() {
  const counts = await deploymentQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
  return counts;
}

export function createDeploymentWorker(handler: (job: Job<DeploymentJob>) => Promise<void>) {
  const worker = new Worker<DeploymentJob>('nexus-deployments', handler, {
    connection: connection(),
    concurrency: Number(process.env.DEPLOYMENT_CONCURRENCY ?? 2),
    limiter: { max: Number(process.env.DEPLOYMENT_RATE_LIMIT ?? 20), duration: 1000 },
  });
  worker.on('completed', (job) => console.log(`[deployment] completed ${job.id}`));
  worker.on('failed', (job, error) => console.error(`[deployment] failed ${job?.id}: ${error.message}`));
  return worker;
}
