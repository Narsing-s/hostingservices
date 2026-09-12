# Nexus implementation status

This document is intentionally kept current with the repository. Older milestone lists described the initial prototype and are no longer a reliable statement of product status.

## Implemented platform foundation

- Fastify control plane with PostgreSQL persistence.
- Redis/BullMQ deployment queues with idempotency and bounded retries.
- Dedicated runtime engine and deployment worker.
- Docker provider with Git builds and Docker image deployments.
- Runtime-node health, capacity-aware placement and failover foundations.
- Durable deployment lifecycle and deployment events.
- Health-gated runtime startup, traffic routing and rollback foundations.
- Rolling, blue/green and canary release strategies.
- GitHub webhook signature verification and delivery deduplication.
- GitHub repository browsing and repository/service detection foundations.
- Custom domains, DNS verification and Traefik/TLS foundations.
- Encrypted secrets, scoped tokens, RBAC and audit events.
- PostgreSQL/Redis managed-data foundations and persistent volumes.
- Preview environments and preview protection foundations.
- Release gates, deployment inspector, recovery points and deployment comments.
- Usage metering, quotas and autoscaling contracts.
- Provider abstraction and declarative `nexus.yaml`/CLI deployment model.
- Same-origin hosted web/API gateway to prevent production browser loopback failures.
- Local Compose, browser E2E and production-quality security/build gates.

## Remaining launch-critical work

The following are not merely documentation tasks and must be completed before claiming general availability:

1. **Tenant isolation:** prove that untrusted customer workloads cannot access other tenants, control-plane credentials, Docker socket capabilities or internal metadata.
2. **Abuse prevention:** enforce tenant-aware limits for builds, deployments, runtime CPU/memory/PIDs, storage, logs, outbound network and domains before work reaches the runtime.
3. **Billing:** implement plans, subscription lifecycle, invoices, payment failures, metering reconciliation and budget enforcement.
4. **Backups/DR:** automate encrypted backups, retention, restore verification and cross-node/cross-region recovery tests.
5. **Webhook delivery:** provide signed outbound events, retry policy, delivery history and operator-visible failures for platform notifications.
6. **Notifications:** email/webhook/ChatOps notifications for failed deploys, rollbacks, incidents and quota/budget events.
7. **Production registry:** use an immutable image registry and record image digests/provenance for every customer release.
8. **Preview garbage collection:** reliably destroy expired/closed-PR resources and associated volumes/network state.
9. **Observability SLOs:** measure API, build queue, deployment, routing and runtime SLOs from production telemetry.
10. **Operational readiness:** publish support, status, incident severity, escalation, migration and rollback runbooks.
11. **Real-provider validation:** exercise the complete control plane against the actual production runtime/network/domain/database provider configuration rather than only local Compose.

## Product truth

A capability is production-ready only when its backend contract, UI workflow, durable state, security controls, observability, failure path and automated tests work together. See `docs/MARKET-LAUNCH-GATE.md` before public launch.
