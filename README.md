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
- Declarative `nexus.yaml` validation and deployment through the CLI

## Declarative deployments

The Nexus CLI can validate and submit a repository deployment from `nexus.yaml`:

```bash
nexus validate nexus.yaml
nexus deploy nexus.yaml
```

See [`docs/NEXUS_YAML.md`](docs/NEXUS_YAML.md) for the manifest contract, monorepo service selection, environment variables and secret-handling rules.

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
                       ▼
                    Internet
```

## Local development

```bash
npm install --legacy-peer-deps --force
npm run dev:api
npm run dev:engine
npm run dev
```

For local infrastructure:

```bash
npm run infra:up
```

The CLI can be linked locally with:

```bash
npm run cli:link
```

Then use `nexus --help`.
