# Runtime nodes

Nexus Hosting supports multiple independent Docker runtime nodes through node-scoped BullMQ deployment queues.

## Node configuration

Each engine worker should have a unique `NODE_NAME` and the same `REDIS_URL` and `ENGINE_INTERNAL_SECRET` as the control plane.

```env
NODE_NAME=runtime-01
NODE_ENDPOINT=http://10.0.0.11:4100
NODE_REGION=ap-south-1
NODE_HEARTBEAT_INTERVAL_MS=15000
DEPLOYMENT_QUEUE_PREFIX=nexus-deployments
ENGINE_CALLBACK_URL=http://nexus-api:4000
ENGINE_INTERNAL_SECRET=the-same-secret-used-by-the-api
```

Run a second worker with another identity, for example `runtime-02`.

## Registering a node

An authenticated platform administrator can register a node with `POST /api/v1/runtime/nodes` using its name, endpoint, region, CPU capacity and memory capacity. The node agent then refreshes utilization through the authenticated heartbeat endpoint.

## Deployment routing

The engine accepts an optional `nodeName` in deployment requests. Jobs are written to `nexus-deployments:<nodeName>`, and each worker consumes only its own queue. This prevents a worker on one machine from executing another machine's workload.

## Production topology

Use private networking between API, Redis and runtime nodes. Do not expose the engine port publicly. Give every runtime node its own Docker host and persistent volumes. Use a restricted build network and never expose the Docker socket to application containers.

## Current limitation

Automatic control-plane node selection is represented by the runtime-node capacity model, while explicit node targeting is fully supported by the engine queue layer. Fleet-wide automatic placement and remote execution orchestration should be enabled only after the control plane and all runtime agents share a private authenticated network.
