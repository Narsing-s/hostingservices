import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { requireUser } from './platform-routes.js';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://nexus:nexus_dev_only@127.0.0.1:5432/nexus' });

export async function registerPlatformUiRoutes(app: FastifyInstance) {
  app.get('/api/v1/projects/:projectId/environments', async (req, reply) => {
    const user = await requireUser(req, reply); if (!user) return;
    const projectId = String((req.params as { projectId: string }).projectId);
    const { rows } = await pool.query(`SELECT e.id,e.project_id AS "projectId",e.name,e.slug FROM environments e JOIN projects p ON p.id=e.project_id JOIN organization_members om ON om.organization_id=p.organization_id WHERE e.project_id=$1 AND om.user_id=$2 ORDER BY e.created_at DESC`, [projectId, user.id]);
    return { environments: rows };
  });

  app.get('/api/v1/usage/summary', async (req, reply) => {
    const user = await requireUser(req, reply); if (!user) return;
    const q = req.query as { organizationId?: string };
    const args: unknown[] = [user.id];
    const organizationClause = q.organizationId ? 'AND u.organization_id=$2' : '';
    if (q.organizationId) args.push(q.organizationId);
    const { rows } = await pool.query(`SELECT u.metric,u.unit,COALESCE(SUM(u.quantity),0)::double precision AS quantity FROM usage_events u JOIN organization_members om ON om.organization_id=u.organization_id WHERE om.user_id=$1 ${organizationClause} GROUP BY u.metric,u.unit ORDER BY u.metric`, args);
    return { usage: rows };
  });

  app.get('/api/v1/providers/catalog', async (_req, reply) => {
    return reply.send({ providers: [
      { id: 'docker', name: 'Docker Runtime', category: 'compute', status: 'available', capabilities: ['web','worker','cron','private'] },
      { id: 'postgres', name: 'PostgreSQL', category: 'database', status: 'available', capabilities: ['managed','persistent'] },
      { id: 'redis', name: 'Redis', category: 'database', status: 'available', capabilities: ['managed','persistent'] },
      { id: 'render', name: 'Render', category: 'external', status: 'adapter-ready', capabilities: ['web','worker','cron','private'] },
      { id: 'railway', name: 'Railway', category: 'external', status: 'adapter-ready', capabilities: ['web','worker','cron','private','database'] },
      { id: 'vercel', name: 'Vercel', category: 'external', status: 'adapter-ready', capabilities: ['web','preview'] }
    ]});
  });
}
