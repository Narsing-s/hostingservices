# Nexus Engine

The engine accepts deployment requests and places them in the durable `nexus-deployments` BullMQ queue. A separate worker consumes those jobs and performs Docker deployment/rollback.

## Runtime

- API: `npm run dev`
- Worker: `npm run dev:worker`
- Build: `npm run build`
- API port: `4100`
- Redis: `REDIS_URL` (defaults to local `redis://127.0.0.1:6379`)
- Runtime network: `NEXUS_RUNTIME_NETWORK` (defaults to `nexus-runtime`)
- Traefik routing: enabled by default; set `TRAEFIK_ENABLED=false` to use direct host-port handoff
- Dynamic config directory: `TRAEFIK_DYNAMIC_DIR` (defaults to `infra/docker/dynamic` from the repository root)
- Local host suffix: `NEXUS_PUBLIC_DOMAIN` (defaults to `localhost`)
- API lifecycle callback: `ENGINE_CALLBACK_URL` and optional `ENGINE_CALLBACK_SECRET`

## Deployment lifecycle

1. API creates a durable deployment record.
2. Git sources are built into an immutable image before runtime handoff.
3. BullMQ queues the runtime operation with retries and idempotency.
4. A candidate container starts on the shared runtime network and an ephemeral host port.
5. The candidate must pass a Docker `HEALTHCHECK`, or an explicit `healthPath` HTTP probe. For development-only deployments, `REQUIRE_HEALTHCHECK=false` can be used.
6. After health passes, the engine writes a Traefik file-provider route to the candidate. Traefik watches the dynamic directory and switches traffic without stopping the active candidate first.
7. The previous container is retired only after the new route is installed.
8. The worker reports `starting`, `ready`, or final `failed` status back to the API.

The local route is normally `http://<runtime-name>.localhost`.

## Production requirements

Run at least one engine API and one worker process, use persistent Redis, and mount the Traefik dynamic directory into the routing tier. For multiple engine workers, move routing state from a local filesystem to a shared/distributed provider before treating it as highly available.

The Docker engine socket is a privileged control surface. Do not expose the engine API publicly without authentication and network isolation. The runtime network and Traefik should also be isolated from untrusted management traffic.
