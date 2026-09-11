import Fastify from 'fastify';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const projects = new Map<string, { id:string; name:string; repo?:string; createdAt:string }>();
const deployments = new Map<string, { id:string; projectId:string; status:string; createdAt:string }>();

app.get('/health', async () => ({ ok:true, service:'nexus-api', timestamp:new Date().toISOString() }));
app.get('/api/v1/projects', async () => [...projects.values()]);
app.post<{Body:{name:string;repo?:string}}>('/api/v1/projects', async (req, reply) => {
  const id = crypto.randomUUID();
  const project = { id, name:req.body.name, repo:req.body.repo, createdAt:new Date().toISOString() };
  projects.set(id, project);
  return reply.code(201).send(project);
});
app.get('/api/v1/deployments', async () => [...deployments.values()]);
app.post<{Body:{projectId:string}}>('/api/v1/deployments', async (req, reply) => {
  if (!projects.has(req.body.projectId)) return reply.code(404).send({ error:'Project not found' });
  const id = crypto.randomUUID();
  const deployment = { id, projectId:req.body.projectId, status:'queued', createdAt:new Date().toISOString() };
  deployments.set(id, deployment);
  return reply.code(202).send(deployment);
});

const port = Number(process.env.PORT ?? 4000);
await app.listen({ host:'0.0.0.0', port });
