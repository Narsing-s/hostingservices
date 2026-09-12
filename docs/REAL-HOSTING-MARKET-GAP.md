# Nexus Real Hosting Market Gap & Launch Plan

This document turns Nexus from a feature-rich platform concept into a verifiable hosting product. It is intentionally stricter than a UI checklist: a capability is only considered shipped when the customer can use it end-to-end and the platform proves the result.

## Current product position

Nexus already has a strong foundation: Git/Docker deployment, multiple workload types, PostgreSQL/Redis foundations, release strategies, health-gated traffic, rollback, previews, custom domains/TLS foundations, secrets, RBAC, audit events, usage metering, autoscaling contracts, CLI/config-as-code, and a provider abstraction.

## Launch blockers that must become real product capabilities

### P0 — security and isolation

- Harden tenant isolation at the container, filesystem, network, metadata and control-plane boundaries.
- Run customer builds and workloads with least privilege; never expose the Docker socket or control-plane credentials to customer code.
- Add SSRF and egress controls with explicit allow/deny policy and private-network protection.
- Enforce CPU, memory, PID, disk, log, build-time, deployment-rate and outbound-network limits before jobs enter the runtime.
- Add secret redaction tests covering build logs, runtime logs, errors, environment inspection and deployment events.
- Add cross-tenant authorization tests for every organization/project/environment/service/deployment endpoint.
- Add domain takeover prevention and verified DNS ownership checks.
- Add signed webhook replay protection and idempotency.

### P0 — real operations

- Production immutable image registry with image digest, source revision and provenance attached to every deployment.
- Automated encrypted PostgreSQL backups, retention policies and verified restore jobs.
- Disaster recovery runbooks plus scheduled restore drills with measured RPO/RTO.
- Preview environment garbage collection for merged/closed PRs, expired previews, volumes and networks.
- Production SLO telemetry for API latency/error rate, queue latency, build duration, deployment success, runtime health, routing and certificate renewal.
- Status page/incident communication workflow and operator escalation runbooks.

### P0 — customer lifecycle and monetization

- Plans and entitlements: compute, memory, storage, bandwidth, builds, deployments, logs, databases and seats.
- Meter reconciliation from runtime facts rather than UI-submitted usage.
- Subscription lifecycle, invoices, payment failures, grace periods and cancellation/downgrade handling.
- Budget alerts and hard limits to prevent runaway compute/build/storage spend.
- Organization billing owner and usage/cost dashboard.

### P1 — developer experience parity

- GitHub App installation for personal and organization repositories with clear permission scopes.
- Git provider expansion after GitHub: GitLab and Bitbucket.
- One-click import/deploy flow with framework detection and editable build/start settings.
- First-class monorepo service selection and dependency graph visualization.
- Deployment timeline with source commit, build, artifact, checks, health, traffic, logs and rollback in one place.
- Real-time deployment events using SSE/WebSocket rather than polling-only UI.
- Signed outbound webhooks with delivery history, retry/backoff and test-event tooling.
- Email, webhook and ChatOps notifications for deploy failures, rollbacks, incidents, quota and budget events.
- Environment cloning and variable/secret promotion between environments.
- Maintenance windows, deploy locks and manual approval gates.

### P1 — hosting capabilities customers expect

- Private service networking with internal DNS and environment isolation.
- Static sites with CDN/edge caching and cache invalidation.
- Persistent volumes with snapshots, attach/detach safety and capacity metrics.
- More managed databases beyond PostgreSQL/Redis where provider adapters can support them safely.
- Object storage for uploads, artifacts and backups.
- IPv4/IPv6, TCP services where appropriate, outbound IP controls and network policies.
- Multi-region placement with region selection, failover policy and latency-aware routing.
- Horizontal and vertical autoscaling with visible scaling events and cooldown controls.
- Job/workflow primitive for one-off and distributed background execution.

### P1 — platform intelligence

- Deployment risk score based on changed files, historical failures, health and runtime signals.
- Adaptive canary controller with configurable promotion/rollback thresholds.
- Incident timeline correlating deploys, logs, metrics, health failures and restarts.
- Autopilot recommendations must be evidence-backed, bounded and auditable; never silently mutate production.
- Cost-aware placement and scale recommendations.
- Automatic stale preview/resource detection.

## Product experience target

The primary journey should be:

```text
Sign up
  -> Create organization/project
  -> Connect GitHub / GitLab / Bitbucket OR choose Docker image
  -> Detect framework and service type
  -> Configure build/start/health/environment
  -> Deploy
  -> Watch real-time build + release evidence
  -> Receive working HTTPS URL
  -> Add custom domain
  -> Add database/Redis/private services
  -> Preview every PR
  -> Scale / observe / alert
  -> Roll back in one action
```

Every major screen should show the real server state. Never display a deployment as `Live`, a backup as `Healthy`, or a domain as `Verified` solely because a client-side action completed.

## Competitive bar

Current hosting platforms demonstrate that the market baseline includes autoscaling, private networking, persistent storage, previews, zero-downtime deployment, managed databases, cron/workflows, infrastructure-as-code, observability and API/CLI automation. Nexus should match the baseline while differentiating through evidence-first releases, application-graph deployments, recovery points, portable runtime contracts and cost-aware scheduling.

## Definition of done for public hosting

A feature is `Production` only if all are true:

1. UI workflow exists.
2. API contract exists and is authorization-checked.
3. Durable state survives restart.
4. Runtime/queue path is implemented.
5. Failure path is handled.
6. Secrets and tenant boundaries are protected.
7. Metrics/logs/audit evidence exists.
8. Automated tests cover success and failure.
9. Production provider validation passes.
10. Documentation and operator runbook exist.

## Recommended execution order

1. Tenant isolation + sandboxing + abuse controls.
2. Real-provider deployment validation.
3. Registry/provenance + backup/restore + DR.
4. Billing/entitlements/budgets.
5. GitHub App + real-time deployment UX.
6. Webhooks/notifications/status/support.
7. Private networking + volumes + object storage.
8. Multi-region + advanced autoscaling.
9. Risk/incident/cost intelligence.
10. Independent security review before GA.

Nexus should not claim to be a general-purpose public hosting provider until the P0 launch blockers have evidence in production-like environments. The goal is not to have the most buttons; it is to provide a hosting service customers can trust with real workloads.