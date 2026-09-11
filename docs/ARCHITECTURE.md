# Nexus architecture

Nexus is split into a control plane and a workload plane.

- **Web**: developer console and product UX.
- **API**: authentication, projects, environments, services, domains and deployment API.
- **Engine**: orchestration state machine; it never marks a deployment healthy before the provider confirms it.
- **Agent**: runs beside Docker on a workload host and exposes a small health/control surface.
- **Providers**: portable workload adapters; Docker is the first provider.
- **Database**: PostgreSQL is the source of truth for control-plane state.
- **Redis**: queue/event backbone for asynchronous builds and deployments.

## Deployment lifecycle

`queued → building → starting → health check → healthy`

Failures are terminal until retry or rollback. A deployment is immutable: rollback means starting a previously known-good image, not rebuilding source code.

## Product primitives

1. Workspace
2. Project
3. Environment (production/staging/preview)
4. Service (web/worker/cron/database)
5. Deployment
6. Domain
7. Environment variables/secrets
8. Observability events

## Security rules

- Secrets are never committed to source control.
- Deployment credentials belong in the control plane secret store.
- Workload execution must be isolated from the public API.
- Production builds should run in isolated builders rather than sharing the control-plane host Docker socket.
- PostgreSQL backups and restore operations must be explicit and auditable.
