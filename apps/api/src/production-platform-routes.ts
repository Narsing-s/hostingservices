import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addDeploymentEvent, createRecoveryPoint, getApplicationGraph, listDeploymentEvents, listRecoveryPoints, recordAutoscalingDecision, upsertGraphEdge, upsertGraphNode } from './db.js';

export async function registerProductionPlatformRoutes(app: FastifyInstance) {
  app.get('/api/v1/deployments/:id/events', async (req, reply) => {
    const id = String((req.params as { id: string }).id);
    return { deploymentId: id, events: await listDeploymentEvents(id) };
  });

  app.post('/api/v1/deployments/:id/events', async (req, reply) => {
    const id = String((req.params as { id: string }).id);
    const body = z.object({ phase: z.string().min(1).max(64), message: z.string().min(1).max(2000), metadata: z.record(z.string(), z.unknown()).optional() }).parse(req.body);
    await addDeploymentEvent(id, body.phase, body.message, body.metadata ?? {});
    return reply.code(201).send({ ok: true });
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
}
