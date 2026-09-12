# Infrastructure control center

The `/platform` console is a live operational surface for Nexus runtime capacity and managed data.

## Managed data

Create a `database` service for PostgreSQL or a `redis` service for Redis, then provision it from `/platform`.

The engine creates:

- a dedicated Docker container
- a persistent named Docker volume
- a generated credential
- a Nexus runtime-network attachment
- a restart policy
- CPU/memory/PID limits

The API stores the connection URI encrypted in the platform secret store and never returns the credential after provisioning.

For production, the engine should run on a private network. Do not expose the Docker socket or the engine provisioning endpoint to application containers or the public internet.

## Runtime nodes

Nodes can be registered through `POST /api/v1/runtime/nodes` with a name, endpoint, region and capacity. Heartbeats update current CPU and memory consumption.

The node registry is the foundation for multi-region scheduling. A future scheduler can select a node based on available capacity, region affinity, health and workload policy without changing the service API.

## Readiness

`GET /api/v1/readiness` checks both the API database path and the runtime engine. A non-200 response means the control plane should be treated as unavailable for new deployments.
