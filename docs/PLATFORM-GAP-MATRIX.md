# Nexus Platform Gap Matrix

This document is the product acceptance checklist for Nexus. The goal is not to copy Vercel, Railway, Render, or Neon. The goal is to combine the strongest proven workflows with a provider-neutral runtime and safer release model.

## Baseline capabilities

| Capability | Nexus target | Status | Acceptance bar |
|---|---|---:|---|
| Git deployments | Repository + branch/ref | Implemented | A real source produces a durable deployment record |
| Docker deployments | Image or Dockerfile | Implemented | Image digest is recorded and deploy is reproducible |
| Build detection | Runtime/framework detection | Implemented | Unsupported projects fail with actionable diagnostics |
| Build logs | Structured build/runtime logs | Implemented | Logs are available without exposing secrets |
| Health checks | HTTP/Docker/process | Implemented | Unhealthy candidates never receive production traffic |
| Rolling releases | Replica-safe rollout | Implemented | Existing healthy traffic remains available |
| Blue/green | Candidate + stable traffic | Implemented | Candidate can be promoted or discarded |
| Canary | Weighted traffic | Implemented | Failed evidence pauses or rolls back rollout |
| Immutable generations | Deployment IDs/generations | In progress | Every release is addressable and recoverable |
| Instant rollback | Previous known-good generation | Implemented | Rollback does not require a rebuild |
| Release gates | Build/security/health/smoke/checks | In progress | Required gates block promotion |
| Preview environments | Isolated environment graph | Foundation | PR preview is reproducible and disposable |
| Preview protection | Public/org/protected | Planned | Protected previews require short-lived access |
| Deployment inspector | Single release evidence view | Foundation | One page explains what changed and why it is live |
| Version pinning | Session/request generation pinning | Foundation | Old clients cannot accidentally hit incompatible generations |
| Autoscaling | Resource/queue-aware contracts | Implemented | Scale decisions are observable and bounded |
| Runtime nodes | Capacity + failover | Implemented | Lost node can be replaced without corrupting deployment state |
| Domains | Verification + routing | Implemented | Domain ownership is verified before traffic is exposed |
| TLS | ACME/Traefik contract | Implemented | Certificates are never hardcoded |
| Secrets | Encrypted server-side storage | Implemented | Secrets never reach browser bundles or logs |
| RBAC | Organization/project permissions | Implemented | Every privileged API operation checks authorization |
| Audit log | Security-sensitive activity | Implemented | Actor, target, action and timestamp are retained |
| Usage metering | Resource usage/cost estimate | Implemented | Usage is attributable to project/environment/service |
| PostgreSQL | Managed-data foundation | Implemented | Persistent data survives app deployments |
| Redis | Queue/cache foundation | Implemented | Queue failures are visible and recoverable |
| Persistent volumes | Stateful runtime storage | Foundation | Data is not silently lost on redeploy |
| Cron jobs | Scheduled workloads | Foundation | Scheduler retries and records outcomes |
| Private services | Internal networking | Foundation | Private services are not accidentally public |
| Multi-region | Placement and failover | Foundation | Region choice affects scheduling without changing app contract |
| Provider adapters | Provider-neutral contracts | Foundation | Provider changes do not rewrite product logic |
| CLI | Deploy/validate locally and CI | Implemented | CLI and web/API produce the same deployment contract |
| Config as code | `nexus.yaml` | Implemented | Manifest can reproduce an environment |
| Webhooks | Platform event delivery | Planned | Events are signed, retried, and observable |
| Notifications | Email/webhook/ChatOps | Planned | Critical deployment events can be routed to teams |
| Cost controls | Budgets and deployment guardrails | Planned | Cost limits can stop unsafe scaling or builds |
| Backup/restore | Recovery points | Foundation | Restore is tested, not just documented |
| Disaster recovery | Cross-node/cross-region recovery | Planned | Recovery objectives are explicit and exercised |

## Developer experience bar

Nexus should feel fast without hiding infrastructure truth:

1. **One command to deploy** from Git or Docker.
2. **One page to understand a release**: source, build, checks, artifact, environment, health, traffic, logs and rollback.
3. **One safe path to preview** every meaningful change.
4. **One safe path to rollback** without rebuilding the old version.
5. **One consistent contract** across web UI, API and CLI.
6. **Actionable failures**, never generic "deployment failed" messages.
7. **No localhost fallbacks in production builds.** Hosted clients must receive an explicit public API URL.
8. **No fake status.** UI state is derived from server state and deployment events.

## Reliability bar

A production release is not considered complete until:

- the candidate is healthy;
- required release gates pass;
- the deployment has a durable ID and generation;
- traffic movement is observable;
- rollback target is known;
- logs and metrics can identify the failing service;
- retries are bounded and idempotent;
- secrets are redacted;
- a failed rollout leaves the previous healthy generation available when possible.

## Competitive direction

### Learn from Vercel

Previews, deployment checks, deployment protection, immutable releases, rollback and a highly focused deployment UX are useful patterns. Vercel added native deployment checks that can hold a production deployment until required checks pass. Nexus should implement the capability with its own release-gate contract and provider-neutral execution model.

### Learn from Railway

Isolated environments, PR environments, service-oriented deployment, health checks, scaling, observability, CLI automation and config-as-code are valuable patterns. Nexus should extend the model across an explicit application graph and portable runtime.

### Nexus differentiators

- **Application Graph Releases:** release web/API/worker/cron/data dependencies as one topology-aware change.
- **Adaptive Release Brain:** advance canaries from live evidence instead of blindly following a timer.
- **Recovery Points:** preserve known-good deployment/runtime state for rapid recovery.
- **Portable Runtime:** Docker-first contracts make the control plane independent of one cloud vendor.
- **Cost-aware Scheduling:** combine capacity, reliability and cost when selecting runtime nodes.
- **Provider Escape Hatch:** keep deployment specifications portable so users can move infrastructure without rewriting the application.
- **Evidence-first UX:** the deployment inspector explains the exact reason a release is blocked, promoted, paused, or rolled back.

## Definition of "better"

Nexus should not claim to be better because it has more buttons. It is better only when a real user can:

- deploy faster,
- understand failures faster,
- recover from failures faster,
- move between infrastructure providers with less work,
- run multi-service applications safely,
- and verify that the platform actually did what the UI says it did.
