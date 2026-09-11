# Nexus Hosting

**A developer cloud built around the application graph.**

Nexus is designed to combine the useful parts of Railway, Render and Neon while adding a first-class application graph, environment cloning, recovery points and an infrastructure autopilot.

## Product direction

- **Deploy** Git repositories and Docker images
- **Databases** PostgreSQL with branch/snapshot workflows
- **Workers** for background jobs and scheduled tasks
- **Networking** service-to-service discovery and custom domains
- **Observability** deployment stream, health, logs and metrics
- **Environments** preview → staging → production cloning
- **Recovery** application-level restore points
- **Autopilot** detect configuration failures and recommend fixes

## Repository layout

```text
apps/web/       Next.js control plane UI
apps/engine/    planned deployment/orchestration engine
apps/agent/     planned host agent for Docker workloads
packages/       shared contracts and SDKs
infra/          local Docker development infrastructure
```

## Current status

The repository starts with the Nexus control-plane experience and a responsive dashboard. The deployment engine is intentionally separated from the UI so it can run on a real Docker host rather than pretending a frontend can provision infrastructure.

## Target workflow

```text
GitHub → Build → Deploy → Connect services → Health checks → Observe
                     ↓
              Recovery snapshot
                     ↓
            Preview / Staging / Prod
```

## Principles

1. No fake deployment buttons: every production action must map to an engine operation.
2. No secrets in source control.
3. PostgreSQL/data operations must have explicit backup and restore semantics.
4. Provider adapters keep the control plane portable.
5. The UI should make infrastructure understandable instead of hiding it.

## Local development

Requires Node.js 20+.

```bash
npm install
npm run dev
```

The next implementation milestone is the Docker deployment engine, PostgreSQL provisioning, GitHub webhook ingestion, persistent control-plane database, authentication and real-time deployment logs.
