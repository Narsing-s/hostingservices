import Docker from 'dockerode';
import http from 'node:http';
import { buildFromGit, getBuildLogs } from './build.js';
import { enqueueDeployment, queueStats } from './redis-queue.js';

const docker = process.platform === 'win32' ? new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' }) : new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
const port = Number(process.env.PORT ?? 4100);

type DeployBody = { name: string; image: string; deploymentId?: string; containerPort?: number; hostPort?: number; env?: Record<string, string>; command?: string[]; previousImage?: string; healthMode?: 'auto' | 'http' | 'docker' | 'process'; public?: boolean; healthPath?: string; domain?: string };

function readBody(req: http.IncomingMessage): Promise<string> { return new Promise((resolve, reject) => { let body = ''; req.on('data', (chunk) => { body += chunk; if (body.length > 1_000_000) req.destroy(new Error('request body too large')); }); req.on('end', () => resolve(body)); req.on('error', reject); }); }
function send(res: http.ServerResponse, status: number, value: unknown) { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); }

async function main(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    if (req.url === '/health') { send(res, 200, { ok: true, docker: await docker.ping(), queue: await queueStats() }); return; }
    if (req.url === '/api/v1/queue') { send(res, 200, await queueStats()); return; }
    if (req.url === '/api/v1/runtime/containers') { send(res, 200, await docker.listContainers({ all: true })); return; }
    if (req.url?.startsWith('/api/v1/runtime/build-logs/')) { const deploymentId = decodeURIComponent(req.url.split('/').pop()!); send(res, 200, { deploymentId, logs: getBuildLogs(deploymentId) }); return; }
    if ((req.url === '/api/v1/runtime/deploy' || req.url === '/api/v1/runtime/rollback') && req.method === 'POST') {
      const body = JSON.parse(await readBody(req)) as DeployBody; const rollback = req.url.endsWith('/rollback');
      if (!body.name || (!rollback && !body.image) || (rollback && !body.previousImage)) { send(res, 400, { error: rollback ? 'name and previousImage are required' : 'name and image are required' }); return; }
      if (body.command && (!Array.isArray(body.command) || body.command.length > 32 || body.command.some((part) => typeof part !== 'string' || part.length > 2000))) { send(res, 400, { error: 'command must be an array of up to 32 strings' }); return; }
      if (body.healthMode && !['auto', 'http', 'docker', 'process'].includes(body.healthMode)) { send(res, 400, { error: 'invalid healthMode' }); return; }
      const idempotencyKey = req.headers['idempotency-key']?.toString();
      const job = await enqueueDeployment({ operation: rollback ? 'rollback' : 'deploy', ...body }, idempotencyKey);
      send(res, 202, { accepted: true, queued: true, jobId: job.id, deploymentId: body.deploymentId, name: body.name }); return;
    }
    if (req.url === '/api/v1/runtime/build' && req.method === 'POST') { const body = JSON.parse(await readBody(req)); if (!body.repo || !body.image) { send(res, 400, { error: 'repo and image are required' }); return; } send(res, 200, await buildFromGit(body)); return; }
    if (req.url?.startsWith('/api/v1/runtime/logs/')) { const name = decodeURIComponent(req.url.split('/').pop()!); const logs = await docker.getContainer(name).logs({ stdout: true, stderr: true, tail: 200 }); send(res, 200, { name, logs: logs.toString() }); return; }
    send(res, 404, { error: 'Not found' });
  } catch (error) { send(res, 500, { error: error instanceof Error ? error.message : String(error) }); }
}
http.createServer(main).listen(port, '0.0.0.0', () => console.log(`Nexus engine listening on ${port}`));
