# Nexus on Vercel Services

Nexus supports a Vercel Services deployment topology for the control plane. The repository keeps Docker Compose for local development and the provider-neutral runtime architecture, while Vercel can run the web console and Fastify API together as one deployment.

## Topology

```text
GitHub
  -> Vercel Project (Services)
       -> web service: apps/web
       -> api service: apps/api
       -> /api/nexus/* -> web gateway
       -> /api/*       -> API service
       -> everything else -> web service
```

The web service declares a service binding named `NEXUS_INTERNAL_URL`. The Next.js API gateway prefers this internal URL, so browser requests do not need a public API hostname and service-to-service traffic stays inside the Vercel deployment network.

Vercel documents Services as a way to deploy multiple frontends/backends in one project with shared routing and internal service bindings. See the official Services documentation for current availability and project setup.

## Required Vercel project setting

Set the Vercel project Framework/Preset to **Services**. The repository contains `vercel.json`, but the Vercel project setting must also enable Services before the `services` configuration is used.

## Required production environment variables

Configure these on the Vercel project as appropriate for the API/database/auth configuration:

```env
WEB_URL=https://<your-vercel-domain>
AUTH_SECRET=<strong-random-secret>
DATABASE_URL=<managed-postgresql-connection-string>
REDIS_URL=<redis-connection-string-if-required>
GITHUB_CLIENT_ID=<github-oauth-client-id>
GITHUB_CLIENT_SECRET=<github-oauth-client-secret>
GITHUB_CALLBACK_URL=https://<your-vercel-domain>/api/auth/github/callback
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
GOOGLE_CALLBACK_URL=https://<your-vercel-domain>/api/auth/google/callback
```

Do **not** set `NEXUS_INTERNAL_URL` manually. Vercel injects it from the service binding.

## What stays outside this Vercel Services deployment

Nexus is a hosting platform, not only a Vercel application. The deployment engine, agent, Docker runtime nodes, durable PostgreSQL/Redis infrastructure, object storage, and customer workloads may run on provider-neutral infrastructure. Vercel Services is an execution target for the Nexus control plane, not a requirement that every customer workload runs on Vercel.

Local development remains:

```bash
npm install
npm run infra:up
npm run dev:api
npm run dev
```

and Docker Compose remains the integration environment for Engine, Agent, Postgres, Redis and Traefik.
