# Nexus deployment lifecycle

A deployment now follows a bounded asynchronous runtime flow:

1. API validates the project and deployment request.
2. Git source is built into an immutable image tag.
3. The engine queues the runtime operation instead of blocking the HTTP request.
4. The runtime replaces the previous container only after the new deployment is ready to start.
5. Docker health checks are observed when configured.
6. Failed starts are removed rather than reported as healthy.
7. The previous image can be supplied to the rollback endpoint for recovery.
8. Runtime logs remain available through the engine log endpoint.

## Important production rule

A deployment must never be marked healthy merely because `docker start` returned successfully. Images should define a Docker `HEALTHCHECK`; otherwise Nexus can only report that the container is running, not that the application is healthy.

## Current limitation

The queue is an in-process bounded queue. It protects a single engine instance from unlimited concurrent deployments. Production HA requires Redis/BullMQ or another durable queue so jobs survive process restarts and can be distributed across engine workers.

## Rollback

`POST /api/v1/runtime/rollback` accepts the runtime specification plus `previousImage`. The rollback uses the same deployment and health-check path as a normal deployment.
