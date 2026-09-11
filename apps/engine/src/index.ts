import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { DockerProvider } from '../../../packages/providers/src/index';
import type { DeploymentRecord, DeploymentRequest } from '../../../packages/contracts/src/deployment';

const app = Fastify({ logger: true });
const provider = new DockerProvider();
const deployments = new Map<string, DeploymentRecord>();

app.get('/health', async () => ({ ok: true, service: 'nexus-engine' }));

app.post<{ Body: DeploymentRequest }>('/deployments', async (request, reply) => {
  const id = randomUUID();
  const now = new Date().toISOString();
  const record: DeploymentRecord = { ...request.body, id, status: 'queued', createdAt: now, updatedAt: now };
  deployments.set(id, record);
  try {
    record.status = 'starting';
    record.updatedAt = new Date().toISOString();
    const result = await provider.deploy(record);
    Object.assign(record, result, { status: 'healthy', updatedAt: new Date().toISOString() });
    return reply.code(202).send(record);
  } catch (error) {
    record.status = 'failed';
    record.error = error instanceof Error ? error.message : String(error);
    record.updatedAt = new Date().toISOString();
    return reply.code(500).send(record);
  }
});

app.get<{ Params: { id: string } }>('/deployments/:id', async (request, reply) => {
  const deployment = deployments.get(request.params.id);
  return deployment ? reply.send(deployment) : reply.code(404).send({ error: 'Deployment not found' });
});

app.listen({ port: Number(process.env.PORT ?? 4100), host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
