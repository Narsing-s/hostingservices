import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const ENGINE_URL = process.env.ENGINE_URL ?? 'http://localhost:4100';

type Project = { id: string; name: string; repo?: string; createdAt: string };
type Deployment = { id: string; projectId: string; status: string; runtime?: unknown; createdAt: string; image: string; repo?: string };

const projects = new Map<string, Project>();
const deployments = new Map<string, Deployment>();

app.get('/health', async () => ({ ok: true, service: 'nexus-api', engine: ENGINE_URL, timestamp: new Date().toISOString() }));
app.get('/api/v1/projects', async () => [...projects.values()]);

app.post('/api/v1/projects', async (req, reply) => {
  const body = z.object({ name: z.string().min(1).max(100), repo: z.string().url().optional() }).parse(req.body);
  const project: Project = { id: crypto.randomUUID(), ...body, createdAt: new Date().toISOString() };
  projects.set(project.id, project);
  return reply.code(201).send(project);
});

app.get('/api/v1/deployments', async () => [...deployments.values()].reverse());

app.post('/api/v1/deployments', async (req, reply) => {
  const body = z.object({
    projectId: z.string(),
    repo: z.string().url().optional(),
    ref: z.string().min(1).default('main'),
    image: z.string().min(1).optional(),
    hostPort: z.number().int().min(1).max(65535).optional(),
    containerPort: z.number().int().min(1).max(65535).default(80)
  }).parse(req.body);

  if (!projects.has(body.projectId)) return reply.code(404).send({ error: 'Project not found' });
  if (!body.repo && !body.image) return reply.code(400).send({ error: 'repo or image is required' });

  const id = crypto.randomUUID();
  const image = body.repo ? (body.image ?? `nexus/build:${id.slice(0, 12)}`) : body.image!;
  const deployment: Deployment = {
    id,
    projectId: body.projectId,
    repo: body.repo,
    image,
    status: body.repo ? 'building' : 'queued',
    createdAt: new Date().toISOString()
  };
  deployments.set(id, deployment);

  try {
    if (body.repo) {
      const build = await fetch(`${ENGINE_URL}/api/v1/runtime/build`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repo: body.repo, ref: body.ref, image })
      });
      const buildResult = await build.json();
      if (!build.ok) throw new Error(JSON.stringify(buildResult));
    }

    deployment.status = 'starting';
    const runtimeResponse = await fetch(`${ENGINE_URL}/api/v1/runtime/deploy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `nexus-${id.slice(0, 8)}`,
        image,
        containerPort: body.containerPort,
        hostPort: body.hostPort
      })
    });
    const runtime = await runtimeResponse.json();
    if (!runtimeResponse.ok) throw new Error(JSON.stringify(runtime));

    deployment.status = 'ready';
    deployment.runtime = runtime;
    return reply.code(201).send(deployment);
  } catch (error) {
    deployment.status = 'failed';
    return reply.code(502).send({ error: 'Runtime deployment failed', detail: String(error), deployment });
  }
});

await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 4000) });
