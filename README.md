# Nexus Hosting

**Develop. Preview. Release. Recover. — a provider-neutral developer cloud.**

Nexus is a Docker-first application platform for shipping **web apps, APIs, workers, cron jobs, private services, containers, PostgreSQL and Redis** from one control plane.

It takes inspiration from proven platform capabilities such as previews, deployment checks, immutable releases, instant rollback and version-safe deployments, but Nexus is **not a Vercel clone**. Its core is an application graph, portable Docker runtime, multi-service releases, recovery points, cost-aware placement and provider-neutral infrastructure.

[![CI](https://github.com/Narsing-s/hostingservices/actions/workflows/ci.yml/badge.svg)](https://github.com/Narsing-s/hostingservices/actions/workflows/ci.yml)
[![Production Quality Gates](https://github.com/Narsing-s/hostingservices/actions/workflows/production-quality.yml/badge.svg)](https://github.com/Narsing-s/hostingservices/actions/workflows/production-quality.yml)
[![Local Compose Smoke](https://github.com/Narsing-s/hostingservices/actions/workflows/local-compose-smoke.yml/badge.svg)](https://github.com/Narsing-s/hostingservices/actions/workflows/local-compose-smoke.yml)

## Why Nexus

| Platform concern | Nexus approach |
|---|---|
| Deploy | Git repository or Docker image |
| Preview | Isolated preview environments and deployment graphs |
| Release | Rolling, blue/green and canary strategies |
| Safety | Health-gated traffic, rollback and release gates |
| Reliability | Recovery points, durable state and runtime-node failover |
| Version safety | Deployment generations and session-safe release pinning |
| Runtime | Docker-first web, worker, cron and private services |
| Infrastructure | PostgreSQL, Redis, persistent volumes and runtime nodes |
| Scaling | CPU, memory, request-rate and queue-aware autoscaling contracts |
| Observability | Logs, metrics, deployment activity and usage metering |
| Security | RBAC, scoped tokens, encrypted secrets and audit logs |
| Portability | Provider abstraction plus declarative `nexus.yaml` |

## The Nexus release model

```text
                    ┌───────────────┐
Git / Image ───────▶│ Build         │
                    └───────┬───────┘
                            ▼
                    ┌───────────────┐
                    │ Release Gates │
                    │ checks • scan  │
                    │ health • smoke │
                    └───────┬───────┘
                            ▼
                    ┌───────────────┐
                    │ Candidate     │
                    │ isolated      │
                    └───────┬───────┘
                            ▼
                 ┌─────────────────────┐
                 │ Adaptive Release     │
                 │ 1% → 5% → 25% →     │
                 │ 50% → 100%           │
                 └─────────┬────────────┘
                           ▼
                 ┌─────────────────────┐
                 │ Live + Version Safe │
                 └─────────┬───────────┘
                           │
             bad signals ─┴─▶ Pause / Rollback
```

A deployment is treated as an immutable generation. Nexus can keep a candidate isolated, evaluate release evidence, shift traffic gradually and recover without requiring a rebuild of the previous version.

See [`docs/ADVANCED_PLATFORM_FEATURES.md`](docs/ADVANCED_PLATFORM_FEATURES.md) for the complete advanced-platform roadmap.

## What Nexus can host

Nexus accepts either a Git repository or an existing Docker image.

| Workload | Support |
|---|---|
| Static frontend | Vite, Astro, Angular and Node build outputs |
| Next.js / Node.js | Automatic Docker build or custom Dockerfile |
| REST / GraphQL / backend APIs | Public web service |
| Python | Flask/FastAPI/Django-style deployments |
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

## Production capabilities

- Application graph for services, databases, caches and dependencies
- Git repository and Docker image deployments
- Persisted deployment lifecycle with validated state transitions
- Rolling, blue/green and canary deployment contracts
- Health-gated traffic switching and rollback
- Release gates for build, security, health, smoke and operational evidence
- Deployment Inspector data for release, runtime, traffic and rollback state
- Preview environments with environment isolation
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

## Advanced platform direction

### 1. Release Gates

Production traffic should never move merely because a container started. Nexus evaluates configurable gates such as build success, security checks, health, smoke tests, latency, error rate, required GitHub checks and optional human approval.

### 2. Version-safe releases

Nexus is designed to prevent an older browser session from accidentally talking to a newer incompatible application generation during a rollout. Deployment IDs can be carried through the request lifecycle and expire with deployment retention.

### 3. Adaptive canary

Nexus can begin with a small percentage of traffic and advance only when live evidence is healthy. Unlike a fixed rollout, the release controller can pause or roll back when error rate, latency, health failures, restarts or resource pressure cross configured thresholds.

### 4. Application-graph previews

A preview is more than a URL. A future Nexus preview can contain a matching web service, API, worker and database generation with deployment-scoped private service bindings.

### 5. Build intelligence

Nexus is designed to evolve toward immutable content-addressed build artifacts keyed by source tree, lockfile, runtime, build command and environment fingerprint. Clean builds should invalidate a build intentionally without destroying reusable cache entries.

### 6. Preview protection

Preview environments can be public, organization-only or protected by short-lived signed access. Authentication material stays server-side.

### 7. Provider-neutral runtime

Infrastructure providers remain implementation details behind common contracts for build, artifact storage, execution, routing, domains/TLS, databases, object storage, secrets and observability. This keeps Nexus portable instead of locking the product to one vendor.

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

## Architecture

```text
                          Nexus Console
                         Next.js / Web UI
                               │
                               ▼
                     ┌────────────────────┐
                     │     Nexus API      │
                     │ Fastify + Postgres │
                     └─────────┬──────────┘
                               │
                  deploy / inspect / release
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
       Release Controller                 Application Graph
       gates • rollout                    web • api • worker
       health • rollback                  cron • data • private
              │                                 │
              └────────────────┬────────────────┘
                               ▼
                       Nexus Runtime Engine
                       Docker + BullMQ
                               │
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
           Runtime nodes                Managed data
           containers                   PostgreSQL/Redis
                 │                           │
                 └─────────────┬─────────────┘
                               ▼
                            Traefik
                               │
                               ▼
                           Internet
```

## Declarative deployments

The Nexus CLI can validate and submit a repository deployment from `nexus.yaml`:

```bash
nexus validate nexus.yaml
nexus deploy nexus.yaml
```

See [`docs/NEXUS_YAML.md`](docs/NEXUS_YAML.md) for the manifest contract, monorepo service selection, environment variables and secret-handling rules.

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

## Production configuration

The web console must point at the public Nexus API. In a hosted deployment, set:

```text
NEXT_PUBLIC_NEXUS_API_URL=https://<your-public-api-domain>
```

Do not use `http://localhost:4000` in a production frontend. OAuth secrets remain server-side; users only select their GitHub or Google account and are redirected through the configured provider.

## Documentation

- [`docs/PRODUCTION_PLATFORM.md`](docs/PRODUCTION_PLATFORM.md) — production contract
- [`docs/ADVANCED_PLATFORM_FEATURES.md`](docs/ADVANCED_PLATFORM_FEATURES.md) — advanced release and platform roadmap
- [`docs/NEXUS_YAML.md`](docs/NEXUS_YAML.md) — declarative deployment model

## Design principle

**Learn from the platform industry; do not clone it.** Nexus adopts useful deployment and developer-experience patterns while keeping its own application graph, portable runtime, recovery model, release intelligence and provider-neutral architecture.
