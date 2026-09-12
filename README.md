# Nexus Hosting

**A real developer cloud for deploying, running, scaling and recovering production services.**

Nexus is a Docker-first hosting platform for **web apps, APIs, workers, cron jobs, private services, custom containers, PostgreSQL and Redis**. The product is designed around the same core expectations developers have from modern platforms such as Render, Railway and similar developer clouds: connect a repository, configure a service, deploy, get a public URL, inspect logs, scale, attach a domain, and roll back safely.

Nexus is provider-neutral and keeps its own application graph, release controller, runtime engine and recovery model.

[![CI](https://github.com/Narsing-s/hostingservices/actions/workflows/ci.yml/badge.svg)](https://github.com/Narsing-s/hostingservices/actions/workflows/ci.yml)
[![Production Quality Gates](https://github.com/Narsing-s/hostingservices/actions/workflows/production-quality.yml/badge.svg)](https://github.com/Narsing-s/hostingservices/actions/workflows/production-quality.yml)
[![Production Security Gate](https://github.com/Narsing-s/hostingservices/actions/workflows/production-security-gate.yml/badge.svg)](https://github.com/Narsing-s/hostingservices/actions/workflows/production-security-gate.yml)
[![Local Compose Smoke](https://github.com/Narsing-s/hostingservices/actions/workflows/local-compose-smoke.yml/badge.svg)](https://github.com/Narsing-s/hostingservices/actions/workflows/local-compose-smoke.yml)

> **Product truth:** Nexus must only display a service as Live when the platform has evidence that the selected deployment generation is healthy and receiving the intended traffic. A green UI alone is not production proof.

## What makes Nexus a real hosting service

| Developer need | Nexus implementation |
|---|---|
| Deploy from Git | Git repository, branch/ref and service selection |
| Deploy containers | Existing Docker image or Dockerfile |
| Automatic builds | Node.js, Python, Go, Java, Rust, .NET, PHP and Ruby detection |
| Public services | HTTP routing, ports, health checks and domains |
| Background workloads | Workers and private services |
| Scheduled workloads | Cron/job-oriented deployment contracts |
| Databases | PostgreSQL and Redis managed-data foundations |
| Persistent data | Managed named volumes and backup/restore architecture |
| Previews | Isolated preview environments and deployment graphs |
| Releases | Rolling, blue/green and canary strategies |
| Safe promotion | Build, security, smoke and health release gates |
| Rollback | Known-good generation/recovery point without rebuilding the old artifact |
| Scaling | CPU, memory, request-rate and queue-aware autoscaling contracts |
| Networking | Private service networking and runtime isolation |
| Domains | Ownership verification and TLS/ACME integration |
| Secrets | Encrypted secrets and scoped access |
| Teams | Organizations, memberships, RBAC and API tokens |
| Observability | Logs, metrics, deployment events and usage metering |
| Automation | CLI, declarative `nexus.yaml`, GitHub integration and webhooks |
| Reliability | Durable deployment state, queue retries and runtime-node recovery |
| Security | Non-privileged containers, dropped capabilities, no-new-privileges, resource limits and production configuration validation |

## Deploy like a modern developer cloud

Typical flow:

```text
Connect GitHub/Git repository
        │
        ▼
Create project → Create service
        │
        ├── Runtime: auto-detect / Dockerfile / image
        ├── Build: command + environment + secrets
        ├── Start: command + port + health check
        ├── Resources: CPU + memory + replicas
        ├── Networking: public/private
        └── Domain: generated URL or custom domain
        │
        ▼
Build → Security gates → Candidate → Health check
        │
        ▼
Rolling / Blue-Green / Canary promotion
        │
        ▼
Live URL + Logs + Metrics + Deployment history
        │
        └── failure → pause / rollback / recovery point
```

A deployment is represented as a generation. Builds now record the source commit and Docker immutable image ID; when a registry digest is available it is also captured. This prevents a release system from treating a mutable image tag as the only identity of a production artifact.

## Supported workloads

- Static frontends: Vite, Astro, Angular and Node build outputs
- Node.js / Next.js / API services
- Python / Flask / FastAPI / Django-style services
- Go
- Java Maven / Gradle
- Rust
- .NET
- PHP / Composer
- Ruby / Rails-style applications
- Any custom Dockerfile
- Existing Docker images
- Long-running workers
- Cron and scheduled jobs
- Private internal services
- PostgreSQL
- Redis

For monorepos, Nexus can select a service directory containing its own Dockerfile. A repository-provided Dockerfile takes precedence over automatic runtime generation.

## Production architecture

```text
                       Nexus Console
                       Next.js Web UI
                            │
                            ▼
                    ┌───────────────┐
                    │   Nexus API   │
                    │ Fastify/PG    │
                    └───────┬───────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
           Auth/RBAC    Release      Platform
           Tenants      Controller   Services
                │           │           │
                └───────────┼───────────┘
                            ▼
                    Durable Redis Queue
                            │
                            ▼
                     Runtime Engine
                       Docker nodes
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
          Web/API         Workers        Private
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                      Traefik / Router
                            │
                     Internet / TLS

          ┌─────────────────────────────────┐
          │ PostgreSQL / Redis / Volumes    │
          │ Backups / Recovery / Metering  │
          └─────────────────────────────────┘
```

The runtime boundary is hardened by default: production containers are non-privileged, all Linux capabilities are dropped, `no-new-privileges` is enabled, CPU/memory/PID limits are supported, and arbitrary host filesystem binds are disabled unless explicitly overridden for controlled infrastructure use.

## Immutable builds and provenance

A Git deployment should be reproducible enough to answer:

- Which repository was built?
- Which ref was requested?
- Which source commit was actually cloned?
- Which generated or supplied Dockerfile was used?
- Which immutable Docker image ID was produced?
- Which registry digest was available?
- Which deployment/generation consumed the artifact?

Nexus captures the source commit and image identity during the build. A registry digest is captured when the image has already been associated with a registry digest. The next promotion layer should prefer immutable digests over mutable tags.

## Release safety

Nexus supports:

- Rolling releases
- Blue/green releases
- Canary releases
- Health-gated promotion
- Smoke-test gates
- Security gates
- Required external checks
- Durable deployment generations
- Recovery points
- Rollback without rebuilding a known-good artifact
- Deployment event history
- Failure diagnosis and recovery contracts

A production deployment is not considered complete just because `docker run` succeeded.

## Networking and domains

Production service networking should separate public traffic from internal control-plane traffic. Public services are routed through the configured ingress/router, while private services communicate through the runtime network.

Domains follow an ownership-verification workflow before being treated as verified. TLS/ACME automation is part of the production platform contract and must be backed by a real certificate provider in a hosted environment.

## Data services

PostgreSQL and Redis are treated as stateful services rather than disposable application containers. Production operation requires:

- Persistent storage
- Credentials managed as secrets
- Health checks
- Backup retention
- Restore verification
- Deletion protection where appropriate
- Resource quotas
- Recovery procedures

See [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md) and [`docs/PRODUCTION-SERVICES.md`](docs/PRODUCTION-SERVICES.md).

## Security model

Production configuration rejects insecure placeholder secrets and localhost public URLs. User workloads run with runtime hardening enabled. API access is expected to be tenant-scoped and authenticated, and privileged operations require authorization.

See [`docs/SECURITY-RUNTIME-HARDENING.md`](docs/SECURITY-RUNTIME-HARDENING.md) and [`docs/PRODUCTION-SERVICES.md`](docs/PRODUCTION-SERVICES.md).

## Declarative deployments

```bash
nexus validate nexus.yaml
nexus deploy nexus.yaml
```

Example concept:

```yaml
services:
  api:
    type: web
    repo: https://github.com/example/api
    branch: main
    build: npm ci && npm run build
    start: npm start
    port: 3000
    healthCheck:
      path: /health
    resources:
      cpu: 500m
      memory: 512Mi
```

See [`docs/NEXUS_YAML.md`](docs/NEXUS_YAML.md).

## Local development

```bash
npm install
npm run infra:up
npm run dev:api
npm run dev:engine
npm run dev
```

Full local platform check:

```bash
docker compose config
docker compose build --no-cache api web engine agent
docker compose up -d
```

Then verify API, engine, agent, Postgres and Redis health before creating deployments.

## Production deployment requirements

Set real hosted values for at least:

```text
DATABASE_URL
AUTH_SECRET
ENGINE_INTERNAL_SECRET
ENGINE_CALLBACK_SECRET
SECRETS_ENCRYPTION_KEY
WEB_URL=https://<console-domain>
PUBLIC_API_URL=https://<api-domain>
ENGINE_URL=https://<engine-control-domain>
NEXT_PUBLIC_NEXUS_API_URL=https://<api-domain>
```

Do not use localhost URLs or development placeholder secrets in production. OAuth provider credentials, registry credentials, TLS credentials and cloud-provider credentials must remain server-side.

## Production roadmap

Nexus is being built toward a complete hosted control plane rather than a mock dashboard. The remaining production work is tracked explicitly:

1. Tenant isolation and authorization on every project/service/deployment resource.
2. Immutable artifact records and digest-only promotion where registry digests exist.
3. SSRF-safe Git/provider/webhook networking and explicit outbound egress policy.
4. Preview expiry and automatic cleanup.
5. Signed webhook delivery with retries and idempotency.
6. Real managed PostgreSQL/Redis providers with backup/restore verification.
7. Billing, usage reconciliation and hard quota admission.
8. Multi-region scheduling and failover.
9. Production SLOs, alerting and incident workflows.
10. Real provider acceptance tests against a disposable production-like environment.

See [`docs/PLATFORM-GAP-MATRIX.md`](docs/PLATFORM-GAP-MATRIX.md) and [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md).

## Documentation

- [`docs/PRODUCTION-SERVICES.md`](docs/PRODUCTION-SERVICES.md) — how Nexus maps to a real hosted-service product
- [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md) — production acceptance checklist
- [`docs/SECURITY-RUNTIME-HARDENING.md`](docs/SECURITY-RUNTIME-HARDENING.md) — runtime security boundary
- [`docs/PRODUCTION_PLATFORM.md`](docs/PRODUCTION_PLATFORM.md) — platform contract
- [`docs/ADVANCED_PLATFORM_FEATURES.md`](docs/ADVANCED_PLATFORM_FEATURES.md) — release and platform capabilities
- [`docs/PLATFORM-GAP-MATRIX.md`](docs/PLATFORM-GAP-MATRIX.md) — capability/competitive acceptance matrix
- [`docs/NEXUS_YAML.md`](docs/NEXUS_YAML.md) — declarative deployment model

## Community

- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- [`SECURITY.md`](SECURITY.md)
- [`SUPPORT.md`](SUPPORT.md)
- [`LICENSE`](LICENSE)

**Nexus principle: deploy real software, prove real health, keep releases recoverable.**
