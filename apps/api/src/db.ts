import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://nexus:nexus_dev_password@postgres:5432/nexus' });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (id uuid PRIMARY KEY, name text NOT NULL, repo text, created_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS deployments (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, status text NOT NULL, image text NOT NULL, repo text, runtime jsonb, created_at timestamptz NOT NULL);
    CREATE INDEX IF NOT EXISTS deployments_project_idx ON deployments(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS projects_repo_idx ON projects(repo);
  `);
}
export async function listProjects() { const { rows } = await pool.query('SELECT id, name, repo, created_at AS "createdAt" FROM projects ORDER BY created_at DESC'); return rows; }
export async function createProject(project: { id:string; name:string; repo?:string; createdAt:string }) { await pool.query('INSERT INTO projects (id,name,repo,created_at) VALUES ($1,$2,$3,$4)', [project.id,project.name,project.repo??null,project.createdAt]); return project; }
export async function findProjectByRepo(repo:string) { const { rows } = await pool.query('SELECT id,name,repo,created_at AS "createdAt" FROM projects WHERE repo=$1 LIMIT 1',[repo]); return rows[0] as {id:string;name:string;repo?:string;createdAt:string}|undefined; }
export async function projectExists(id:string) { const result = await pool.query('SELECT 1 FROM projects WHERE id=$1',[id]); return result.rowCount === 1; }
export async function listDeployments() { const { rows } = await pool.query('SELECT id, project_id AS "projectId", status, image, repo, runtime, created_at AS "createdAt" FROM deployments ORDER BY created_at DESC'); return rows; }
export async function createDeployment(deployment:{id:string;projectId:string;status:string;image:string;repo?:string;createdAt:string}) { await pool.query('INSERT INTO deployments (id,project_id,status,image,repo,created_at) VALUES ($1,$2,$3,$4,$5,$6)',[deployment.id,deployment.projectId,deployment.status,deployment.image,deployment.repo??null,deployment.createdAt]); }
export async function updateDeployment(id:string,status:string,runtime?:unknown) { await pool.query('UPDATE deployments SET status=$2,runtime=COALESCE($3::jsonb,runtime) WHERE id=$1',[id,status,runtime===undefined?null:JSON.stringify(runtime)]); }
