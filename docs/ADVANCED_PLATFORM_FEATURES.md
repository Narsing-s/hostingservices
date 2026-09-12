# Nexus Hosting — Advanced Platform Features

Nexus should learn from the strongest platform patterns in Vercel without becoming a Vercel clone. The goal is a provider-neutral hosting control plane that can run web apps, APIs, workers, cron jobs, private services, containers, and managed infrastructure.

## 1. Deployment Checks → Nexus Release Gates

Every production deployment can be built first and released only after configurable gates pass.

Required gates:

- build succeeded
- security scan passed
- health checks passed
- smoke test passed
- error-rate threshold passed
- latency threshold passed
- required GitHub checks passed
- environment/config validation passed
- optional human approval

A failed gate keeps the candidate isolated and never moves production traffic.

## 2. Session-Safe Releases → Nexus Version Pinning

During canary/rolling releases, Nexus should pin a browser session to the deployment generation that served its first page.

Supported signals:

- `x-nexus-deployment-id`
- `?nexusDeployment=<id>` for automation
- an HttpOnly `__nexus_dpl` cookie for long-running sessions

This prevents a frontend from version N from unexpectedly calling a backend from version N+1 during a rollout. The pin expires according to deployment retention.

## 3. Adaptive Canary → Nexus Release Intelligence

Do not use fixed traffic percentages only. Nexus can evaluate the candidate after every stage.

Default stages:

`1% → 5% → 25% → 50% → 100%`

At every stage collect:

- HTTP 5xx rate
- health-check failures
- p95/p99 latency
- restart count
- CPU/memory pressure
- deployment logs
- request volume

Nexus automatically pauses or rolls back when a configured threshold is exceeded. This becomes an adaptive release controller rather than a simple weighted router.

## 4. One Deployment Graph → Atomic Multi-Service Previews

A preview is a deployment graph, not just a URL.

Example:

```text
preview-842
├── web
├── api
├── worker
└── postgres-branch
```

Services can communicate through deployment-scoped private bindings such as:

`NEXUS_SERVICE_API_URL`

Bindings must resolve to the matching preview generation rather than production. Public exposure remains opt-in per service.

## 5. Build Intelligence and Reproducibility

Add a content-addressed build cache.

Cache key inputs:

- repository commit/tree hash
- detected framework
- lockfile hash
- runtime version
- build command
- relevant environment fingerprint
- dependency/cache version

Cache outputs are immutable and reusable across previews and production. A user can force a clean build without destroying reusable cache entries.

## 6. Preview Protection

Preview environments support three modes:

- public
- organization-only
- protected link

Protected previews should support short-lived signed access links and automation bypass secrets. Secrets must never be exposed to browser JavaScript.

## 7. Deployment Inspector

Every deployment should expose a machine-readable inspector containing:

- commit SHA and branch
- detected framework/runtime
- build duration
- cache hit/miss information
- artifact digest
- service graph
- environment generation
- resource limits
- rollout stage
- health/check results
- active traffic percentage
- rollback target

This should be usable from the dashboard, CLI, and API.

## 8. Provider-Neutral Runtime

Nexus must not hard-code one infrastructure vendor. Providers implement a common contract for:

- build
- artifact storage
- container execution
- routing
- domains/TLS
- databases
- object storage
- secrets
- logs/metrics

Railway/Render/Vercel-like integrations can therefore be providers or import/export targets instead of architectural dependencies.

## 9. Nexus Differentiators

These features intentionally go beyond a Vercel-style frontend-first hosting product:

1. **Adaptive Release Brain** — automatically chooses whether to advance, pause, or rollback based on live health signals.
2. **Deployment Graphs** — one preview can represent an entire application topology.
3. **Portable Runtime** — Docker-first execution across local nodes, cloud VMs, and future providers.
4. **Recovery Points** — rollback includes runtime configuration and generation metadata, not just source code.
5. **Cost-aware Scheduling** — placement can consider region, capacity, resource limits, and quota before starting work.
6. **Unified Web + Worker + Cron + Private Services** — one project model for request-driven and background workloads.
7. **Provider Escape Hatch** — export a deployment specification so users are not locked into Nexus.

## 10. Implementation Order

### Phase A — release safety

- release gates
- deployment inspector
- session/version pinning
- adaptive canary controller

### Phase B — application topology

- deployment-scoped service bindings
- atomic multi-service previews
- preview protection
- preview garbage collection

### Phase C — build platform

- content-addressed build cache
- remote/prebuilt artifact upload
- reproducible build manifest
- framework/runtime detection improvements

### Phase D — platform ecosystem

- provider adapters
- marketplace integrations
- import/export of deployment specifications
- CLI support for every release operation

## Design rule

Nexus should copy **capabilities and proven engineering patterns**, not Vercel's implementation, branding, APIs, or proprietary internals. Every feature must fit Nexus's existing durable deployment state machine, runtime-node architecture, Docker execution model, RBAC, audit logs, quotas, and recovery system.
