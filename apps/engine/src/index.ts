import Docker from 'dockerode';
import http from 'node:http';
import { buildFromGit } from './build.js';
import { deployRuntime, rollbackRuntime, type RuntimeSpec } from './deploy.js';
import { DeploymentQueue } from './queue.js';

const docker = process.platform === 'win32'
  ? new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' })
  : new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
const port = Number(process.env.PORT ?? 4100);
const queue = new DeploymentQueue();

type DeployBody = RuntimeSpec & { previousImage?: string };

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy(new Error('request body too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function send(res: http.ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(value));
}

async function main(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    if (req.url === '/health') {
      send(res, 200, { ok: true, docker: await docker.ping(), queue: queue.stats() });
      return;
    }

    if (req.url === '/api/v1/queue') {
      send(res, 200, queue.stats());
      return;
    }

    if (req.url === '/api/v1/runtime/containers') {
      send(res, 200, await docker.listContainers({ all: true }));
      return;
    }

    if (req.url === '/api/v1/runtime/deploy' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req)) as RuntimeSpec;
      if (!body.name || !body.image) {
        send(res, 400, { error: 'name and image are required' });
        return;
      }
      send(res, 202, { accepted: true, queued: true, name: body.name });
      queue.enqueue(async () => {
        try {
          const result = await deployRuntime(body);
          console.log(JSON.stringify({ event: 'deployment.succeeded', ...result }));
        } catch (error) {
          console.error(JSON.stringify({ event: 'deployment.failed', name: body.name, error: String(error) }));
        }
      });
      return;
    }

    if (req.url === '/api/v1/runtime/rollback' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req)) as DeployBody;
      if (!body.name || !body.previousImage) {
        send(res, 400, { error: 'name and previousImage are required' });
        return;
      }
      send(res, 202, { accepted: true, queued: true, name: body.name, image: body.previousImage });
      queue.enqueue(async () => {
        try {
          const result = await rollbackRuntime(body as RuntimeSpec & { previousImage: string });
          console.log(JSON.stringify({ event: 'rollback.succeeded', ...result }));
        } catch (error) {
          console.error(JSON.stringify({ event: 'rollback.failed', name: body.name, error: String(error) }));
        }
      });
      return;
    }

    if (req.url === '/api/v1/runtime/build' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      if (!body.repo || !body.image) {
        send(res, 400, { error: 'repo and image are required' });
        return;
      }
      send(res, 200, await buildFromGit(body));
      return;
    }

    if (req.url?.startsWith('/api/v1/runtime/logs/')) {
      const name = decodeURIComponent(req.url.split('/').pop()!);
      const logs = await docker.getContainer(name).logs({ stdout: true, stderr: true, tail: 200 });
      send(res, 200, { name, logs: logs.toString() });
      return;
    }

    send(res, 404, { error: 'Not found' });
  } catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

http.createServer(main).listen(port, '0.0.0.0', () => {
  console.log(`Nexus engine listening on ${port}`);
});
