# Nexus deployment lifecycle

Nexus now separates control-plane requests from durable runtime execution:

1. API validates the deployment request.
2. A deployment job is placed in the Redis/BullMQ `nexus-deployments` queue.
3. A worker claims the job with bounded concurrency, retries and exponential backoff.
4. Git source is built into an immutable image tag.
5. A candidate container is started independently from the active runtime.
6. The candidate must pass a Docker `HEALTHCHECK` or configured HTTP health signal.
7. Only a healthy candidate is eligible for traffic handoff.
8. The active deployment remains available if candidate startup or health validation fails.
9. Deployment state is represented as `QUEUED → BUILDING → STARTING → HEALTHY`, or `FAILED`/`STOPPED`/`ROLLING_BACK`.
10. Traefik is provided for local routing experiments; production traffic switching must use a configured router with an explicit active/candidate handoff.
11. Rollback creates a new candidate from the previous known-good image rather than deleting the active runtime first.

## Health policy

Production deployments should provide a Docker `HEALTHCHECK` or an application health endpoint. A process being alive is not sufficient evidence that an application is healthy.

## Durable queue

`REDIS_URL` points the API and worker at Redis. Jobs use retries, exponential backoff and optional `Idempotency-Key` values. Run at least one API process and one worker process in production.

## Persistence

The Prisma schema contains deployment lifecycle status, timestamps, image/container metadata, previous deployment linkage and deployment logs. Apply the migration with the repository's Prisma migration workflow before enabling persistent deployment history.

## Zero-downtime rule

Nexus must never stop the active container merely to test a new candidate. Traffic switching is a separate operation that happens only after health validation. The local Traefik configuration is the starting point for this routing layer; production TLS, domain verification and multi-node routing still require explicit infrastructure configuration.
