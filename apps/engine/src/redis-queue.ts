import { Queue, QueueEvents, Worker, type Job } from 'bullmq';

export type DeploymentJob = {
  operation: 'deploy' | 'rollback';
  name: string;
  image: string;
  nodeName?: string;
  previousImage?: string;
  deploymentId?: string;
  containerPort?: number;
  hostPort?: number;
  replicas?: number;
  zeroDowntime?: boolean;
  rollbackOnFailure?: boolean;
  autoscale?: { min: number; max: number; cpuPercent: number; intervalSeconds?: number };
  env?: Record<string, string>;
  command?: string[];
  healthMode?: 'auto' | 'http' | 'docker' | 'process';
  public?: boolean;
  healthPath?: string;
  domain?: string;
  cpuNanoCpus?: number;
  memoryBytes?: number;
  pidsLimit?: number;
  volumeBinds?: string[];
};

function connection() {
  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const parsed = new URL(url);
  return { host: parsed.hostname, port: Number(parsed.port || 6379), username: parsed.username || undefined, password: parsed.password || undefined, maxRetriesPerRequest: null };
}

const queuePrefix = process.env.DEPLOYMENT_QUEUE_PREFIX ?? 'nexus-deployments';
function queueName(nodeName?: string) {
  const node = String(nodeName ?? process.env.NODE_NAME ?? 'local').trim().replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'local';
  return `${queuePrefix}:${node}`;
}

export function deploymentQueueFor(nodeName?: string) {
  return new Queue<DeploymentJob>(queueName(nodeName), {
    connection: connection(),
    defaultJobOptions: { attempts: Number(process.env.DEPLOYMENT_RETRIES ?? 3), backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { age: 24 * 60 * 60, count: 1000 }, removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 } },
  });
}

export const deploymentQueue = deploymentQueueFor();
export const deploymentEvents = new QueueEvents(queueName(), { connection: connection() });

export async function enqueueDeployment(job: DeploymentJob, idempotencyKey?: string) {
  const queue = deploymentQueueFor(job.nodeName);
  const jobId = idempotencyKey?.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 200);
  const existing = jobId ? await queue.getJob(jobId) : undefined;
  if (existing) return existing;
  return queue.add(job.operation, job, jobId ? { jobId } : undefined);
}

export async function queueStats(nodeName?: string) {
  return deploymentQueueFor(nodeName).getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
}

export function createDeploymentWorker(handler: (job: Job<DeploymentJob>) => Promise<void>) {
  const nodeName = process.env.NODE_NAME ?? 'local';
  const worker = new Worker<DeploymentJob>(queueName(nodeName), handler, {
    connection: connection(),
    concurrency: Number(process.env.DEPLOYMENT_CONCURRENCY ?? 2),
    limiter: { max: Number(process.env.DEPLOYMENT_RATE_LIMIT ?? 20), duration: 1000 },
  });
  worker.on('completed', (job) => console.log(`[deployment:${nodeName}] completed ${job.id}`));
  worker.on('failed', (job, error) => console.error(`[deployment:${nodeName}] failed ${job?.id}: ${error.message}`));
  return worker;
}
