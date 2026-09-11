import type { FastifyInstance } from 'fastify';
import { listDeployments, updateDeployment } from './db.js';
import { userFromToken } from './auth.js';

const ENGINE_URL = process.env.ENGINE_URL ?? 'http://localhost:4100';

function getCookie(req: any, name: string) {
  const raw = String(req.headers.cookie ?? '');
  for (const part of raw.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
}

function serviceOf(deployment: any) {
  return deployment.runtime?.service ?? deployment.runtime?.serviceName ?? null;
}

export async function registerDeploymentHistoryRoutes(app: FastifyInstance) {
  app.get('/api/v1/deployments/:id/versions', async (req, reply) => {
    const user = await userFromToken(getCookie(req, 'nexus_session'));
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const id = String((req.params as { id: string }).id);
    const deployments = await listDeployments() as any[];
    const current = deployments.find(item => item.id === id);
    if (!current) return reply.code(404).send({ error: 'Deployment not found' });

    const currentService = serviceOf(current);
    const versions = deployments
      .filter(item => item.projectId === current.projectId && item.status === 'ready')
      .filter(item => !current.repo || !item.repo || item.repo === current.repo)
      .filter(item => !currentService || !serviceOf(item) || serviceOf(item) === currentService)
      .map(item => ({
        id: item.id,
        status: item.status,
        image: item.image,
        repo: item.repo,
        createdAt: item.createdAt,
        service: serviceOf(item),
        runtime: item.runtime ?? null,
        current: item.id === current.id
      }));

    return reply.send({ deploymentId: id, versions });
  });

  app.post('/api/v1/deployments/:id/rollback-to', async (req, reply) => {
    const user = await userFromToken(getCookie(req, 'nexus_session'));
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const id = String((req.params as { id: string }).id);
    const body = (req.body ?? {}) as { targetDeploymentId?: string };
    const targetId = String(body.targetDeploymentId ?? '');
    if (!targetId) return reply.code(400).send({ error: 'targetDeploymentId is required' });
    if (targetId === id) return reply.code(400).send({ error: 'Target deployment must be a different version' });

    const deployments = await listDeployments() as any[];
    const current = deployments.find(item => item.id === id);
    const target = deployments.find(item => item.id === targetId);
    if (!current) return reply.code(404).send({ error: 'Deployment not found' });
    if (!target) return reply.code(404).send({ error: 'Target deployment not found' });
    if (current.status !== 'ready') return reply.code(409).send({ error: 'Only a healthy running deployment can be rolled back' });
    if (target.status !== 'ready') return reply.code(409).send({ error: 'Target deployment is not healthy' });
    if (target.projectId !== current.projectId) return reply.code(409).send({ error: 'Target deployment belongs to another project' });
    if (current.repo && target.repo && current.repo !== target.repo) return reply.code(409).send({ error: 'Target deployment belongs to another repository' });
    if (!target.image) return reply.code(409).send({ error: 'Target deployment has no deployable image' });

    const runtime = current.runtime ?? {};
    const name = runtime.name ?? `nexus-${id.slice(0, 8)}`;
    await updateDeployment(id, 'rolling_back', {
      ...runtime,
      rollbackFrom: target.id,
      previousImage: target.image,
      rollbackTarget: target.id
    });

    try {
      const response = await fetch(`${ENGINE_URL}/api/v1/runtime/rollback`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': `rollback:${id}:${target.id}`
        },
        body: JSON.stringify({
          deploymentId: id,
          name,
          previousImage: target.image,
          containerPort: runtime.containerPort,
          hostPort: runtime.hostPort,
          healthMode: runtime.healthMode,
          public: runtime.public,
          healthPath: runtime.healthPath,
          domain: runtime.domain,
          env: runtime.env
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(result));
      return reply.code(202).send({
        accepted: true,
        id,
        status: 'rolling_back',
        targetDeploymentId: target.id,
        targetImage: target.image,
        job: result
      });
    } catch (error) {
      await updateDeployment(id, 'failed', { ...runtime, rollbackError: String(error) });
      return reply.code(502).send({ error: 'Rollback could not be queued', detail: String(error) });
    }
  });
}
