import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://nexus:nexus_dev_only@127.0.0.1:5432/nexus' });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, email text UNIQUE, name text NOT NULL, avatar_url text, password_hash text, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text UNIQUE NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_accounts (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider text NOT NULL, provider_account_id text NOT NULL, access_token text, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, UNIQUE(provider, provider_account_id));
    CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);
    CREATE TABLE IF NOT EXISTS projects (id uuid PRIMARY KEY, name text NOT NULL, repo text, created_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS deployments (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, status text NOT NULL, image text NOT NULL, repo text, runtime jsonb, created_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS domains (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, domain text NOT NULL UNIQUE, verification_token text NOT NULL, status text NOT NULL DEFAULT 'pending', verified_at timestamptz, created_at timestamptz NOT NULL);
    CREATE INDEX IF NOT EXISTS deployments_project_idx ON deployments(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS projects_repo_idx ON projects(repo);
    CREATE INDEX IF NOT EXISTS domains_project_idx ON domains(project_id);
  `);
}
export async function createUser(user:{id:string;email?:string|null;name:string;avatarUrl?:string|null;passwordHash?:string|null}) { const now=new Date().toISOString(); await pool.query('INSERT INTO users (id,email,name,avatar_url,password_hash,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)',[user.id,user.email??null,user.name,user.avatarUrl??null,user.passwordHash??null,now]); return getUserById(user.id); }
export async function getUserById(id:string) { const {rows}=await pool.query('SELECT id,email,name,avatar_url AS "avatarUrl",created_at AS "createdAt" FROM users WHERE id=$1',[id]); return rows[0]; }
export async function getUserByEmail(email:string) { const {rows}=await pool.query('SELECT id,email,name,avatar_url AS "avatarUrl",password_hash AS "passwordHash",created_at AS "createdAt" FROM users WHERE lower(email)=lower($1) LIMIT 1',[email]); return rows[0]; }
export async function upsertOAuthAccount(input:{provider:string;providerAccountId:string;email?:string|null;name:string;avatarUrl?:string|null;accessToken?:string|null}) {
  const existing = await pool.query('SELECT user_id AS "userId" FROM oauth_accounts WHERE provider=$1 AND provider_account_id=$2',[input.provider,input.providerAccountId]);
  let userId:string;
  if (existing.rows[0]) userId=existing.rows[0].userId;
  else {
    const byEmail=input.email?await getUserByEmail(input.email):undefined;
    if (byEmail) userId=byEmail.id;
    else userId=randomUuid();
    if (!byEmail) await createUser({id:userId,email:input.email,name:input.name,avatarUrl:input.avatarUrl});
    const now=new Date().toISOString();
    await pool.query('INSERT INTO oauth_accounts (id,user_id,provider,provider_account_id,access_token,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)',[randomUuid(),userId,input.provider,input.providerAccountId,input.accessToken??null,now]);
    return getUserById(userId);
  }
  await pool.query('UPDATE oauth_accounts SET access_token=$3,updated_at=NOW() WHERE provider=$1 AND provider_account_id=$2',[input.provider,input.providerAccountId,input.accessToken??null]);
  await pool.query('UPDATE users SET name=$2,avatar_url=$3,updated_at=NOW() WHERE id=$1',[userId,input.name,input.avatarUrl??null]);
  return getUserById(userId);
}
function randomUuid(){return crypto.randomUUID();}
export async function createSession(userId:string,tokenHash:string,expiresAt:string){const id=randomUuid();await pool.query('INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES ($1,$2,$3,$4,NOW())',[id,userId,tokenHash,expiresAt]);return id;}
export async function getUserBySession(tokenHash:string){const {rows}=await pool.query('SELECT u.id,u.email,u.name,u.avatar_url AS "avatarUrl",u.created_at AS "createdAt" FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW() LIMIT 1',[tokenHash]);return rows[0];}
export async function deleteSession(tokenHash:string){await pool.query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash]);}

export async function listProjects() { const { rows } = await pool.query('SELECT id, name, repo, created_at AS "createdAt" FROM projects ORDER BY created_at DESC'); return rows; }
export async function createProject(project: { id:string; name:string; repo?:string; createdAt:string }) { await pool.query('INSERT INTO projects (id,name,repo,created_at) VALUES ($1,$2,$3,$4)', [project.id,project.name,project.repo??null,project.createdAt]); return project; }
export async function findProjectByRepo(repo:string) { const { rows } = await pool.query('SELECT id,name,repo,created_at AS "createdAt" FROM projects WHERE repo=$1 LIMIT 1',[repo]); return rows[0] as {id:string;name:string;repo?:string;createdAt:string}|undefined; }
export async function projectExists(id:string) { const result = await pool.query('SELECT 1 FROM projects WHERE id=$1',[id]); return result.rowCount === 1; }
export async function listDeployments() { const { rows } = await pool.query('SELECT id, project_id AS "projectId", status, image, repo, runtime, created_at AS "createdAt" FROM deployments ORDER BY created_at DESC'); return rows; }
export async function createDeployment(deployment:{id:string;projectId:string;status:string;image:string;repo?:string;createdAt:string}) { await pool.query('INSERT INTO deployments (id,project_id,status,image,repo,created_at) VALUES ($1,$2,$3,$4,$5,$6)',[deployment.id,deployment.projectId,deployment.status,deployment.image,deployment.repo??null,deployment.createdAt]); }
export async function updateDeployment(id:string,status:string,runtime?:unknown) { await pool.query('UPDATE deployments SET status=$2,runtime=COALESCE($3::jsonb,runtime) WHERE id=$1',[id,status,runtime===undefined?null:JSON.stringify(runtime)]); }
export async function createDomain(domain:{id:string;projectId:string;domain:string;verificationToken:string;createdAt:string}) { await pool.query('INSERT INTO domains (id,project_id,domain,verification_token,created_at) VALUES ($1,$2,$3,$4,$5)', [domain.id,domain.projectId,domain.domain,domain.verificationToken,domain.createdAt]); return domain; }
export async function getDomain(id:string) { const { rows } = await pool.query('SELECT id,project_id AS "projectId",domain,verification_token AS "verificationToken",status,verified_at AS "verifiedAt",created_at AS "createdAt" FROM domains WHERE id=$1',[id]); return rows[0]; }
export async function getVerifiedDomain(projectId:string, domain:string) { const { rows } = await pool.query('SELECT id,domain,status FROM domains WHERE project_id=$1 AND domain=$2 AND status=\'verified\' LIMIT 1',[projectId,domain]); return rows[0]; }
export async function markDomainVerified(id:string) { await pool.query('UPDATE domains SET status=\'verified\',verified_at=NOW() WHERE id=$1',[id]); }
export async function listDomains(projectId?:string) { const { rows } = await pool.query(projectId ? 'SELECT id,project_id AS "projectId",domain,status,verified_at AS "verifiedAt",created_at AS "createdAt" FROM domains WHERE project_id=$1 ORDER BY created_at DESC' : 'SELECT id,project_id AS "projectId",domain,status,verified_at AS "verifiedAt",created_at AS "createdAt" FROM domains ORDER BY created_at DESC',[...(projectId?[projectId]:[])]); return rows; }
