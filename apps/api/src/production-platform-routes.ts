import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import pg from 'pg';
import { addDeploymentEvent, createRecoveryPoint, getApplicationGraph, getDeploymentState, listDeploymentEvents, listRecoveryPoints, listRecoverableDeployments, recordAutoscalingDecision, updateDeployment, updateDeploymentState, upsertGraphEdge, upsertGraphNode } from './db.js';

const { Pool } = pg;
const recoveryPool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://nexus:nexus_dev_only@127.0.0.1:5432/nexus', max: 4 });
const engineSecret = () => process.env.ENGINE_CALLBACK_SECRET ?? '';
function validEngineCallback(req: any) {
  const configured = engineSecret();
  if (!configured) return process.env.NODE_ENV !== 'production';
  return req.headers['x-engine-secret']?.toString() === configured;
}

async function claimRecoverableDeployments(nodeName: string) {
  const client = await recoveryPool.connect();
  try {
    await client.query('BEGIN');
    const nodeResult = await client.query(`SELECT name,endpoint,region,status,capacity_cpu_millis AS "capacityCpuMillis",used_cpu_millis AS "usedCpuMillis",capacity_memory_bytes AS "capacityMemoryBytes",used_memory_bytes AS "usedMemoryBytes" FROM runtime_nodes WHERE name=$1 AND status='online' AND endpoint IS NOT NULL AND (last_heartbeat_at IS NULL OR last_heartbeat_at > NOW() - INTERVAL '45 seconds') FOR UPDATE`, [nodeName]);
    const node = nodeResult.rows[0];
    if (!node) { await client.query('COMMIT'); return []; }
    const result = await client.query(`SELECT d.id,d.project_id AS "projectId",d.status,d.image,d.repo,s.phase,s.attempt,s.strategy,s.generation_id AS "generationId",s.desired_generation_id AS "desiredGenerationId",s.previous_generation_id AS "previousGenerationId",s.metadata FROM deployments d JOIN deployment_state s ON s.deployment_id=d.id WHERE (d.status IN ('queued','building','starting','rolling_back') OR s.phase IN ('QUEUED','CLONING','DETECTING','BUILDING','TESTING','SECURITY_SCAN','PROVISIONING','DEPLOYING','HEALTH_CHECK','TRAFFIC_SHIFT','DIAGNOSING','AUTO_RECOVERY','ROLLING_BACK')) AND (s.metadata->>'recoveryNodeName' IS NULL OR s.metadata->>'recoveryLeaseUntil' IS NULL OR (s.metadata->>'recoveryLeaseUntil')::timestamptz < NOW()) ORDER BY d.created_at ASC FOR UPDATE OF s SKIP LOCKED LIMIT 20`);
    const claimed:any[] = [];
    let freeCpu = Number(node.capacityCpuMillis) - Number(node.usedCpuMillis);
    let freeMemory = Number(node.capacityMemoryBytes) - Number(node.usedMemoryBytes);
    for (const deployment of result.rows) {
      const metadata = deployment.metadata && typeof deployment.metadata === 'object' ? deployment.metadata : {};
      const spec = (metadata as any).deploymentSpec;
      if (!spec) continue;
      const originalNode = String(spec.nodeName ?? 'local');
      const originalNodeResult = await client.query(`SELECT status,last_heartbeat_at AS "lastHeartbeatAt" FROM runtime_nodes WHERE name=$1 LIMIT 1`, [originalNode]);
      const original = originalNodeResult.rows[0];
      const originalHealthy = original && original.status === 'online' && (!original.lastHeartbeatAt || new Date(original.lastHeartbeatAt).getTime() > Date.now() - 45000);
      if (originalHealthy && originalNode !== nodeName) continue;
      if (originalNode === nodeName && originalHealthy) {
        // Same-node recovery is safe: the node is alive and can recreate a lost queue job.
      } else {
        const cpu = Math.max(1, Number(spec.cpuNanoCpus ?? 100_000_000) / 1_000_000);
        const memory = Math.max(1, Number(spec.memoryBytes ?? 128 * 1024 * 1024));
        if (freeCpu < cpu || freeMemory < memory) continue;
        freeCpu -= cpu; freeMemory -= memory;
      }
      const leaseUntil = new Date(Date.now() + 60_000).toISOString();
      const nextMetadata = { ...metadata, recoveryNodeName: nodeName, recoveryLeaseUntil: leaseUntil, recoveryOriginalNodeName: originalNode, recoveryClaimedAt: new Date().toISOString() };
      await client.query(`UPDATE deployment_state SET metadata=$2::jsonb,updated_at=NOW() WHERE deployment_id=$1`, [deployment.id, JSON.stringify(nextMetadata)]);
      claimed.push({ ...deployment, metadata: nextMetadata, recoveryNodeName: nodeName });
    }
    await client.query('COMMIT');
    return claimed;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

export async function registerProductionPlatformRoutes(app: FastifyInstance) {
  app.get('/api/v1/deployments/:id/events', async req => { const id = String((req.params as { id: string }).id); return { deploymentId: id, events: await listDeploymentEvents(id) }; });
  app.post('/api/v1/deployments/:id/events', async (req, reply) => { const id = String((req.params as { id: string }).id); const body = z.object({ phase: z.string().min(1).max(64), message: z.string().min(1).max(2000), metadata: z.record(z.string(), z.unknown()).optional() }).parse(req.body); await addDeploymentEvent(id, body.phase, body.message, body.metadata ?? {}); return reply.code(201).send({ ok: true }); });
  app.get('/api/v1/deployments/:id/state', async req => { const id = String((req.params as { id: string }).id); return { deploymentId: id, state: await getDeploymentState(id) }; });
  app.get('/api/v1/projects/:projectId/recovery-points', async req => { const projectId = String((req.params as { projectId: string }).projectId); return { projectId, recoveryPoints: await listRecoveryPoints(projectId) }; });
  app.post('/api/v1/projects/:projectId/recovery-points', async (req, reply) => { const projectId = String((req.params as { projectId: string }).projectId); const body = z.object({ deploymentId: z.string().uuid().optional(), serviceId: z.string().uuid().optional(), label: z.string().min(1).max(120), image: z.string().max(500).optional(), runtime: z.record(z.string(), z.unknown()).optional() }).parse(req.body); const point = await createRecoveryPoint({ projectId, ...body }); return reply.code(201).send(point); });
  app.get('/api/v1/projects/:projectId/graph', async req => { const projectId = String((req.params as { projectId: string }).projectId); return { projectId, ...(await getApplicationGraph(projectId)) }; });
  app.post('/api/v1/projects/:projectId/graph/nodes', async (req, reply) => { const projectId = String((req.params as { projectId: string }).projectId); const body = z.object({ serviceId: z.string().uuid().optional(), nodeKey: z.string().min(1).max(120), name: z.string().min(1).max(120), type: z.string().min(1).max(64), status: z.string().max(64).optional(), metadata: z.record(z.string(), z.unknown()).optional() }).parse(req.body); return reply.code(201).send(await upsertGraphNode({ projectId, ...body })); });
  app.post('/api/v1/projects/:projectId/graph/edges', async (req, reply) => { const projectId = String((req.params as { projectId: string }).projectId); const body = z.object({ sourceNodeId: z.string().uuid(), targetNodeId: z.string().uuid(), type: z.string().max(64).optional(), metadata: z.record(z.string(), z.unknown()).optional() }).parse(req.body); return reply.code(201).send(await upsertGraphEdge({ projectId, ...body })); });
  app.post('/api/v1/services/:serviceId/autoscaling/decisions', async (req, reply) => { const serviceId = String((req.params as { serviceId: string }).serviceId); const body = z.object({ currentReplicas: z.number().int().min(0), desiredReplicas: z.number().int().min(0), reason: z.string().min(1).max(500), metrics: z.record(z.string(), z.unknown()).optional() }).parse(req.body); await recordAutoscalingDecision({ serviceId, ...body }); return reply.code(201).send({ ok: true, serviceId, ...body }); });

  app.post('/api/internal/deployments/:id/status', async (req, reply) => { if (!validEngineCallback(req)) return reply.code(401).send({ error: 'Unauthorized engine callback' }); const id = String((req.params as { id: string }).id); const body = z.object({ status: z.enum(['queued', 'building', 'starting', 'ready', 'failed', 'rolling_back']), runtime: z.unknown().optional() }).parse(req.body); await updateDeployment(id, body.status, body.runtime); return { ok: true, deploymentId: id, status: body.status }; });
  app.post('/api/internal/deployments/:id/state', async (req, reply) => { if (!validEngineCallback(req)) return reply.code(401).send({ error: 'Unauthorized engine callback' }); const id = String((req.params as { id: string }).id); const body = z.object({ phase: z.string().min(1).max(64), attempt: z.number().int().min(0).optional(), strategy: z.enum(['rolling', 'blue_green', 'canary']).optional(), generationId: z.string().max(160).optional(), desiredGenerationId: z.string().max(160).optional(), previousGenerationId: z.string().max(160).optional(), error: z.string().max(4000).nullable().optional(), metadata: z.record(z.string(), z.unknown()).optional(), finished: z.boolean().optional() }).parse(req.body); await updateDeploymentState(id, body); return { ok: true, deploymentId: id, phase: body.phase }; });
  app.get('/api/internal/deployments/recoverable', async (req, reply) => { if (!validEngineCallback(req)) return reply.code(401).send({ error: 'Unauthorized engine callback' }); const nodeName = String((req.query as { nodeName?: string }).nodeName ?? '').trim(); if (!nodeName) return reply.code(400).send({ error: 'nodeName is required' }); return { deployments: await claimRecoverableDeployments(nodeName) }; });
}
