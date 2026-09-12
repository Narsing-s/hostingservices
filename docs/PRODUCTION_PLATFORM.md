# Nexus production platform

This document defines the production control-plane contract for Nexus Hosting. Nexus is intended to operate as a real application hosting platform, not only a deployment demo.

## Control plane

- Organizations and membership roles: owner, admin, developer, viewer.
- Projects belong to organizations.
- Environments isolate production, staging, previews and other deployment targets.
- Services are first-class resources: web, worker, cron, private, PostgreSQL and Redis.
- Secrets are encrypted before persistence and are never returned by the API.
- Audit logs capture security-sensitive control-plane actions.
- Usage events provide the foundation for quotas and billing.
- Volumes and database instances are modeled as durable resources.

## Runtime isolation

Every user workload must execute in an isolated runtime. A production executor must enforce CPU, memory, process, disk and build-time limits. Never expose the Docker socket to untrusted application containers.

Recommended production layout:

```text
Internet
  |
  +-- TLS / Traefik
        |
        +-- Nexus API / Console
        |
        +-- Scheduler / Queue
              |
              +-- Ephemeral build workers
              |
              +-- Runtime workers
                    |
                    +-- isolated application containers
                    +-- private services
                    +-- persistent volumes
```

## Deployment lifecycle

```text
queued -> cloning -> detecting -> building -> pushing -> starting
       -> health_checking -> routing -> ready

failure -> failed
healthy deployment -> rolling_back -> ready|failed
```

Every state transition must be persisted and idempotent. Build and runtime operations must have bounded timeouts and cancellation support.

## Environments and preview deployments

Pull requests should create an isolated preview environment. The preview should receive a deterministic URL, deployment status should be reported back to GitHub, and the environment should be garbage-collected when the pull request closes.

## Observability

A production installation should expose:

- build logs
- runtime logs
- proxy logs
- CPU/memory/network metrics
- request rate, latency and error rate
- container restarts and health state
- deployment duration and failure reason
- audit events

Logs must redact secret values before they leave the runtime boundary.

## Security requirements

Production deployments must set strong values for `AUTH_SECRET`, `SECRETS_ENCRYPTION_KEY`, `GITHUB_WEBHOOK_SECRET` and `ENGINE_CALLBACK_SECRET`. CORS must be restricted to known console origins. Sessions must use Secure cookies behind HTTPS. API tokens must be scoped and hashed at rest.

## Data protection

The control plane requires PostgreSQL backups and tested restores. User volumes and databases require snapshot/backup policies. Recovery should be tested periodically instead of assuming that a backup is usable.

## Scaling

The first production architecture can use Docker on one or more dedicated runtime hosts. The scheduler should be host-aware so the same API can later schedule workloads across multiple runtime nodes or Kubernetes without changing the public deployment API.
