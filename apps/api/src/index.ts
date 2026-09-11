import Fastify from 'fastify';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
const engineUrl = process.env.ENGINE_URL ?? 'http://localhost:4100';
app.get('/health', async () => ({ ok: true, service: 'nexus-api', engineUrl }));
app.post('/api/deployments', async (request, reply) => {
  const response = await fetch(`${engineUrl}/deployments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request.body) });
  return reply.code(response.status).send(await response.json());
});
app.get('/api/deployments/:id', async (request, reply) => {
  const id = (request.params as { id: string }).id;
  const response = await fetch(`${engineUrl}/deployments/${id}`);
  return reply.code(response.status).send(await response.json());
});
app.listen({ port: Number(process.env.PORT ?? 4000), host: '0.0.0.0' }).catch((error) => { app.log.error(error); process.exit(1); });
