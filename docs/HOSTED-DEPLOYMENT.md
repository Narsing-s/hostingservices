# Hosted Deployment

This guide prevents the most common hosted-console failure: a browser deployment accidentally calling `localhost` instead of the public Nexus API.

## Architecture

```text
Browser
  │
  ▼
Nexus Web / Console
  │ NEXT_PUBLIC_NEXUS_API_URL
  ▼
Public Nexus API
  │
  ├── PostgreSQL
  ├── Redis
  └── Runtime Engine / Agent
```

The browser must never need direct access to Postgres, Redis, the engine, or the agent.

## Vercel frontend

Set the Vercel project environment variable for the **Production** environment:

```text
NEXT_PUBLIC_NEXUS_API_URL=https://<actual-public-nexus-api-domain>
```

Also configure it for Preview if preview deployments are expected to call a public preview API.

After changing an environment variable, create a new deployment. Next.js exposes `NEXT_PUBLIC_*` variables to browser code at build time, so changing the variable without rebuilding does not update an already-built client bundle.

Do not use:

```text
NEXT_PUBLIC_NEXUS_API_URL=http://localhost:4000
```

in a hosted browser deployment.

## API configuration

The API should use real production values:

```text
NODE_ENV=production
WEB_URL=https://<actual-console-domain>
PUBLIC_API_URL=https://<actual-public-nexus-api-domain>
AUTH_SECRET=<long-random-secret>
DATABASE_URL=<private-postgres-url>
REDIS_URL=<private-redis-url>
```

OAuth provider callbacks must point to the public API:

```text
https://<actual-public-nexus-api-domain>/api/auth/github/callback
https://<actual-public-nexus-api-domain>/api/auth/google/callback
```

OAuth client secrets stay in the API environment only.

## Render / Railway / Docker

The same separation applies to any hosting provider:

- Web is public.
- API is public only through its intended HTTPS endpoint.
- Postgres and Redis remain private.
- Engine and agent remain private control-plane/runtime services.
- Runtime workloads are exposed only through the Nexus routing layer.

## Production verification

After deployment, verify:

```bash
curl -fsS https://<actual-public-nexus-api-domain>/health
curl -fsS https://<actual-public-nexus-api-domain>/api/auth/providers
```

Then open the console and confirm the browser network requests target the public API domain rather than `localhost`.

## Release rule

A hosted console is not production-ready until login, project loading, repository detection, deployment creation, deployment status polling, logs, rollback, and domain/runtime operations have all been tested against the deployed API.
