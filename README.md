# Nexus Hosting

**A developer cloud built around the application graph.**

Nexus is a Docker-first hosting control plane designed to combine the useful parts of Railway, Render and Neon while adding a first-class application graph, environment workflows, recovery points and infrastructure autopilot.

## What Nexus can host

Nexus accepts either a Git repository or an existing Docker image.

| Workload | Support |
|---|---|
| Static frontend | Vite, Astro, Angular and Node build outputs |
| Next.js / Node.js | Automatic Docker build or custom Dockerfile |
| REST / GraphQL / backend APIs | Public web service |
| Python | Flask/FastAPI/Django-style WSGI deployments |
| Go | `go.mod` projects |
| Java | Maven and Gradle projects |
| Rust | Cargo projects |
| .NET | `.csproj` projects |
| PHP | Composer projects |
| Ruby | Gemfile/Rails-style projects |
| Custom runtimes | Dockerfile or Docker image |
| Workers | Long-running private/background processes |
| Cron/jobs | Process workloads with job-oriented health mode |
| Private services | Internal service-to-service workloads |
| Databases | PostgreSQL/Redis infrastructure foundation and connection layer |

A repository-provided **Dockerfile always wins** over automatic detection. This means unusual frameworks, monorepos and custom operating-system dependencies can still be deployed.

## Runtime features

- Git clone + branch/ref builds
- Docker image deployment
- Automatic runtime detection
- Custom start commands
- Environment variables
- Web, worker, cron and private service modes
- HTTP, Docker and process health checks
- Ephemeral candidate ports for safe health probing
- Traefik routing and custom domains
- DNS ownership verification
- TLS/ACME configuration
- Durable Redis deployment queue
- Idempotent deployment requests
- Deployment lifecycle callbacks
- Runtime logs
- Rollback foundation
- GitHub push webhook foundation
- PostgreSQL control-plane persistence

## Architecture

```text
                         ┌────────────────────┐
                         │   Nexus Console    │
                         │      Next.js       │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │     Nexus API      │
                         │ Fastify + Postgres │
                         └─────────┬──────────┘
                                   │
                        build / deploy / status
                                   │
                                   ▼
                         ┌────────────────────┐
                         │   Nexus Engine     │
                         │ Docker + BullMQ    │
                         └──────┬─────┬───────┘
                                │     │
                       ┌────────┘     └────────┐
                       ▼                       ▼
                 Docker Runtime             Redis
                       │
                       ▼
                    Traefik
                       │
                 public services
```

## Local UI — quickest check

Requirements:

- Node.js 20+
- Docker Desktop running

From the repository root:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

This checks the **frontend/control-plane UI** without requiring the API.

## Full local platform

Start infrastructure first:

```bash
docker compose up -d
```

Then use four terminals from the repository root.

### Terminal 1 — API

```bash
npm run dev:api
```

API:

```text
http://localhost:4000
http://localhost:4000/health
http://localhost:4000/api/v1/capabilities
```

### Terminal 2 — Engine

```bash
npm run dev:engine
```

Engine:

```text
http://localhost:4100/health
```

### Terminal 3 — deployment worker

The engine workspace exposes the worker script:

```bash
npm run start:worker --workspace apps/engine
```

For watch-mode development, run:

```bash
npm run dev:worker --workspace apps/engine
```

### Terminal 4 — web console

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Set `NEXT_PUBLIC_NEXUS_API_URL=http://localhost:4000` if the UI is running against a different API origin.

## Test a real deployment

The safest first test is an existing Docker image:

1. Open `http://localhost:3000`.
2. Select **New deployment**.
3. Leave the Git repository empty.
4. Choose **Web / frontend / API**.
5. Use image mode through the API or extend the UI with the image field.
6. For a repository test, provide a public Git repository containing a Dockerfile.
7. Watch the deployment stream.
8. Check `/health` on the API and engine.
9. Check Docker Desktop for the Nexus runtime container.

For a repository deployment, Nexus builds the image on the engine host, places the deployment in the durable Redis queue, starts a candidate container, performs health validation, and only then switches public traffic.

## Useful API checks

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/v1/capabilities
curl http://localhost:4100/health
curl http://localhost:4100/api/v1/queue
```

## Important production boundary

Nexus is now a real deployment/runtime foundation, but a production multi-tenant cloud still needs authentication and workspace authorization, encrypted secrets, resource quotas, persistent volumes, managed database provisioning/backups, multi-node scheduling, provider adapters, billing/usage metering and stronger engine authentication. Those must be implemented as infrastructure capabilities rather than simulated UI features.

## Principles

1. **No fake deployment buttons:** every production action maps to an engine operation.
2. **Dockerfile first:** custom applications remain deployable even when automatic detection cannot understand them.
3. **No secrets in source control.**
4. **Health before traffic:** public deployments must pass their configured health signal before traffic is switched.
5. **Explicit data recovery:** database backup/restore operations must be observable and reversible.
6. **Provider portability:** the control plane should not depend on one infrastructure vendor.
7. **Understandable infrastructure:** the UI should show what Nexus is actually doing.
