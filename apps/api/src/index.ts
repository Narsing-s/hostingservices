import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { createDeployment, createProject, findProjectByRepo, initDb, listDeployments, listProjects, projectExists, updateDeployment } from './db.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
const ENGINE_URL = process.env.ENGINE_URL ?? 'http://localhost:4100';

app.get('/health', async () => ({ ok: true, service: 'nexus-api', engine: ENGINE_URL, timestamp: new Date().toISOString() }));
app.get('/api/v1/projects', async () => listProjects());
app.post('/api/v1/projects', async (req, reply) => {
  const body = z.object({ name: z.string().min(1).max(100), repo: z.string().url().optional() }).parse(req.body);
  const project = { id: crypto.randomUUID(), ...body, createdAt: new Date().toISOString() };
  await createProject(project); return reply.code(201).send(project);
});
app.get('/api/v1/deployments', async () => listDeployments());
app.get('/api/v1/deployments/:id/logs', async (req, reply) => {
  const id = (req.params as { id:string }).id;
  const deployment = (await listDeployments()).find((item: any) => item.id === id) as any;
  if (!deployment) return reply.code(404).send({ error: 'Deployment not found' });
  const runtimeName = deployment.runtime?.name;
  if (!runtimeName) return reply.send({ deploymentId: id, logs: '', status: deployment.status });
  const response = await fetch(`${ENGINE_URL}/api/v1/runtime/logs/${encodeURIComponent(runtimeName)}`);
  const result = await response.json();
  if (!response.ok) return reply.code(502).send({ error: 'Runtime log request failed', detail: result });
  return reply.send({ deploymentId: id, status: deployment.status, logs: result.logs ?? '' });
});

app.post('/api/v1/deployments', async (req, reply) => {
  const body = z.object({ projectId: z.string(), repo: z.string().url().optional(), ref: z.string().min(1).default('main'), image: z.string().min(1).optional(), hostPort: z.number().int().min(1).max(65535).optional(), containerPort: z.number().int().min(1).max(65535).default(80) }).parse(req.body);
  if (!(await projectExists(body.projectId))) return reply.code(404).send({ error: 'Project not found' });
  if (!body.repo && !body.image) return reply.code(400).send({ error: 'repo or image is required' });
  const id = crypto.randomUUID(); const image = body.repo ? (body.image ?? `nexus/build:${id.slice(0, 12)}`) : body.image!;
  const deployment = { id, projectId: body.projectId, repo: body.repo, image, status: body.repo ? 'building' : 'queued', createdAt: new Date().toISOString() };
  await createDeployment(deployment);
  try {
    if (body.repo) { const build = await fetch(`${ENGINE_URL}/api/v1/runtime/build`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ repo:body.repo, ref:body.ref, image }) }); const result = await build.json(); if (!build.ok) throw new Error(JSON.stringify(result)); }
    await updateDeployment(id, 'starting');
    const runtimeResponse = await fetch(`${ENGINE_URL}/api/v1/runtime/deploy`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ name:`nexus-${id.slice(0,8)}`, image, containerPort:body.containerPort, hostPort:body.hostPort }) });
    const runtime = await runtimeResponse.json(); if (!runtimeResponse.ok) throw new Error(JSON.stringify(runtime));
    await updateDeployment(id, 'ready', runtime); return reply.code(201).send({ ...deployment, status:'ready', runtime });
  } catch (error) { await updateDeployment(id, 'failed'); return reply.code(502).send({ error:'Runtime deployment failed', detail:String(error), deployment:{...deployment,status:'failed'} }); }
});

function verifyGithubSignature(payload: string, signature: string | undefined) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const provided = signature.slice(7); if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

app.post('/api/webhooks/github', async (req, reply) => {
  const raw = JSON.stringify(req.body ?? {});
  if (!verifyGithubSignature(raw, req.headers['x-hub-signature-256'] as string | undefined)) return reply.code(401).send({ error:'Invalid GitHub webhook signature' });
  const event = String(req.headers['x-github-event'] ?? ''); const payload = req.body as any;
  if (event !== 'push') return reply.send({ accepted:true, ignored:true, event });
  const repo = payload.repository?.clone_url as string | undefined; const ref = String(payload.ref ?? '').replace(/^refs\/heads\//, '');
  if (!repo || !ref) return reply.code(400).send({ error:'GitHub push payload missing repository/ref' });
  let project = await findProjectByRepo(repo);
  if (!project) { project = { id:crypto.randomUUID(), name:String(payload.repository?.name ?? 'github-project'), repo, createdAt:new Date().toISOString() }; await createProject(project); }
  const response = await fetch(`http://127.0.0.1:${process.env.PORT ?? 4000}/api/v1/deployments`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ projectId:project.id, repo, ref, containerPort:80 }) });
  return reply.code(response.ok ? 202 : 502).send({ accepted:response.ok, deployment:await response.json() });
});

await initDb();
await app.listen({ host:'0.0.0.0', port:Number(process.env.PORT ?? 4000) });
