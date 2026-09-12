import Docker from 'dockerode';
import http from 'node:http';
import { buildFromGit, detectFromGit, getBuildLogs } from './build.js';
import { enqueueDeployment, queueStats } from './redis-queue.js';
import { provisionManagedData } from './managed-data.js';
const docker = process.platform === 'win32' ? new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' }) : new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
const port = Number(process.env.PORT ?? 4100);
type DeployBody = { name: string; image: string; deploymentId?: string; containerPort?: number; hostPort?: number; replicas?: number; zeroDowntime?: boolean; rollbackOnFailure?: boolean; autoscale?: { min: number; max: number; cpuPercent: number; intervalSeconds?: number }; env?: Record<string, string>; command?: string[]; previousImage?: string; healthMode?: 'auto' | 'http' | 'docker' | 'process'; public?: boolean; healthPath?: string; domain?: string; cpuNanoCpus?: number; memoryBytes?: number; pidsLimit?: number; volumeBinds?: string[] };
function readBody(req: http.IncomingMessage): Promise<string> { return new Promise((resolve, reject) => { let body = ''; req.on('data', (chunk) => { body += chunk; if (body.length > 1_000_000) req.destroy(new Error('request body too large')); }); req.on('end', () => resolve(body)); req.on('error', reject); }); }
function send(res: http.ServerResponse, status: number, value: unknown) { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); }
async function main(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    if (req.url === '/health') { send(res, 200, { ok: true, docker: await docker.ping(), queue: await queueStats() }); return; }
    if (req.url === '/api/v1/queue') { send(res, 200, await queueStats()); return; }
    if (req.url === '/api/v1/runtime/containers') { send(res, 200, await docker.listContainers({ all: true })); return; }
    if (req.url?.startsWith('/api/v1/runtime/build-logs/')) { const deploymentId = decodeURIComponent(req.url.split('/').pop()!); send(res, 200, { deploymentId, logs: getBuildLogs(deploymentId) }); return; }
    if (req.url === '/api/v1/runtime/detect' && req.method === 'POST') { const body = JSON.parse(await readBody(req)); if (!body.repo) { send(res, 400, { error: 'repo is required' }); return; } send(res, 200, await detectFromGit(body)); return; }
    if (req.url === '/api/v1/managed-data/provision' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req)) as {instanceId?:string;engine?:'postgres'|'redis';version?:string;name?:string};
      if (!body.instanceId || !['postgres','redis'].includes(body.engine||'')) { send(res,400,{error:'instanceId and engine(postgres|redis) are required'}); return; }
      const result=await provisionManagedData({instanceId:body.instanceId,engine:body.engine!,version:body.version,name:body.name});
      send(res,201,{ok:true,...result}); return;
    }
    if ((req.url === '/api/v1/runtime/deploy' || req.url === '/api/v1/runtime/rollback') && req.method === 'POST') {
      const body = JSON.parse(await readBody(req)) as DeployBody; const rollback = req.url.endsWith('/rollback');
      if (!body.name || (!rollback && !body.image) || (rollback && !body.previousImage)) { send(res, 400, { error: rollback ? 'name and previousImage are required' : 'name and image are required' }); return; }
      if (body.replicas !== undefined && (!Number.isInteger(body.replicas) || body.replicas < 1 || body.replicas > 20)) { send(res, 400, { error: 'replicas must be an integer between 1 and 20' }); return; }
      if (body.cpuNanoCpus !== undefined && (!Number.isFinite(body.cpuNanoCpus) || body.cpuNanoCpus < 10_000_000 || body.cpuNanoCpus > 64_000_000_000)) { send(res, 400, { error: 'cpuNanoCpus must be between 10m and 64 CPUs' }); return; }
      if (body.memoryBytes !== undefined && (!Number.isFinite(body.memoryBytes) || body.memoryBytes < 16 * 1024 * 1024 || body.memoryBytes > 256 * 1024 * 1024 * 1024)) { send(res, 400, { error: 'memoryBytes must be between 16MiB and 256GiB' }); return; }
      if (body.pidsLimit !== undefined && (!Number.isInteger(body.pidsLimit) || body.pidsLimit < 32 || body.pidsLimit > 100000)) { send(res, 400, { error: 'pidsLimit must be between 32 and 100000' }); return; }
      if (body.volumeBinds && (!Array.isArray(body.volumeBinds) || body.volumeBinds.length > 16 || body.volumeBinds.some((v) => typeof v !== 'string' || v.length > 1000))) { send(res, 400, { error: 'volumeBinds must contain at most 16 strings' }); return; }
      if (body.autoscale && (!Number.isInteger(body.autoscale.min) || !Number.isInteger(body.autoscale.max) || body.autoscale.min < 1 || body.autoscale.max > 20 || body.autoscale.max < body.autoscale.min || body.autoscale.cpuPercent < 1 || body.autoscale.cpuPercent > 100 || (body.autoscale.intervalSeconds !== undefined && (body.autoscale.intervalSeconds < 10 || body.autoscale.intervalSeconds > 300)))) { send(res, 400, { error: 'autoscale must have 1<=min<=max<=20, cpuPercent 1-100 and intervalSeconds 10-300' }); return; }
      if (body.zeroDowntime !== undefined && typeof body.zeroDowntime !== 'boolean') { send(res, 400, { error: 'zeroDowntime must be boolean' }); return; }
      if (body.rollbackOnFailure !== undefined && typeof body.rollbackOnFailure !== 'boolean') { send(res, 400, { error: 'rollbackOnFailure must be boolean' }); return; }
      if (body.command && (!Array.isArray(body.command) || body.command.length > 32 || body.command.some((part) => typeof part !== 'string' || part.length > 2000))) { send(res, 400, { error: 'command must be an array of up to 32 strings' }); return; }
      if (body.healthMode && !['auto', 'http', 'docker', 'process'].includes(body.healthMode)) { send(res, 400, { error: 'invalid healthMode' }); return; }
      const idempotencyKey = req.headers['idempotency-key']?.toString();
      const job = await enqueueDeployment({ operation: rollback ? 'rollback' : 'deploy', ...body }, idempotencyKey);
      send(res, 202, { accepted: true, queued: true, jobId: job.id, deploymentId: body.deploymentId, name: body.name, replicas: body.replicas ?? 1, autoscale: body.autoscale ?? null }); return;
    }
    if (req.url === '/api/v1/runtime/build' && req.method === 'POST') { const body = JSON.parse(await readBody(req)); if (!body.repo || !body.image) { send(res, 400, { error: 'repo and image are required' }); return; } send(res, 200, await buildFromGit(body)); return; }
    if (req.url?.startsWith('/api/v1/runtime/logs/')) { const name = decodeURIComponent(req.url.split('/').pop()!); const logs = await docker.getContainer(name).logs({ stdout: true, stderr: true, tail: 200 }); send(res, 200, { name, logs: logs.toString() }); return; }
    send(res, 404, { error: 'Not found' });
  } catch (error) { send(res, 500, { error: error instanceof Error ? error.message : String(error) }); }
}
http.createServer(main).listen(port, '0.0.0.0', () => console.log(`Nexus engine listening on ${port}`));
