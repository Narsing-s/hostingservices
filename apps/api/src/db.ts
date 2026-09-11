import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://nexus:nexus_dev_password@postgres:5432/nexus' });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (id uuid PRIMARY KEY, name text NOT NULL, repo text, created_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS deployments (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, status text NOT NULL, image text NOT NULL, repo text, runtime jsonb, created_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS domains (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, domain text NOT NULL UNIQUE, verification_token text NOT NULL, status text NOT NULL DEFAULT 'pending', verified_at timestamptz, created_at timestamptz NOT NULL);
    CREATE INDEX IF NOT EXISTS deployments_project_idx ON deployments(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS projects_repo_idx ON projects(repo);
    CREATE INDEX IF NOT EXISTS domains_project_idx ON domains(project_id);
  `);
}
export async function listProjects() { const { rows } = await pool.query('SELECT id, name, repo, created_at AS "createdAt" FROM projects ORDER BY created_at DESC'); return rows; }
export async function createProject(project: { id:string; name:string; repo?:string; createdAt:string }) { await pool.query('INSERT INTO projects (id,name,repo,created_at) VALUES ($1,$2,$3,$4)', [project.id,project.name,project.repo??null,project.createdAt]); return project; }
export async function findProjectByRepo(repo:string) { const { rows } = await pool.query('SELECT id,name,repo,created_at AS "createdAt" FROM projects WHERE repo=$1 LIMIT 1',[repo]); return rows[0] as {id:string;name:string;repo?:string;createdAt:string}|undefined; }
export async function projectExists(id:string) { const result = await pool.query('SELECT 1 FROM projects WHERE id=$1',[id]); return result.rowCount === 1; }
export async function listDeployments() { const { rows } = await pool.query('SELECT id, project_id AS "projectId", status, image, repo, runtime, created_at AS "createdAt" FROM deployments ORDER BY created_at DESC'); return rows; }
export async function createDeployment(deployment:{id:string;projectId:string;status:string;image:string;repo?:string;createdAt:string}) { await pool.query('INSERT INTO deployments (id,project_id,status,image,repo,created_at) VALUES ($1,$2,$3,$4,$5,$6)',[deployment.id,deployment.projectId,deployment.status,deployment.image,deployment.repo??null,deployment.createdAt]); }
export async function updateDeployment(id:string,status:string,runtime?:unknown) { await pool.query('UPDATE deployments SET status=$2,runtime=COALESCE($3::jsonb,runtime) WHERE id=$1',[id,status,runtime===undefined?null:JSON.stringify(runtime)]); }
export async function createDomain(domain:{id:string;projectId:string;domain:string;verificationToken:string;createdAt:string}) {
  await pool.query('INSERT INTO domains (id,project_id,domain,verification_token,created_at) VALUES ($1,$2,$3,$4,$5)', [domain.id,domain.projectId,domain.domain,domain.verificationToken,domain.createdAt]);
  return domain;
}
export async function getDomain(id:string) { const { rows } = await pool.query('SELECT id,project_id AS "projectId",domain,verification_token AS "verificationToken",status,verified_at AS "verifiedAt",created_at AS "createdAt" FROM domains WHERE id=$1',[id]); return rows[0]; }
export async function getVerifiedDomain(projectId:string, domain:string) { const { rows } = await pool.query('SELECT id,domain,status FROM domains WHERE project_id=$1 AND domain=$2 AND status=\'verified\' LIMIT 1',[projectId,domain]); return rows[0]; }
export async function markDomainVerified(id:string) { await pool.query('UPDATE domains SET status=\'verified\',verified_at=NOW() WHERE id=$1',[id]); }
export async function listDomains(projectId?:string) { const { rows } = await pool.query(projectId ? 'SELECT id,project_id AS "projectId",domain,status,verified_at AS "verifiedAt",created_at AS "createdAt" FROM domains WHERE project_id=$1 ORDER BY created_at DESC' : 'SELECT id,project_id AS "projectId",domain,status,verified_at AS "verifiedAt",created_at AS "createdAt" FROM domains ORDER BY created_at DESC',[...(projectId?[projectId]:[])]); return rows; }
