# Production Services

This document defines what Nexus must provide to operate as a real hosted developer cloud rather than a deployment dashboard.

## 1. Web service

A web service is an application that receives public HTTP traffic.

Required configuration:

- source repository or container image
- branch/ref
- build/start command or Dockerfile
- environment variables and secrets
- internal container port
- health endpoint
- CPU/memory/PID limits
- replica count
- deployment strategy
- generated public URL or custom domain

Lifecycle:

```text
Queued → Build → Candidate → Health check → Traffic shift → Live
                                      │
                                      └── failure → Rollback
```

A web service is only Live when the candidate passes health gates and the router reports the intended generation as active.

## 2. Worker service

Workers run continuously without receiving public HTTP traffic.

Workers must:

- run on private networking by default
- expose no public router entry unless explicitly configured
- support environment/secrets
- have CPU/memory/PID limits
- restart after process failure according to policy
- participate in deployment generations
- expose logs and health/status evidence

## 3. Cron service

Cron services execute a command on a schedule.

A production scheduler must persist schedules and execution history. A browser refresh or API restart must not erase a schedule.

Required production fields:

- schedule expression/time zone
- command/image
- concurrency policy
- timeout
- retry policy
- execution history
- last success/failure
- alerting destination

## 4. Private service

Private services are reachable only through the internal runtime network or authenticated platform pathways.

They must never be accidentally published through the public ingress router.

Examples:

- internal API
- worker-to-worker service
- internal GraphQL service
- queue consumer
- internal administration service

## 5. PostgreSQL

A production PostgreSQL service is stateful.

Minimum operational contract:

- persistent storage
- generated credentials
- secret rotation
- health checks
- resource limits
- connection information delivered as secrets/environment variables
- scheduled backups
- retention policy
- restore verification
- deletion protection
- monitoring

The current Docker-backed implementation is suitable as a development/single-node foundation. A hosted multi-tenant production service should use a durable managed PostgreSQL provider or a dedicated database fleet.

## 6. Redis

Redis supports queues, caching and platform coordination.

Production requirements:

- persistent configuration where required by workload
- authentication
- resource limits
- health checks
- backup strategy when data is durable
- HA/failover for platform-critical queues
- monitoring

## 7. Persistent volumes

Application volumes must be managed rather than arbitrary host filesystem paths.

Production runtime rules:

- no unrestricted host binds
- stable volume identity
- ownership/permission controls
- quota accounting
- backup metadata
- attach/detach lifecycle
- safe deletion workflow

Nexus runtime hardening rejects unsafe host volume paths and disables host filesystem binds in production unless explicitly enabled for controlled infrastructure operation.

## 8. Domains and TLS

Custom domains require:

1. domain registration in the project
2. ownership verification
3. router configuration
4. certificate issuance
5. certificate renewal
6. health verification
7. safe removal

A domain must not become `verified` solely because a client says it is configured.

## 9. Deployment artifacts

Every build should preserve enough provenance to answer:

```text
repository
ref
source commit
Dockerfile/runtime
build environment
image tag
immutable image ID
registry digest, when available
deployment ID
generation ID
```

Mutable image tags are convenience identifiers. Promotion and rollback should prefer immutable image identity.

## 10. Scaling

Nexus scaling must distinguish:

- desired replicas
- current replicas
- minimum replicas
- maximum replicas
- CPU target
- memory pressure
- request-rate signal
- queue-depth signal
- cooldown period

Scaling decisions must be persisted so operators can understand why a replica count changed.

## 11. Deployments and rollback

Deployments must be durable and resumable.

A successful deployment should create a known-good recovery point. Rollback should select that artifact/generation rather than rebuild source code and hope it produces the same result.

Required release evidence:

- build result
- security result
- health result
- traffic result
- generation ID
- node/provider
- timestamps
- failure reason, if applicable

## 12. Tenant isolation

Every organization-owned resource must be scoped through the authenticated user's organization membership.

The authorization rule is:

```text
user → organization membership → project → service/deployment/domain/data
```

A valid object ID is not sufficient authorization. APIs must verify ownership/membership before reading or mutating the resource.

## 13. Quotas and billing

Quota enforcement should happen before accepting work when possible and again at the database/runtime boundary.

Typical limits:

- services
- projects
- members
- CPU
- memory
- persistent storage
- deployment concurrency
- database resources
- bandwidth/egress

Billing usage must be reconciled from durable runtime/deployment evidence rather than trusting browser-provided values.

## 14. Security boundary

Application containers must run with:

- `Privileged=false`
- dropped Linux capabilities
- `no-new-privileges`
- CPU limits
- memory limits
- PID limits
- restricted host mounts
- isolated runtime networking

Builds also require resource/time/network sandbox controls.

User-controlled repository URLs, webhook URLs and other outbound fetch targets must be protected against SSRF and cloud metadata access before a multi-tenant hosted launch.

## 15. Observability

Operators need to see:

- service status
- deployment phase
- build logs
- runtime logs
- restart count
- health state
- replica count
- resource usage
- deployment events
- rollback history
- node/provider

The UI must distinguish `Live`, `Deploying`, `Degraded`, `Failed`, `Blocked` and `Unknown`.

## 16. Production acceptance

Nexus should not be marketed as a full hosted platform until the hosted environment demonstrates an end-to-end test such as:

```text
Git push
  ↓
Webhook / deployment request
  ↓
Authenticated project lookup
  ↓
Quota admission
  ↓
Source clone
  ↓
Sandboxed build
  ↓
Immutable image identity
  ↓
Candidate container
  ↓
Health gate
  ↓
Traffic switch
  ↓
Public HTTPS URL
  ↓
Logs + metrics
  ↓
Second deployment
  ↓
Failed candidate
  ↓
Automatic/manual rollback
  ↓
Previous generation healthy
```

This test must be executed against a real production-like environment with real DNS/TLS, PostgreSQL/Redis, runtime nodes and durable storage. Local Docker Compose is a development verification environment, not proof of hosted production readiness.
