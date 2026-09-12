# Nexus API on Render

This blueprint deploys the Nexus Fastify control-plane API with managed PostgreSQL and Redis.

## 1. Create the Render stack

Create a new Render Blueprint from this repository and select `render.yaml`.

The API service is `nexus-api`. Render provides its public HTTPS hostname after creation.

## 2. Required production environment values

Set these values on `nexus-api`:

```text
WEB_URL=https://<your-console-domain>
PUBLIC_API_URL=https://<your-nexus-api-domain>
AUTH_SECRET=<long-random-secret>
```

For GitHub OAuth, configure:

```text
GITHUB_CLIENT_ID=<client-id>
GITHUB_CLIENT_SECRET=<client-secret>
GITHUB_CALLBACK_URL=https://<your-nexus-api-domain>/api/auth/github/callback
```

For Google OAuth, configure:

```text
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>
GOOGLE_CALLBACK_URL=https://<your-nexus-api-domain>/api/auth/google/callback
```

Do not commit these secrets.

## 3. Verify the API

Open:

```text
https://<your-nexus-api-domain>/health
https://<your-nexus-api-domain>/api/auth/providers
```

The health endpoint must return `ok: true`.

## 4. Connect the web console

Set the Vercel production environment variable:

```text
NEXUS_API_URL=https://<your-nexus-api-domain>
```

Redeploy the web console after changing it.

The Next.js `/api/nexus/*` gateway then forwards authentication requests server-side. The browser never needs to call the API origin directly.

## Runtime engine

The Render blueprint intentionally does not pretend that the Docker runtime engine is production-ready on a normal Render web service. Nexus deployments require a runtime node with Docker Engine access. Keep the engine on a supported Docker host/node and configure `ENGINE_URL` on `nexus-api` when that runtime node is available.
