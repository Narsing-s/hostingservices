import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { requireUser } from './platform-routes.js';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://nexus:nexus_dev_only@127.0.0.1:5432/nexus' });

async function projectAccess(projectId: string, userId: string) {
  const result = await pool.query(
    `SELECT p.id,p.organization_id AS "organizationId"
     FROM projects p
     JOIN organization_members om ON om.organization_id=p.organization_id
     WHERE p.id=$1 AND om.user_id=$2 LIMIT 1`,
    [projectId, userId],
  );
  return result.rows[0];
}

export async function registerPlatformUiRoutes(app: FastifyInstance) {
  app.get('/api/v1/projects/:projectId/environments', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const projectId = String((req.params as { projectId: string }).projectId);
    if (!await projectAccess(projectId, user.id)) return reply.code(404).send({ error: 'Project not found' });
    const { rows } = await pool.query(
      `SELECT e.id,e.project_id AS "projectId",e.name,e.slug,e.created_at AS "createdAt"
       FROM environments e
       JOIN projects p ON p.id=e.project_id
       JOIN organization_members om ON om.organization_id=p.organization_id
       WHERE e.project_id=$1 AND om.user_id=$2
       ORDER BY e.created_at DESC`,
      [projectId, user.id],
    );
    return { environments: rows };
  });

  app.post('/api/v1/projects/:projectId/environments', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const projectId = String((req.params as { projectId: string }).projectId);
    const access = await projectAccess(projectId, user.id);
    if (!access) return reply.code(404).send({ error: 'Project not found' });
    const body = req.body as { name?: string; slug?: string };
    const name = String(body?.name ?? '').trim();
    const slug = String(body?.slug ?? name).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
    if (!name || !slug) return reply.code(400).send({ error: 'name is required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO environments(id,project_id,name,slug) VALUES(gen_random_uuid(),$1,$2,$3)
         RETURNING id,project_id AS "projectId",name,slug,created_at AS "createdAt"`,
        [projectId, name.slice(0, 100), slug],
      );
      return reply.code(201).send({ environment: rows[0] });
    } catch (error: any) {
      if (error?.code === '23505') return reply.code(409).send({ error: 'An environment with this slug already exists' });
      throw error;
    }
  });

  app.get('/api/v1/usage/summary', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const q = req.query as { organizationId?: string };
    const args: unknown[] = [user.id];
    const organizationClause = q.organizationId ? 'AND u.organization_id=$2' : '';
    if (q.organizationId) args.push(q.organizationId);
    const { rows } = await pool.query(
      `SELECT u.metric,u.unit,COALESCE(SUM(u.quantity),0)::double precision AS quantity
       FROM usage_events u
       JOIN organization_members om ON om.organization_id=u.organization_id
       WHERE om.user_id=$1 ${organizationClause}
       GROUP BY u.metric,u.unit ORDER BY u.metric`,
      args,
    );
    return { usage: rows };
  });
}
