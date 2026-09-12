# Nexus Hosting

**A developer cloud built around the application graph.**

Nexus is a Docker-first hosting control plane designed to combine the useful parts of Railway, Render and Neon while adding an application graph, environment workflows, recovery points, cost intelligence and infrastructure autopilot.

> **Production contract:** [`docs/PRODUCTION_PLATFORM.md`](docs/PRODUCTION_PLATFORM.md) is the source of truth for production reliability, security, observability, provider abstraction and feature completeness.

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
| Managed data | Docker-backed PostgreSQL and Redis with persistent named volumes and generated credentials |

A repository-provided **Dockerfile always wins** over automatic detection. This supports unusual frameworks, monorepos and custom operating-system dependencies.

## Production platform capabilities

- Application graph for services, databases, caches and dependencies
- Git repository and Docker image deployments
- Full persisted deployment lifecycle and validated state transitions
- Rolling, blue/green and canary deployment contracts
- Health-gated traffic switching and rollback
- CPU, memory, request-rate and queue-depth autoscaling contracts
- Preview environments and environment isolation
- PostgreSQL and Redis managed-data foundations
- Recovery points and restore contracts
- Persistent volumes and backup/restore architecture
- Encrypted secrets, RBAC, scoped API tokens and audit events
- Structured logs, metrics and OpenTelemetry-compatible observability contracts
- Server-side usage metering and cost estimation
- Provider abstraction for Docker now and Kubernetes/cloud providers later
- Nexus Autopilot contracts for evidence-based incident diagnosis/remediation
- CLI and declarative `nexus.yaml` deployment model
- Production quality gates for contracts, Docker configuration and security scanning

The shared platform contracts live in `packages/platform-contracts` and are used to keep the API, engine, agent, providers and console aligned.

## Runtime features

- Git clone + branch/ref builds
- Docker image deployment
- Automatic runtime detection
- Custom start commands
- Environment variables and encrypted secrets
- Web, worker, cron and private service modes
- PostgreSQL and Redis provisioning
- HTTP, Docker and process health checks
- Ephemeral candidate ports for safe health probing
- CPU, memory, PID and volume resource limits
- Traefik routing and custom domains
- DNS ownership verification
- TLS/ACME configuration
- Durable Redis deployment queue
- Idempotent deployment requests
- Deployment lifecycle callbacks
- Runtime logs
- Runtime node registry and capacity reporting
- API tokens with scopes, expiry and revocation
- Organization/RBAC model
- Audit logs and usage metering
- Infrastructure control center at `/platform`
- Declarative `nexus.yaml` validation and deployment through the CLI

## Infrastructure control center

Open `/platform` in the console to see registered runtime nodes, CPU/memory capacity and managed PostgreSQL/Redis services. The page calls the live control-plane APIs rather than using mock data.

Managed data instances are created on the engine's Docker host, attached to the Nexus runtime network, protected with generated credentials, restarted automatically and backed by named Docker volumes. For a public production service, place the engine behind a private network and use an appropriate managed volume/storage provider rather than exposing the Docker host directly.

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
                     schedule / build / deploy
                                   │
                                   ▼
                         ┌────────────────────┐
                         │   Nexus Engine     │
                         │ Docker + BullMQ    │
                         └──────┬─────┬───────┘
                                │     │
                    ┌───────────┘     └───────────┐
                    ▼                             ▼
             App containers                 Managed data
                    │                       PostgreSQL/Redis
                    └─────────────┬───────────────┘
                                  ▼
                              Traefik
                                  │
                                  ▼
                               Internet
```

## Local development

```bash
npm install
npm run infra:up
npm run dev:api
npm run dev:engine
npm run dev
```

If port `4000` is already occupied, stop the previous Nexus API process before starting another copy.

The CLI can be linked locally with:

```bash
npm run cli:link
```

Then use `nexus --help`.
