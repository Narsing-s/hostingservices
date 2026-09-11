# Nexus deployment lifecycle

Nexus uses a bounded asynchronous runtime flow:

1. API validates the deployment request.
2. Git source is built into an immutable image tag.
3. The engine queues the runtime operation instead of blocking the HTTP request.
4. A candidate container is started first.
5. The candidate must pass a Docker `HEALTHCHECK` or an explicit HTTP `healthPath` before it can replace the active runtime.
6. Failed candidates are removed and the active runtime is not intentionally stopped during candidate validation.
7. For fixed host ports without a reverse proxy, the final handoff has a short restart window. True zero-downtime switching requires a router/proxy that can atomically move traffic from the old container to the healthy candidate.
8. The previous image can be supplied to the rollback endpoint for recovery.
9. Runtime logs remain available through the engine log endpoint.

## Health policy

By default, Nexus requires an actual health signal. A container without a Docker `HEALTHCHECK` must provide `healthPath` in the runtime request, for example `/health`.

For local development only, `REQUIRE_HEALTHCHECK=false` can allow a running container without a configured health signal. This should not be used as a production health policy.

## Current queue limitation

The queue is an in-process bounded queue. It protects a single engine instance from unlimited concurrent deployments, but jobs are lost if that process exits. Production HA requires Redis/BullMQ or another durable queue so jobs survive restarts and can be distributed across workers.

## Rollback

`POST /api/v1/runtime/rollback` accepts the runtime specification plus `previousImage`. Rollback uses the same candidate-and-health path as a normal deployment rather than blindly replacing a running container.
