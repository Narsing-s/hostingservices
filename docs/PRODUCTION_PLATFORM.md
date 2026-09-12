# Nexus production platform

This document is the implementation contract for Nexus Hosting as a production cloud platform. A capability is not complete when it is only a UI mock, an in-memory state object, or an API returning success without performing the underlying operation.

## 1. Core hosting

- Organizations, teams, projects and isolated environments
- Web, worker, cron and private services
- GitHub/GitLab/Bitbucket source deployments
- Docker image deployments
- Automatic runtime detection with Dockerfile override
- Monorepo and changed-path aware builds
- Immutable deployment artifacts
- Durable, idempotent deployment queue
- Versioned deployment history and rollback
- Custom commands, ports, domains and TLS
- Persistent volumes
- PostgreSQL and Redis managed data

## 2. Deployment lifecycle

```text
QUEUED -> CLONING -> DETECTING -> BUILDING -> TESTING -> SECURITY_SCAN
       -> PROVISIONING -> DEPLOYING -> HEALTH_CHECK -> TRAFFIC_SHIFT -> LIVE

failure -> DIAGNOSING -> AUTO_RECOVERY -> ROLLING_BACK -> LIVE|FAILED
```

Every transition must be persisted, authenticated, idempotent, observable and bounded by a timeout. Deployment cancellation must be supported. Build logs and runtime logs must be retained according to environment policy.

## 3. Zero-downtime deployment strategies

Support rolling, blue/green, canary and recreate strategies. Health checks gate traffic changes. Canary deployments must support a configurable percentage and promotion/abort. A failed health check or configured error budget violation must stop promotion and optionally rollback.

## 4. Autoscaling

Support CPU, memory, requests/second, queue depth and scheduled scaling. Every policy has minimum/maximum replicas and cooldown periods. Scaling decisions are persisted as events and must be idempotent.

Example:

```yaml
autoscaling:
  min: 1
  max: 10
  cpuPercent: 65
  cooldownSeconds: 60
```

## 5. Application Graph

Represent every service, database, cache, volume, domain and dependency as a graph node. Edges contain protocol and port metadata. The graph powers topology, dependency health and blast-radius analysis.

```text
Frontend -> API -> PostgreSQL
             |
             +-> Redis
             +-> Worker
```

## 6. Recovery Points

Before production deployments, optionally create a recovery point containing:

- source commit/ref
- immutable image references
- configuration version
- secret version reference
- database snapshot references
- creation time and actor
- reason for creation

Restoring a recovery point must be an auditable, idempotent operation.

## 7. Managed data

PostgreSQL and Redis are the initial managed engines. The data abstraction must support generated credentials, persistent storage, health, metrics, backups, snapshots, restore and future adapters for MySQL, MongoDB, MariaDB and ClickHouse.

Backups must have retention policies and periodic restore verification. A backup that has never been restored is not considered verified.

## 8. Security

- Organization/project/environment isolation
- RBAC: owner, admin, developer, deployer, viewer, billing, security
- Scoped, expiring and revocable API tokens
- Secret versioning, rotation and emergency revocation
- Secret redaction in all logs and API errors
- Non-root containers and restricted Linux capabilities
- Network isolation and private services
- Image and dependency vulnerability scanning
- SBOM and artifact provenance
- Audit events for auth, deployments, secrets, billing and administration
- Rate limiting and request-size limits
- OIDC/SAML/SCIM adapters for enterprise
- Optional private networking and dedicated runtime nodes

Never expose the host Docker socket to an untrusted application container.

## 9. Observability

Expose structured live logs, build logs and proxy logs with search, filters and retention. Track CPU, memory, disk, network, requests, latency, errors, restarts, health and deployment duration. Support OpenTelemetry-compatible traces and alert integrations.

Alert destinations should include generic webhooks plus email, Slack, Teams, Discord and PagerDuty adapters.

## 10. Cost intelligence

Meter CPU seconds, memory GiB-seconds, storage GiB-hours, bandwidth, build minutes and requests. Display per-service usage, current cost, projected cost and optimization recommendations. Billing calculations are server-side only.

The Cost Optimizer may recommend right-sizing, idle-service suspension, storage cleanup, build-cache improvements and lower-cost placement. Automatic changes require an explicit policy.

## 11. Developer experience

- GitHub App with repository picker
- PR preview environments with isolated resources
- Automatic preview URL and GitHub status/comment
- Preview garbage collection when PRs close
- `nexus init`, `validate`, `plan`, `diff`, `deploy`, `logs`, `scale`, `rollback`, `destroy`
- Versioned REST API
- Signed webhooks and event subscriptions
- Service templates
- Marketplace
- Docker/Kubernetes workload import

## 12. Provider abstraction

The public control-plane API must not be coupled to Docker. Provider adapters share the contracts in `packages/platform-contracts` and can implement Docker first, followed by Kubernetes, AWS, GCP, Azure, Hetzner, DigitalOcean and Cloudflare where credentials/infrastructure exist.

Each provider must implement validation, deployment, scaling, rollback and destruction. Provider failures must return normalized Nexus errors and never leak provider credentials.

## 13. Nexus Autopilot

Autopilot consumes deployment, build, runtime and health events to diagnose failures. It may propose remediation such as restart, rollback, scale-out or configuration correction. Automatic remediation is permitted only for explicitly enabled actions and must emit an audit event with the evidence and result.

## 14. Container/image registry

The long-term platform includes a private OCI registry with immutable tags, retention, vulnerability scanning, SBOM/provenance and optional image signing. Deployments reference immutable digests where possible.

## 15. Global infrastructure

The scheduler must be region-aware. Future regions include India, US, Europe, Singapore and Australia. Placement should consider capacity, latency, policy and cost. Multi-region traffic distribution should support weighted and health-based routing.

## 16. DNS and domains

Custom domains must support ownership verification, automatic TLS, renewal, status and safe removal. DNS providers should be adapters so Cloudflare and other DNS APIs can be integrated without coupling the core control plane.

## 17. CI/CD quality gates

Every production change should run:

```text
lint -> typecheck -> unit tests -> integration tests -> API tests
-> Docker build -> security/dependency scan -> SBOM
-> smoke deployment -> E2E -> rollback test
```

Workflow failures must fail the commit. Do not use `--force` dependency installation as a permanent CI workaround.

## 18. Enterprise and billing

Organizations need usage metering, plan quotas, invoices, payment-provider adapters, budget alerts, hard/soft limits, audit export, SSO, SCIM and policy controls. Billing must be isolated from deployment execution so a billing failure cannot corrupt running workloads.

## 19. Definition of done

A production feature is complete only when it has:

1. persisted state where appropriate;
2. authorization and tenant isolation;
3. idempotency and retry behavior;
4. bounded timeouts and cancellation;
5. structured events/audit records;
6. failure and rollback handling;
7. unit/integration tests;
8. a smoke/E2E path;
9. documented API/CLI behavior;
10. a real console experience backed by live data.
