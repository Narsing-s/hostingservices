import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addDeploymentEvent, createRecoveryPoint, getApplicationGraph, getDeploymentState, listDeploymentEvents, listRecoveryPoints, listRecoverableDeployments, recordAutoscalingDecision, updateDeployment, updateDeploymentState, upsertGraphEdge, upsertGraphNode } from './db.js';

const engineSecret = () => process.env.ENGINE_CALLBACK_SECRET ?? '';
function validEngineCallback(req: any) {
  const configured = engineSecret();
  if (!configured) return process.env.NODE_ENV !== 'production';
  return req.headers['x-engine-secret']?.toString() === configured;
}

export async function registerProductionPlatformRoutes(app: FastifyInstance) {
  app.get('/api/v1/deployments/:id/events', async req => {
    const id = String((req.params as { id: string }).id);
    return { deploymentId: id, events: await listDeploymentEvents(id) };
  });

  app.post('/api/v1/deployments/:id/events', async (req, reply) => {
    const id = String((req.params as { id: string }).id);
    const body = z.object({ phase: z.string().min(1).max(64), message: z.string().min(1).max(2000), metadata: z.record(z.string(), z.unknown()).optional() }).parse(req.body);
    await addDeploymentEvent(id, body.phase, body.message, body.metadata ?? {});
    return reply.code(201).send({ ok: true });
  });

  app.get('/api/v1/deployments/:id/state', async req => {
    const id = String((req.params as { id: string }).id);
    return { deploymentId: id, state: await getDeploymentState(id) };
  });

  app.get('/api/v1/projects/:projectId/recovery-points', async req => {
    const projectId = String((req.params as { projectId: string }).projectId);
    return { projectId, recoveryPoints: await listRecoveryPoints(projectId) };
  });

  app.post('/api/v1/projects/:projectId/recovery-points', async (req, reply) => {
    const projectId = String((req.params as { projectId: string }).projectId);
    const body = z.object({ deploymentId: z.string().uuid().optional(), serviceId: z.string().uuid().optional(), label: z.string().min(1).max(120), image: z.string().max(500).optional(), runtime: z.record(z.string(), z.unknown()).optional() }).parse(req.body);
    const point = await createRecoveryPoint({ projectId, ...body });
    return reply.code(201).send(point);
  });

  app.get('/api/v1/projects/:projectId/graph', async req => {
    const projectId = String((req.params as { projectId: string }).projectId);
    return { projectId, ...(await getApplicationGraph(projectId)) };
  });

  app.post('/api/v1/projects/:projectId/graph/nodes', async (req, reply) => {
    const projectId = String((req.params as { projectId: string }).projectId);
    const body = z.object({ serviceId: z.string().uuid().optional(), nodeKey: z.string().min(1).max(120), name: z.string().min(1).max(120), type: z.string().min(1).max(64), status: z.string().max(64).optional(), metadata: z.record(z.string(), z.unknown()).optional() }).parse(req.body);
    return reply.code(201).send(await upsertGraphNode({ projectId, ...body }));
  });

  app.post('/api/v1/projects/:projectId/graph/edges', async (req, reply) => {
    const projectId = String((req.params as { projectId: string }).projectId);
    const body = z.object({ sourceNodeId: z.string().uuid(), targetNodeId: z.string().uuid(), type: z.string().max(64).optional(), metadata: z.record(z.string(), z.unknown()).optional() }).parse(req.body);
    return reply.code(201).send(await upsertGraphEdge({ projectId, ...body }));
  });

  app.post('/api/v1/services/:serviceId/autoscaling/decisions', async (req, reply) => {
    const serviceId = String((req.params as { serviceId: string }).serviceId);
    const body = z.object({ currentReplicas: z.number().int().min(0), desiredReplicas: z.number().int().min(0), reason: z.string().min(1).max(500), metrics: z.record(z.string(), z.unknown()).optional() }).parse(req.body);
    await recordAutoscalingDecision({ serviceId, ...body });
    return reply.code(201).send({ ok: true, serviceId, ...body });
  });

  // Engine-only lifecycle callback. It deliberately lives outside /api/v1 so the
  // user authentication hook cannot block trusted node callbacks.
  app.post('/api/internal/deployments/:id/status', async (req, reply) => {
    if (!validEngineCallback(req)) return reply.code(401).send({ error: 'Unauthorized engine callback' });
    const id = String((req.params as { id: string }).id);
    const body = z.object({ status: z.enum(['queued', 'building', 'starting', 'ready', 'failed', 'rolling_back']), runtime: z.unknown().optional() }).parse(req.body);
    await updateDeployment(id, body.status, body.runtime);
    return { ok: true, deploymentId: id, status: body.status };
  });

  app.post('/api/internal/deployments/:id/state', async (req, reply) => {
    if (!validEngineCallback(req)) return reply.code(401).send({ error: 'Unauthorized engine callback' });
    const id = String((req.params as { id: string }).id);
    const body = z.object({
      phase: z.string().min(1).max(64),
      attempt: z.number().int().min(0).optional(),
      strategy: z.enum(['rolling', 'blue_green', 'canary']).optional(),
      generationId: z.string().max(160).optional(),
      desiredGenerationId: z.string().max(160).optional(),
      previousGenerationId: z.string().max(160).optional(),
      error: z.string().max(4000).nullable().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      finished: z.boolean().optional(),
    }).parse(req.body);
    await updateDeploymentState(id, body);
    return { ok: true, deploymentId: id, phase: body.phase };
  });

  app.get('/api/internal/deployments/recoverable', async (req, reply) => {
    if (!validEngineCallback(req)) return reply.code(401).send({ error: 'Unauthorized engine callback' });
    return { deployments: await listRecoverableDeployments() };
  });
}
