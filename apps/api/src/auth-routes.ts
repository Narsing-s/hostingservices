import type { FastifyInstance } from 'fastify';
import { randomBytes, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { createUser, getOAuthAccessToken, listDeployments, updateDeployment } from './db.js';
import { decryptToken, endSession, encryptToken, findEmailUser, hashPassword, startSession, upsertOAuthAccount, userFromToken, verifyPassword } from './auth.js';

const isProduction = process.env.NODE_ENV === 'production';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
const API_URL = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
const AUTH_SECRET = process.env.AUTH_SECRET;
const ENGINE_URL = process.env.ENGINE_URL ?? 'http://localhost:4100';
const COOKIE = 'nexus_session';

if (isProduction && (!AUTH_SECRET || AUTH_SECRET.length < 32)) {
  throw new Error('AUTH_SECRET must be configured with at least 32 characters in production.');
}

const effectiveAuthSecret = AUTH_SECRET ?? 'nexus-dev-auth-secret-change-me';

function requireProductionUrl(name: string, value: string) {
  if (!isProduction) return;
  if (!value.startsWith('https://')) throw new Error(`${name} must use HTTPS in production.`);
}

requireProductionUrl('WEB_URL', WEB_URL);
requireProductionUrl('PUBLIC_API_URL', API_URL);

const cookie = (token: string, maxAge: number) => `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`;
const clearCookie = `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`;
function getCookie(req: any, name: string) { const raw = String(req.headers.cookie ?? ''); for (const part of raw.split(';')) { const [k, ...v] = part.trim().split('='); if (k === name) return decodeURIComponent(v.join('=')); } }
function signedState(provider: string) { const value = `${provider}:${randomBytes(24).toString('hex')}`; const sig = createHmac('sha256', effectiveAuthSecret).update(value).digest('hex'); return `${value}.${sig}`; }
function validState(state: string | undefined, provider: string) { if (!state) return false; const [value, sig] = state.split('.'); if (!value || !sig || !value.startsWith(`${provider}:`)) return false; const expected = createHmac('sha256', effectiveAuthSecret).update(value).digest('hex'); return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); }
async function setLogin(reply: any, userId: string) { const session = await startSession(userId); reply.header('set-cookie', cookie(session.token, 30 * 86400)); }

function oauthConfig(provider: 'github' | 'google') {
  const prefix = provider === 'github' ? 'GITHUB' : 'GOOGLE';
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  const callback = process.env[`${prefix}_CALLBACK_URL`] ?? `${API_URL}/api/auth/${provider}/callback`;
  if (!clientId || !clientSecret) return null;
  if (isProduction && !callback.startsWith('https://')) throw new Error(`${prefix}_CALLBACK_URL must use HTTPS in production.`);
  return { clientId, clientSecret, callback };
}

function oauthUnavailable(reply: any, provider: 'github' | 'google') {
  // Keep provider configuration details out of the public response. The platform
  // operator configures OAuth once; end users should never be asked for credentials.
  const error = `${provider}_oauth_unavailable`;
  return reply.redirect(`${WEB_URL}/login?error=${error}`);
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get('/api/auth/me', async req => ({ user: await userFromToken(getCookie(req, 'nexus_session')) ?? null }));
  app.post('/api/auth/register', async (req, reply) => { const body = req.body as { email?: string; password?: string; name?: string }; const email = body.email?.trim().toLowerCase(); const password = body.password ?? ''; const name = body.name?.trim() || email?.split('@')[0] || ''; if (!email || password.length < 8 || !name) return reply.code(400).send({ error: 'name, email and a password of at least 8 characters are required' }); if (await findEmailUser(email)) return reply.code(409).send({ error: 'An account with this email already exists' }); const user = await createUser({ id: randomUUID(), email, name, passwordHash: hashPassword(password) }); await setLogin(reply, user.id); return reply.code(201).send({ user }); });
  app.post('/api/auth/login', async (req, reply) => { const body = req.body as { email?: string; password?: string }; const user = body.email ? await findEmailUser(body.email.trim().toLowerCase()) : undefined; if (!user?.passwordHash || !verifyPassword(body.password ?? '', user.passwordHash)) return reply.code(401).send({ error: 'Invalid email or password' }); await setLogin(reply, user.id); return reply.send({ user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt } }); });
  app.post('/api/auth/logout', async (req, reply) => { await endSession(getCookie(req, 'nexus_session')); reply.header('set-cookie', clearCookie); return { ok: true }; });

  app.get('/api/auth/github/start', async (_req, reply) => {
    const config = oauthConfig('github');
    if (!config) return oauthUnavailable(reply, 'github');
    const state = signedState('github');
    reply.header('set-cookie', `nexus_oauth_state=${encodeURIComponent(state)}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`);
    return reply.redirect(`https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodeURIComponent(config.callback)}&scope=${encodeURIComponent('read:user user:email repo')}&state=${encodeURIComponent(state)}`);
  });

  app.get('/api/auth/github/callback', async (req, reply) => {
    const config = oauthConfig('github');
    if (!config) return reply.redirect(`${WEB_URL}/login?error=github_oauth_unavailable`);
    const q = req.query as { code?: string; state?: string }; const saved = getCookie(req, 'nexus_oauth_state');
    if (!validState(q.state, 'github') || q.state !== saved) return reply.redirect(`${WEB_URL}/login?error=invalid_oauth_state`);
    if (!q.code) return reply.redirect(`${WEB_URL}/login?error=github_cancelled`);
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code: q.code, redirect_uri: config.callback }) });
    const token = await tokenResponse.json() as any;
    if (!token.access_token) return reply.redirect(`${WEB_URL}/login?error=github_token_exchange_failed`);
    const userResponse = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    const gh = await userResponse.json() as any;
    if (!userResponse.ok || !gh.id) return reply.redirect(`${WEB_URL}/login?error=github_user_lookup_failed`);
    const emailsResponse = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    const emails = await emailsResponse.json() as any[];
    const email = emails.find(e => e.primary && e.verified)?.email ?? emails.find(e => e.verified)?.email ?? gh.email;
    if (!email) return reply.redirect(`${WEB_URL}/login?error=github_email_unavailable`);
    const user = await upsertOAuthAccount({ provider: 'github', providerAccountId: String(gh.id), email, name: gh.name || gh.login, avatarUrl: gh.avatar_url, accessToken: encryptToken(token.access_token) });
    await setLogin(reply, user.id); return reply.redirect(`${WEB_URL}/?auth=success`);
  });

  app.get('/api/auth/google/start', async (_req, reply) => {
    const config = oauthConfig('google');
    if (!config) return oauthUnavailable(reply, 'google');
    const state = signedState('google'); reply.header('set-cookie', `nexus_oauth_state=${encodeURIComponent(state)}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`);
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodeURIComponent(config.callback)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&access_type=offline&prompt=select_account&state=${encodeURIComponent(state)}`);
  });

  app.get('/api/auth/google/callback', async (req, reply) => {
    const config = oauthConfig('google'); if (!config) return reply.redirect(`${WEB_URL}/login?error=google_oauth_unavailable`);
    const q = req.query as { code?: string; state?: string }; const saved = getCookie(req, 'nexus_oauth_state');
    if (!validState(q.state, 'google') || q.state !== saved) return reply.redirect(`${WEB_URL}/login?error=invalid_oauth_state`);
    if (!q.code) return reply.redirect(`${WEB_URL}/login?error=google_cancelled`);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: q.code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.callback, grant_type: 'authorization_code' }) });
    const token = await tokenResponse.json() as any; if (!token.access_token) return reply.redirect(`${WEB_URL}/login?error=google_token_exchange_failed`);
    const infoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } }); const info = await infoResponse.json() as any;
    if (!infoResponse.ok || !info.sub || !info.email) return reply.redirect(`${WEB_URL}/login?error=google_user_lookup_failed`);
    const user = await upsertOAuthAccount({ provider: 'google', providerAccountId: String(info.sub), email: info.email, name: info.name || info.email, avatarUrl: info.picture, accessToken: encryptToken(token.access_token) }); await setLogin(reply, user.id); return reply.redirect(`${WEB_URL}/?auth=success`);
  });

  app.get('/api/auth/github/repos', async (req, reply) => {
    const user = await userFromToken(getCookie(req, 'nexus_session')); if (!user) return reply.code(401).send({ error: 'Authentication required' });
    const storedToken = await getOAuthAccessToken(user.id, 'github'); if (!storedToken) return reply.code(409).send({ error: 'Connect GitHub to browse repositories' });
    let token: string; try { token = decryptToken(storedToken); } catch { return reply.code(409).send({ error: 'GitHub connection needs to be reconnected' }); }
    const q = req.query as { page?: string; per_page?: string; search?: string }; const page = Math.max(1, Number(q.page ?? 1)); const perPage = Math.min(100, Math.max(1, Number(q.per_page ?? 50)));
    const url = new URL('https://api.github.com/user/repos'); url.searchParams.set('page', String(page)); url.searchParams.set('per_page', String(perPage)); url.searchParams.set('sort', 'updated'); url.searchParams.set('affiliation', 'owner,collaborator,organization_member');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }); const repos = await response.json() as any[];
    if (!response.ok) return reply.code(response.status).send({ error: 'GitHub repository request failed', detail: repos });
    const filtered = q.search ? repos.filter(r => String(r.full_name).toLowerCase().includes(q.search!.toLowerCase())) : repos;
    return { repositories: filtered.map(r => ({ id: r.id, fullName: r.full_name, name: r.name, private: r.private, defaultBranch: r.default_branch, cloneUrl: r.clone_url, htmlUrl: r.html_url, owner: r.owner?.login })) };
  });

  app.post('/api/v1/deployments/:id/rollback', async (req, reply) => { const user = await userFromToken(getCookie(req, 'nexus_session')); if (!user) return reply.code(401).send({ error: 'Authentication required' }); const id = String((req.params as { id: string }).id); const deployments = await listDeployments() as any[]; const current = deployments.find(d => d.id === id); if (!current) return reply.code(404).send({ error: 'Deployment not found' }); if (current.status !== 'ready') return reply.code(409).send({ error: 'Only a healthy running deployment can be rolled back' }); const previous = deployments.find(d => d.projectId === current.projectId && d.status === 'ready' && d.id !== current.id && d.image !== current.image); if (!previous) return reply.code(409).send({ error: 'No previous healthy deployment is available for rollback' }); const runtime = current.runtime ?? {}; const name = runtime.name ?? `nexus-${id.slice(0, 8)}`; await updateDeployment(id, 'rolling_back', { ...runtime, rollbackFrom: previous.id, previousImage: previous.image }); try { const response = await fetch(`${ENGINE_URL}/api/v1/runtime/rollback`, { method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': `rollback:${id}` }, body: JSON.stringify({ deploymentId: id, name, previousImage: previous.image, containerPort: runtime.containerPort, hostPort: runtime.hostPort, healthMode: runtime.healthMode, public: runtime.public, healthPath: runtime.healthPath, domain: runtime.domain, env: runtime.env }) }); const result = await response.json(); if (!response.ok) throw new Error(JSON.stringify(result)); return reply.code(202).send({ accepted: true, id, status: 'rolling_back', previousDeploymentId: previous.id, previousImage: previous.image, job: result }); } catch (error) { await updateDeployment(id, 'failed', { ...runtime, rollbackError: String(error) }); return reply.code(502).send({ error: 'Rollback could not be queued', detail: String(error) }); } });
}
